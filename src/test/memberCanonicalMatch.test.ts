/**
 * Phase 2B.2 closure — behavioral tests for canonical member-address matching.
 *
 * Rules under test:
 *   - verified_services / verified_bh: `active_status = true` required.
 *   - facilities / rural_services: `mappable = true` required, no
 *     `active_status` column, so no such condition may be applied.
 *   - every table: `deleted_at IS NULL`, exact canonical equality, finite
 *     coordinates, Nevada bounds, curated `manual_lat/lng` preference.
 */
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_TABLES,
  createCanonicalMatch,
  type CanonicalDbClient,
} from '../../supabase/functions/resolve-address/canonicalMatch.ts';

type Row = Record<string, unknown>;

interface Recorded {
  table: string;
  eq: Array<[string, unknown]>;
  is: Array<[string, null]>;
  ilike: Array<[string, string]>;
}

/**
 * Fake Data API client that applies the same filters PostgREST would, so the
 * matcher's filter choices are exercised, not just inspected.
 */
const fakeDb = (tables: Record<string, Row[]>) => {
  const recorded: Recorded[] = [];
  const client: CanonicalDbClient = {
    from(table: string) {
      const log: Recorded = { table, eq: [], is: [], ilike: [] };
      recorded.push(log);
      const builder = {
        is(col: string, val: null) { log.is.push([col, val]); return builder; },
        eq(col: string, val: unknown) { log.eq.push([col, val]); return builder; },
        ilike(col: string, val: string) { log.ilike.push([col, val]); return builder; },
        limit() { return builder; },
        then<T>(onfulfilled: (r: { data: Row[] | null }) => T) {
          const rows = (tables[table] ?? []).filter((row) => {
            for (const [col] of log.is) if (row[col] != null) return false;
            for (const [col, val] of log.eq) if (row[col] !== val) return false;
            for (const [col, val] of log.ilike) {
              if (String(row[col] ?? '').toLowerCase() !== val.toLowerCase()) return false;
            }
            return true;
          });
          return Promise.resolve(onfulfilled({ data: rows }));
        },
      };
      return { select: () => builder as never };
    },
  };
  return { client, recorded };
};

const ADDRESS = '100 Main St, Fallon, NV 89406';

const verifiedRow = (over: Row = {}): Row => ({
  street_address: '100 Main St',
  city: 'Fallon',
  state: 'NV',
  zip: '89406',
  county: 'Churchill',
  latitude: 39.4735,
  longitude: -118.7774,
  manual_lat: null,
  manual_lng: null,
  coordinate_locked: false,
  coordinate_confidence: 'high',
  deleted_at: null,
  active_status: true,
  ...over,
});

const liveRow = (over: Row = {}): Row => ({
  street_address: '100 Main St',
  city: 'Fallon',
  state: 'NV',
  zip: '89406',
  county: 'Churchill',
  lat: 39.4735,
  lng: -118.7774,
  manual_lat: null,
  manual_lng: null,
  coordinate_locked: false,
  coordinate_confidence: 'high',
  deleted_at: null,
  mappable: true,
  ...over,
});

const match = (tables: Record<string, Row[]>) => {
  const { client, recorded } = fakeDb(tables);
  return { run: createCanonicalMatch(client), recorded };
};

describe('canonical table specification', () => {
  it('covers all four canonical tables', () => {
    expect(CANONICAL_TABLES.map(t => t.table)).toEqual([
      'facilities', 'rural_services', 'verified_services', 'verified_bh',
    ]);
  });

  it('requires active_status only on the verified tables', () => {
    const active = CANONICAL_TABLES.filter(t => t.requireActive).map(t => t.table);
    expect(active).toEqual(['verified_services', 'verified_bh']);
  });

  it('requires mappable only on the live map tables', () => {
    const mappable = CANONICAL_TABLES.filter(t => t.requireMappable).map(t => t.table);
    expect(mappable).toEqual(['facilities', 'rural_services']);
  });
});

describe('verified_services active gating', () => {
  it('resolves an active record', async () => {
    const { run } = match({ verified_services: [verifiedRow()] });
    const hit = await run(ADDRESS);
    expect(hit).not.toBeNull();
    expect(hit!.source).toBe('canonical_resource');
    expect(hit!.lat).toBeCloseTo(39.4735, 4);
  });

  it('does not resolve an inactive record', async () => {
    const { run } = match({ verified_services: [verifiedRow({ active_status: false })] });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('does not resolve a record with a null active_status', async () => {
    const { run } = match({ verified_services: [verifiedRow({ active_status: null })] });
    expect(await run(ADDRESS)).toBeNull();
  });
});

describe('verified_bh active gating', () => {
  it('resolves an active record', async () => {
    const { run } = match({ verified_bh: [verifiedRow()] });
    const hit = await run(ADDRESS);
    expect(hit).not.toBeNull();
    expect(hit!.county).toBe('Churchill');
  });

  it('does not resolve an inactive record', async () => {
    const { run } = match({ verified_bh: [verifiedRow({ active_status: false })] });
    expect(await run(ADDRESS)).toBeNull();
  });
});

describe('deleted verified records never resolve', () => {
  it('excludes a soft-deleted but active verified_services record', async () => {
    const { run } = match({
      verified_services: [verifiedRow({ deleted_at: '2026-01-01T00:00:00Z' })],
    });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('excludes a soft-deleted verified_bh record', async () => {
    const { run } = match({
      verified_bh: [verifiedRow({ deleted_at: '2026-01-01T00:00:00Z' })],
    });
    expect(await run(ADDRESS)).toBeNull();
  });
});

describe('live map tables keep their existing semantics', () => {
  it('resolves a mappable facilities record', async () => {
    const { run, recorded } = match({ facilities: [liveRow()] });
    expect(await run(ADDRESS)).not.toBeNull();
    const facLog = recorded.find(r => r.table === 'facilities')!;
    expect(facLog.eq.map(([c]) => c)).toContain('mappable');
    // facilities has no active_status column — never filter on it.
    expect(facLog.eq.map(([c]) => c)).not.toContain('active_status');
  });

  it('excludes a non-mappable facilities record', async () => {
    const { run } = match({ facilities: [liveRow({ mappable: false })] });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('resolves a mappable rural_services record without an active_status filter', async () => {
    const { run, recorded } = match({ rural_services: [liveRow()] });
    expect(await run(ADDRESS)).not.toBeNull();
    const log = recorded.find(r => r.table === 'rural_services')!;
    expect(log.eq.map(([c]) => c)).not.toContain('active_status');
  });

  it('excludes a soft-deleted rural_services record', async () => {
    const { run } = match({
      rural_services: [liveRow({ deleted_at: '2026-01-01T00:00:00Z' })],
    });
    expect(await run(ADDRESS)).toBeNull();
  });
});

describe('shared canonical guardrails', () => {
  it('requires exact canonical equality, not a partial street match', async () => {
    const { run } = match({ verified_services: [verifiedRow({ street_address: '1100 Main St' })] });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('prefers curated manual coordinates', async () => {
    const { run } = match({
      verified_services: [verifiedRow({ manual_lat: 39.5, manual_lng: -118.8 })],
    });
    const hit = await run(ADDRESS);
    expect(hit!.lat).toBeCloseTo(39.5, 4);
    expect(hit!.lng).toBeCloseTo(-118.8, 4);
  });

  it('rejects coordinates outside Nevada', async () => {
    const { run } = match({
      verified_services: [verifiedRow({ latitude: 34.05, longitude: -118.24 })],
    });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('rejects rows with missing coordinates', async () => {
    const { run } = match({
      verified_services: [verifiedRow({ latitude: null, longitude: null })],
    });
    expect(await run(ADDRESS)).toBeNull();
  });

  it('returns null without querying when the input has no street component', async () => {
    const { run, recorded } = match({ verified_services: [verifiedRow()] });
    expect(await run('Fallon, NV 89406')).toBeNull();
    expect(recorded).toHaveLength(0);
  });
});
