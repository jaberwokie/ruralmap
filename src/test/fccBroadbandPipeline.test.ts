/**
 * Phase 2A.1 — end-to-end pipeline orchestration against in-memory ports.
 *
 * Verifies: fail-closed credentials, immutable raw evidence before transform,
 * atomic replacement, failure isolation (no mutation of the normalized table
 * on failure), provenance completeness, and no secret leakage.
 */
import { describe, it, expect } from 'vitest';
import {
  ACQUISITION_PROTOCOL_VERSION,
  DERIVATION_VERSION,
  EVIDENCE_BUCKET,
  NEVADA_COUNTY_FIPS,
  fccEndpoints,
  runFccBroadbandIngestion,
  type FccIngestionPorts,
  type NormalizedCountyRow,
} from './helpers/fccBroadbandPorts';

const HEADER =
  'area_data_type,geography_type,geography_id,geography_desc,biz_res,technology,total_units,speed_25_3,speed_100_20';

const csvForRelease = () => {
  const lines = [HEADER];
  for (const c of NEVADA_COUNTY_FIPS) {
    lines.push(`Total,County,${c.fips},"${c.name}",R,All Terrestrial,4000,0.88,0.61`);
    lines.push(`Total,County,${c.fips},"${c.name}",R,Fiber,4000,0.31,0.31`);
    lines.push(`Total,County,${c.fips},"${c.name}",R,Cable,4000,0.52,0.5`);
    lines.push(`Total,County,${c.fips},"${c.name}",R,All Fixed Wireless,4000,0.4,0.12`);
    lines.push(`Total,County,${c.fips},"${c.name}",R,All Satellite,4000,1,0.2`);
  }
  return lines.join('\n');
};

const USERNAME = 'ops@example.org';
const HASH = 'secrethash123';

interface Harness {
  ports: FccIngestionPorts;
  state: {
    normalized: NormalizedCountyRow[];
    evidence: { path: string; bytes: number; contentType: string }[];
    snapshots: Record<string, unknown>[];
    runs: Record<string, unknown>[];
    sourcePatches: Record<string, unknown>[];
    order: string[];
  };
}

const makeHarness = (opts: {
  env?: Record<string, string>;
  asOfDatesStatus?: number;
  manifestStatus?: number;
  downloadStatus?: number;
  csv?: string;
  failReplace?: boolean;
  seedNormalized?: boolean;
} = {}): Harness => {
  const state: Harness['state'] = {
    normalized: [],
    evidence: [],
    snapshots: [],
    runs: [],
    sourcePatches: [],
    order: [],
  };

  const carried = NEVADA_COUNTY_FIPS.map((c) => ({
    county_key: c.name.toLowerCase().replace(/\s+/g, '_'),
    fiber_share: 12,
    cable_share: 18,
    fixed_wireless_share: 30,
    satellite_share: 40,
    coverage_unevenness: false,
    notes: 'existing Rural Tool interpretation',
  }));

  if (opts.seedNormalized !== false) {
    state.normalized = carried.map((c) => ({
      county_key: c.county_key,
      county_name: c.county_key,
      pct_100_20_plus: 50,
      pct_25_3_to_100_20: 25,
      pct_below_25_3: 25,
      fiber_share: c.fiber_share,
      cable_share: c.cable_share,
      fixed_wireless_share: c.fixed_wireless_share,
      satellite_share: c.satellite_share,
      coverage_unevenness: c.coverage_unevenness,
      notes: c.notes,
    }));
  }

  const env = opts.env ?? { FCC_BDC_API_USERNAME: USERNAME, FCC_BDC_API_HASH_VALUE: HASH };
  const zipBytes = new TextEncoder().encode('PK-fake-zip-' + (opts.csv ?? csvForRelease()));

  const ports: FccIngestionPorts = {
    now: () => new Date('2026-08-21T12:00:00Z'),
    readEnv: (name) => env[name],

    async getSource() {
      return { id: 'src-1', source_url: fccEndpoints.listAsOfDates() };
    },

    async getJson(url, headers) {
      expect(headers.username).toBe(USERNAME);
      expect(headers.hash_value).toBe(HASH);
      if (url.endsWith('/listAsOfDates')) {
        state.order.push('listAsOfDates');
        const status = opts.asOfDatesStatus ?? 200;
        return {
          ok: status === 200,
          status,
          contentType: 'application/json',
          text: JSON.stringify({
            data: [
              { as_of_date: '2024-06-30', data_type: 'availability' },
              { as_of_date: '2025-06-30', data_type: 'availability' },
            ],
          }),
        };
      }
      state.order.push('manifest');
      const status = opts.manifestStatus ?? 200;
      return {
        ok: status === 200,
        status,
        contentType: 'application/json',
        text: JSON.stringify({
          data: [
            {
              file_id: 555,
              file_name: 'bdc_us_fixed_broadband_summary_by_geography_D25Jun_01aug2025.zip',
              category: 'Summary Data',
              subcategory: 'Fixed Broadband Summary by Geography Type',
              state_fips: null,
            },
          ],
        }),
      };
    },

    async getBytes() {
      state.order.push('download');
      const status = opts.downloadStatus ?? 200;
      return {
        ok: status === 200,
        status,
        contentType: 'application/zip',
        bytes: status === 200 ? zipBytes : new Uint8Array(),
      };
    },

    async sha256(bytes) {
      state.order.push('hash');
      let h = 0;
      for (const b of bytes) h = (h * 31 + b) % 0xffffffff;
      return h.toString(16).padStart(64, '0');
    },

    async putEvidence(path, bytes, contentType) {
      state.order.push('putEvidence');
      state.evidence.push({ path, bytes: bytes.byteLength, contentType });
      return path;
    },

    async unzipCsv() {
      state.order.push('unzip');
      return opts.csv ?? csvForRelease();
    },

    async startRun() {
      state.order.push('startRun');
      state.runs.push({ id: 'run-1', status: 'running' });
      return 'run-1';
    },

    async insertSnapshot(input) {
      state.order.push('insertSnapshot');
      state.snapshots.push(input);
      return 'snap-1';
    },

    async getCarriedValues() {
      return carried;
    },

    async getPreviousTiers() {
      return state.normalized.map((r) => ({
        county_key: r.county_key,
        pct_100_20_plus: r.pct_100_20_plus,
        pct_25_3_to_100_20: r.pct_25_3_to_100_20,
        pct_below_25_3: r.pct_below_25_3,
      }));
    },

    async replaceNormalized(input) {
      state.order.push('replaceNormalized');
      if (opts.failReplace) throw new Error('deadlock detected');
      state.normalized = input.rows;
      return input.rows.length;
    },

    async completeRun(_runId, patch) {
      state.order.push('completeRun');
      state.runs.push(patch);
    },

    async updateSourceHealth(_sourceId, patch) {
      state.sourcePatches.push(patch);
    },
  };

  return { ports, state };
};

describe('successful FCC ingestion', () => {
  it('writes 17 Nevada counties derived from the FCC release', async () => {
    const { ports, state } = makeHarness();
    const result = await runFccBroadbandIngestion(ports);
    expect(result.ok).toBe(true);
    expect(result.records_written).toBe(17);
    expect(result.as_of_date).toBe('2025-06-30');
    expect(state.normalized).toHaveLength(17);
    expect(state.normalized[0].pct_100_20_plus).toBe(61);
    expect(state.normalized[0].pct_25_3_to_100_20).toBe(27);
    expect(state.normalized[0].pct_below_25_3).toBe(12);
  });

  it('stores raw evidence BEFORE any transformation or normalized write', async () => {
    const { ports, state } = makeHarness();
    await runFccBroadbandIngestion(ports);
    expect(state.evidence).toHaveLength(1);
    expect(state.evidence[0].path).toMatch(/^fcc_broadband\/2025-06-30\/[0-9a-f]{12}\//);
    expect(state.order.indexOf('putEvidence')).toBeLessThan(state.order.indexOf('unzip'));
    expect(state.order.indexOf('putEvidence')).toBeLessThan(state.order.indexOf('replaceNormalized'));
  });

  it('records complete, reproducible provenance on the snapshot', async () => {
    const { ports, state } = makeHarness();
    await runFccBroadbandIngestion(ports);
    const snap = state.snapshots[0] as Record<string, any>;
    expect(snap.storage_bucket).toBe(EVIDENCE_BUCKET);
    expect(snap.acquisition_protocol).toBe(ACQUISITION_PROTOCOL_VERSION);
    expect(snap.effective_date).toBe('2025-06-30');
    expect(snap.source_version).toBe('2025-06-30');
    expect(snap.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.source_artifacts.auth_header_names).toEqual(['username', 'hash_value']);
    expect(snap.source_artifacts.artifacts[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.source_artifacts.derivation.version).toBe(DERIVATION_VERSION);
  });

  it('produces a county comparison against the values previously in effect', async () => {
    const { ports } = makeHarness();
    const result = await runFccBroadbandIngestion(ports);
    expect(result.comparison).toHaveLength(17 * 3);
    const row = result.comparison!.find((c) => c.field === 'pct_100_20_plus')!;
    expect(row.previous).toBe(50);
    expect(row.fcc_derived).toBe(61);
    expect(row.delta).toBe(11);
  });

  it('marks the source active and internalized', async () => {
    const { ports, state } = makeHarness();
    await runFccBroadbandIngestion(ports);
    const patch = state.sourcePatches.at(-1) as Record<string, unknown>;
    expect(patch.status).toBe('current');
    expect(patch.internalization_target).toBe('fully_internal');
    expect(patch.is_stale).toBe(false);
    expect(patch.transformation_version).toBe(DERIVATION_VERSION);
  });

  it('honours an operator-supplied as-of date without release discovery', async () => {
    const { ports, state } = makeHarness();
    const result = await runFccBroadbandIngestion(ports, { asOfDate: '2024-12-31' });
    expect(result.as_of_date).toBe('2024-12-31');
    expect(state.order).not.toContain('listAsOfDates');
  });

  it('dry run acquires and derives without replacing the dataset', async () => {
    const { ports, state } = makeHarness();
    const before = state.normalized;
    const result = await runFccBroadbandIngestion(ports, { dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.records_written).toBe(0);
    expect(state.order).not.toContain('replaceNormalized');
    expect(state.normalized).toBe(before);
    expect(state.evidence).toHaveLength(1);
  });
});

describe('failure isolation', () => {
  const expectDatasetUnchanged = (state: Harness['state']) => {
    expect(state.normalized).toHaveLength(17);
    expect(state.normalized[0].pct_100_20_plus).toBe(50);
  };

  it('fails closed when credentials are not configured', async () => {
    const { ports, state } = makeHarness({ env: {} });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.ok).toBe(false);
    expect(result.failure_code).toBe('fcc_credentials_missing');
    expect(result.stage).toBe('credentials');
    expect(state.order).not.toContain('listAsOfDates');
    expectDatasetUnchanged(state);
  });

  it('reports authentication failure distinctly from a transport failure', async () => {
    const { ports, state } = makeHarness({ asOfDatesStatus: 401 });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.failure_code).toBe('fcc_authentication_failed');
    expectDatasetUnchanged(state);
  });

  it('reports a manifest failure', async () => {
    const { ports } = makeHarness({ manifestStatus: 500 });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.failure_code).toBe('fcc_manifest_failed');
  });

  it('reports a download failure', async () => {
    const { ports, state } = makeHarness({ downloadStatus: 503 });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.failure_code).toBe('fcc_download_failed');
    expect(state.evidence).toHaveLength(0);
    expectDatasetUnchanged(state);
  });

  it('reports a validation failure and leaves the dataset intact', async () => {
    const csv = `${HEADER}\nTotal,County,32023,"Nye",R,All Terrestrial,4000,0.5,0.4`;
    const { ports, state } = makeHarness({ csv });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.failure_code).toBe('fcc_validation_failed');
    expect(state.order).not.toContain('replaceNormalized');
    expectDatasetUnchanged(state);
  });

  it('reports a persistence failure without corrupting the dataset', async () => {
    const { ports, state } = makeHarness({ failReplace: true });
    const result = await runFccBroadbandIngestion(ports);
    expect(result.failure_code).toBe('fcc_persistence_failed');
    expect(result.message).toMatch(/previous normalized dataset is unchanged/i);
    expectDatasetUnchanged(state);
  });

  it('records the failure code and stage on the run row and degrades the source', async () => {
    const { ports, state } = makeHarness({ downloadStatus: 500 });
    await runFccBroadbandIngestion(ports);
    const run = state.runs.at(-1) as Record<string, any>;
    expect(run.status).toBe('failed');
    expect(run.failure_code).toBe('fcc_download_failed');
    expect(run.run_metadata.stage).toBe('download');
    expect((state.sourcePatches.at(-1) as Record<string, unknown>).status).toBe('failing');
  });

  it('never leaks credential values into any persisted record or response', async () => {
    const cases = [{ asOfDatesStatus: 401 }, { downloadStatus: 500 }, { failReplace: true }, {}];
    for (const c of cases) {
      const { ports, state } = makeHarness(c);
      const result = await runFccBroadbandIngestion(ports);
      const dump = JSON.stringify({ result, state });
      expect(dump).not.toContain(HASH);
      expect(dump).not.toContain(USERNAME);
    }
  });
});
