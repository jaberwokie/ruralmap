/**
 * Member-address lookup correction tests.
 *
 * Covers:
 *  - malformed / truncated ZIP+4 normalization before lookup
 *  - capability-vs-validity failure semantics (`member_geocoder_not_configured`)
 *  - PII: no raw member address in errors, logs, or persisted records
 *  - no new external member-address provider
 *  - resource Census pipeline untouched by the member path
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  normalizeZipPlus4,
  canonicalizeAddress,
  buildQueryVariants,
  resolveAddress,
  type ResolverPorts,
} from './helpers/geocodePorts';

const SECRET = 'test-secret-value-not-a-real-key';

const RAW = '1800 GRISWOLD DR ELKO NV 89801-1';

// ── ZIP+4 normalization ───────────────────────────────────────────────

describe('incomplete ZIP+4 normalization', () => {
  it('reduces a 1-digit add-on to the base ZIP', () => {
    expect(normalizeZipPlus4('89801-1')).toBe('89801');
  });

  it('reduces a 2-digit add-on to the base ZIP', () => {
    expect(normalizeZipPlus4('89801-12')).toBe('89801');
  });

  it('reduces a 3-digit add-on to the base ZIP', () => {
    expect(normalizeZipPlus4('89801-123')).toBe('89801');
  });

  it('preserves a complete ZIP+4', () => {
    expect(normalizeZipPlus4('89801-1234')).toBe('89801-1234');
  });

  it('preserves a plain 5-digit ZIP', () => {
    expect(normalizeZipPlus4('89801')).toBe('89801');
  });

  it('normalizes inside a full address without disturbing the street number', () => {
    expect(normalizeZipPlus4(RAW)).toBe('1800 GRISWOLD DR ELKO NV 89801');
  });

  it('canonicalizes the failing production example to the base ZIP', () => {
    const canon = canonicalizeAddress('1800 Griswold Dr, Elko, NV 89801-1');
    expect(canon.canonical).toContain('89801');
    expect(canon.canonical).not.toContain('89801-1');
    expect(canon.zip).toBe('89801');
  });

  it('gives the truncated and base ZIP forms one shared canonical identity', () => {
    const a = canonicalizeAddress('1800 Griswold Dr, Elko, NV 89801-1').canonical;
    const b = canonicalizeAddress('1800 Griswold Dr, Elko, NV 89801').canonical;
    expect(a).toBe(b);
  });

  it('emits no truncated ZIP+4 in any query variant', () => {
    const variants = buildQueryVariants(RAW);
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) expect(v.q).not.toMatch(/\b\d{5}-\d{1,3}(?!\d)/);
  });
});

// ── Capability vs validity ────────────────────────────────────────────

const harness = () => {
  const logs: unknown[] = [];
  const upserts: unknown[] = [];
  const ports: ResolverPorts = {
    secret: SECRET,
    cacheLookup: async () => null,
    cacheUpsert: async (r) => { upserts.push(r); },
    cacheTouch: async () => {},
    geocoders: [],
    logEvent: (e) => { logs.push(e); },
    now: () => '2026-09-15T00:00:00.000Z',
  };
  return { ports, logs, upserts };
};

describe('unresolved member address reports a capability failure, not an invalid address', () => {
  it('returns member_geocoder_not_configured when no provider is configured', async () => {
    const { ports } = harness();
    const res = await resolveAddress(ports, { address: RAW });
    expect(res.resolved).toBe(false);
    expect(res.failures).toContain('member_geocoder_not_configured');
    expect(res.failures).toContain('no_approved_external_provider');
    expect(res.manual_placement_required).toBe(true);
    expect(res.external_calls).toBe(0);
  });

  it('never emits the raw address in the result or in telemetry', async () => {
    const { ports, logs, upserts } = harness();
    const res = await resolveAddress(ports, { address: RAW });
    const dump = JSON.stringify({ res, logs, upserts });
    expect(dump).not.toMatch(/griswold/i);
    expect(dump).not.toMatch(/89801/);
  });
});

// ── Boundary regressions ──────────────────────────────────────────────

const resolverFn = readFileSync('supabase/functions/resolve-address/index.ts', 'utf8');
const browserPath = readFileSync('src/hooks/useMemberAccess.ts', 'utf8');

describe('no new external member-address provider was introduced', () => {
  it('keeps the approved member geocoder list empty', () => {
    expect(resolverFn).toMatch(/geocoders:\s*\[\]/);
    expect(resolverFn).toContain('member_address_external_provider = none_approved');
  });

  it('adds no third-party geocoder to the member path', () => {
    for (const src of [resolverFn, browserPath]) {
      expect(src).not.toMatch(/nominatim/i);
      expect(src).not.toMatch(/census/i);
      expect(src).not.toMatch(/maps\.googleapis\.com/i);
      expect(src).not.toMatch(/mapbox|hereapi|geocod\.io|smarty/i);
    }
  });

  it('does not route member addresses into the resource geocoding pipeline', () => {
    for (const src of [resolverFn, browserPath]) {
      expect(src).not.toMatch(/geocode-address/);
      expect(src).not.toMatch(/geocode-bulk/);
      expect(src).not.toMatch(/resource_address/);
    }
  });
});

describe('client distinguishes resolver failure modes', () => {
  it('has a distinct internal-service-unavailable message', () => {
    expect(browserPath).toContain('Address resolution service is unavailable.');
  });

  it('has a truthful not-configured message that does not deny the address', () => {
    expect(browserPath).toContain('Automatic member address lookup is not configured.');
  });

  it('retains the highway manual-placement message', () => {
    expect(browserPath).toContain('Highway address could not be precisely located.');
  });

  it('reads the stable resolver failure code', () => {
    expect(browserPath).toContain('member_geocoder_not_configured');
  });
});
