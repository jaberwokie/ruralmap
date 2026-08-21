/**
 * Phase 2A — FCC broadband ingestion pipeline tests.
 * Exercises the server-side pipeline through injected ports (no network, no DB).
 */
import { describe, it, expect } from 'vitest';
import {
  NEVADA_COUNTIES,
  EXPECTED_COUNTY_COUNT,
  contentHash,
  countyKey,
  parsePayload,
  validateAndTransform,
  BroadbandValidationError,
} from '../../supabase/functions/ingest-fcc-broadband/transform';
import {
  runBroadbandIngestion,
  type IngestionPorts,
  type NormalizedShim,
} from './helpers/broadbandPorts';

const county = (name: string, over: Record<string, unknown> = {}) => ({
  countyName: name,
  pct_100_20_plus: 50,
  pct_25_3_to_100_20: 25,
  pct_below_25_3: 25,
  fiberShare: 10,
  cableShare: 20,
  fixedWirelessShare: 30,
  satelliteShare: 40,
  coverageUnevenness: false,
  notes: 'n',
  ...over,
});

const fullPayload = () => NEVADA_COUNTIES.map((c) => county(c));

describe('broadband transform + validation', () => {
  it('transforms all 17 Nevada counties', () => {
    const rows = validateAndTransform(fullPayload());
    expect(rows).toHaveLength(EXPECTED_COUNTY_COUNT);
    expect(new Set(rows.map((r) => r.county_key)).size).toBe(EXPECTED_COUNTY_COUNT);
  });

  it('accepts "X County" naming and normalizes it', () => {
    const payload = NEVADA_COUNTIES.map((c) => county(`${c} County`));
    const rows = validateAndTransform(payload);
    expect(rows.find((r) => r.county_key === 'white_pine')?.county_name).toBe('White Pine');
  });

  it('rejects unparseable payloads', () => {
    expect(() => parsePayload('{not json')).toThrowError(BroadbandValidationError);
  });

  it('rejects unexpected shapes', () => {
    expect(() => validateAndTransform({ counties: [] })).toThrowError(/array/i);
  });

  it('rejects a missing county', () => {
    const payload = fullPayload().slice(1);
    expect(() => validateAndTransform(payload)).toThrowError(/Missing Nevada counties/);
  });

  it('rejects a duplicate county', () => {
    const payload = [...fullPayload(), county('Nye')];
    expect(() => validateAndTransform(payload)).toThrowError(/Duplicate county/);
  });

  it('rejects an unknown county identifier', () => {
    const payload = [...fullPayload(), county('Atlantis')];
    expect(() => validateAndTransform(payload)).toThrowError(/Unrecognized/);
  });

  it('rejects non-numeric metrics', () => {
    const payload = fullPayload();
    payload[3] = county(NEVADA_COUNTIES[3], { pct_below_25_3: '25' });
    expect(() => validateAndTransform(payload)).toThrowError(/not a finite number/);
  });

  it('rejects a missing required field', () => {
    const payload = fullPayload().map((r) => ({ ...r }));
    delete (payload[0] as Record<string, unknown>).fiberShare;
    expect(() => validateAndTransform(payload)).toThrowError(/is missing/);
  });

  it('rejects out-of-range percentages', () => {
    const payload = fullPayload();
    payload[0] = county(NEVADA_COUNTIES[0], { fiberShare: 140 });
    expect(() => validateAndTransform(payload)).toThrowError(/0-100/);
  });

  it('produces a deterministic content hash', async () => {
    const body = JSON.stringify(fullPayload());
    const a = await contentHash(body);
    const b = await contentHash(body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await contentHash(body + ' ')).not.toBe(a);
  });

  it('derives stable county keys', () => {
    expect(countyKey('Carson City')).toBe('carson_city');
    expect(countyKey('White Pine County')).toBe('white_pine');
  });
});

// ── Pipeline ──

interface Harness {
  ports: IngestionPorts;
  state: NormalizedShim;
}

const makeHarness = (opts: {
  body?: string;
  ok?: boolean;
  status?: number;
  sourceUrl?: string | null;
  throwOnFetch?: boolean;
  failPersistence?: boolean;
  seed?: unknown[];
}): Harness => {
  const state: NormalizedShim = {
    normalized: opts.seed ? [...opts.seed] : [],
    runs: [],
    snapshots: [],
    sourceHealth: {},
  };
  const ports: IngestionPorts = {
    now: () => new Date('2026-08-21T18:00:00.000Z'),
    getSource: async () => ({
      id: 'src-1',
      source_url: opts.sourceUrl === undefined ? 'https://example.test/broadband.json' : opts.sourceUrl,
    }),
    fetchSource: async () => {
      if (opts.throwOnFetch) throw new Error('socket hang up');
      return {
        ok: opts.ok ?? true,
        status: opts.status ?? 200,
        contentType: 'application/json',
        body: opts.body ?? JSON.stringify(fullPayload()),
      };
    },
    startRun: async (source_id, started_at) => {
      const id = `run-${state.runs.length + 1}`;
      state.runs.push({ id, source_id, started_at, status: 'running' });
      return id;
    },
    insertSnapshot: async (input) => {
      const id = `snap-${state.snapshots.length + 1}`;
      state.snapshots.push({ id, ...input });
      return id;
    },
    replaceNormalized: async ({ rows }) => {
      if (opts.failPersistence) throw new Error('deadlock detected');
      if (rows.length === 0) throw new Error('refusing empty dataset');
      state.normalized = rows.map((r) => ({ ...r }));
      return rows.length;
    },
    completeRun: async (runId, patch) => {
      const run = state.runs.find((r) => r.id === runId);
      if (run) Object.assign(run, patch);
    },
    updateSourceHealth: async (_id, patch) => {
      Object.assign(state.sourceHealth, patch);
    },
  };
  return { ports, state };
};

describe('broadband ingestion pipeline', () => {
  it('completes a successful ingestion end-to-end', async () => {
    const { ports, state } = makeHarness({});
    const result = await runBroadbandIngestion(ports, {});
    expect(result.ok).toBe(true);
    expect(result.recordCount).toBe(EXPECTED_COUNTY_COUNT);
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.normalized).toHaveLength(EXPECTED_COUNTY_COUNT);
    expect(state.runs[0].status).toBe('success');
    expect(state.runs[0].started_at).toBeTruthy();
    expect(state.runs[0].completed_at).toBeTruthy();
    expect(state.sourceHealth.last_successful_ingestion_at).toBeTruthy();
    expect(state.sourceHealth.last_record_count).toBe(EXPECTED_COUNTY_COUNT);
    expect(state.sourceHealth.content_hash).toBe(result.contentHash);
    expect(state.sourceHealth.last_failed_ingestion_at).toBeUndefined();
  });

  it('fails explicitly when no authoritative URL is known', async () => {
    const { ports, state } = makeHarness({ sourceUrl: null });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('source_url_unknown');
    expect(state.runs).toHaveLength(0);
  });

  it('fails on non-OK HTTP status without touching normalized data', async () => {
    const seed = [{ county_key: 'nye', county_name: 'Nye' }];
    const { ports, state } = makeHarness({ ok: false, status: 503, seed });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('retrieve');
    expect(state.normalized).toEqual(seed);
    expect(state.runs[0].status).toBe('failed');
    expect(state.sourceHealth.last_failed_ingestion_at).toBeTruthy();
    expect(state.sourceHealth.last_successful_ingestion_at).toBeUndefined();
  });

  it('fails on a network error', async () => {
    const { ports, state } = makeHarness({ throwOnFetch: true });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.errorCode).toBe('network_error');
    expect(state.snapshots).toHaveLength(0);
  });

  it('fails on a malformed payload and keeps last known good data', async () => {
    const seed = [{ county_key: 'nye', county_name: 'Nye' }];
    const { ports, state } = makeHarness({ body: 'not json at all', seed });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('unparseable_payload');
    expect(state.normalized).toEqual(seed);
  });

  it('fails on a missing county and keeps last known good data', async () => {
    const seed = [{ county_key: 'nye', county_name: 'Nye' }];
    const { ports, state } = makeHarness({ body: JSON.stringify(fullPayload().slice(2)), seed });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.errorCode).toBe('missing_county');
    expect(state.normalized).toEqual(seed);
    // The retrieval itself is still preserved as evidence.
    expect(state.snapshots).toHaveLength(1);
  });

  it('fails on a duplicate county', async () => {
    const { ports } = makeHarness({ body: JSON.stringify([...fullPayload(), county('Nye')]) });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.errorCode).toBe('duplicate_county');
  });

  it('fails on an invalid numeric field', async () => {
    const payload = fullPayload();
    payload[5] = county(NEVADA_COUNTIES[5], { satelliteShare: null });
    const { ports } = makeHarness({ body: JSON.stringify(payload) });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.errorCode).toBe('missing_required_field');
  });

  it('fails on database persistence error and keeps last known good data', async () => {
    const seed = [{ county_key: 'nye', county_name: 'Nye' }];
    const { ports, state } = makeHarness({ failPersistence: true, seed });
    const result = await runBroadbandIngestion(ports, {});
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('persist');
    expect(state.normalized).toEqual(seed);
    expect(state.runs[0].status).toBe('failed');
  });

  it('is idempotent across repeated identical ingestions', async () => {
    const body = JSON.stringify(fullPayload());
    const { ports, state } = makeHarness({ body });
    const first = await runBroadbandIngestion(ports, {});
    const second = await runBroadbandIngestion(ports, {});
    expect(second.contentHash).toBe(first.contentHash);
    expect(state.normalized).toHaveLength(EXPECTED_COUNTY_COUNT);
    expect(new Set(state.normalized.map((r) => (r as { county_key: string }).county_key)).size)
      .toBe(EXPECTED_COUNTY_COUNT);
    // Each retrieval is preserved: snapshots are append-only history.
    expect(state.snapshots).toHaveLength(2);
    expect(state.runs).toHaveLength(2);
  });

  it('records evidence-backed provenance on the snapshot only when supplied', async () => {
    const { ports, state } = makeHarness({});
    await runBroadbandIngestion(ports, { effectiveDate: '2026-03-31', sourceVersion: 'J25' });
    expect(state.snapshots[0].effective_date).toBe('2026-03-31');
    expect(state.snapshots[0].source_version).toBe('J25');
    expect(state.sourceHealth.effective_date).toBe('2026-03-31');
    expect(state.sourceHealth.source_version).toBe('J25');

    const bare = makeHarness({});
    await runBroadbandIngestion(bare.ports, {});
    expect(bare.state.snapshots[0].effective_date).toBeNull();
    expect(bare.state.sourceHealth.effective_date).toBeUndefined();
    expect(bare.state.sourceHealth.source_version).toBeUndefined();
  });
});
