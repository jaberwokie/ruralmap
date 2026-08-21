/**
 * Phase 2A.1 orchestration: FCC BDC Public Data API → Nevada county records.
 *
 * Stage order is fixed and every stage is recorded:
 *   credentials → discover release → discover manifest → download raw bytes
 *   → hash → store raw evidence → snapshot metadata → parse → derive
 *   → validate → atomic replace → run completion → source health
 *
 * Invariants:
 *  - Raw retrieved bytes are stored unmodified before any transformation.
 *  - A failed run NEVER mutates broadband_county_coverage. The previous
 *    normalized dataset stays intact and the application keeps reading it.
 *  - Every failure resolves to exactly one FccFailureCode.
 *  - No credential value is ever logged, persisted, or returned.
 */

import {
  FccIngestionError,
  redactCredentials,
  type FccFailureCode,
} from './failureCodes.ts';
import {
  ACQUISITION_PROTOCOL_VERSION,
  TECHNOLOGY_TREATMENT,
  aggregateArtifactIdentity,
  fccEndpoints,
  resolveCredentials,
  selectLatestPublishedRelease,
  selectRequiredNevadaArtifacts,
  type FccCredentials,
  type RequiredArtifact,
} from './fccAcquisition.ts';
import {
  DERIVATION_VERSION,
  deriveNevadaCounties,
  toNormalizedRows,
  type CarriedRuralToolValues,
  type CountyFccMetrics,
  type DerivationSummary,
  type NormalizedCountyRow,
} from './fccDerivation.ts';

export const SOURCE_KEY = 'fcc_broadband';
export const EVIDENCE_BUCKET = 'source-evidence';

export interface HttpResponse {
  ok: boolean;
  status: number;
  contentType: string | null;
  /** Present for JSON/metadata calls. */
  text?: string;
  /** Present for artifact downloads. */
  bytes?: Uint8Array;
}

export interface StoredArtifact {
  fileName: string;
  storagePath: string;
  sha256: string;
  byteSize: number;
  role: string;
  fileId: string;
}

export interface FccIngestionPorts {
  now(): Date;
  readEnv(name: string): string | undefined;

  getSource(sourceKey: string): Promise<{ id: string; source_url: string | null } | null>;

  /** Authenticated JSON GET against the FCC API. */
  getJson(url: string, headers: Record<string, string>): Promise<HttpResponse>;
  /** Authenticated binary GET against the FCC API. */
  getBytes(url: string, headers: Record<string, string>): Promise<HttpResponse>;

  sha256(bytes: Uint8Array): Promise<string>;
  /** Immutable raw evidence write. Returns the stored object path. */
  putEvidence(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Decompress the artifact archive and return its CSV text. */
  unzipCsv(bytes: Uint8Array): Promise<string>;

  startRun(sourceId: string, startedAt: string): Promise<string>;
  insertSnapshot(input: Record<string, unknown>): Promise<string>;
  /** Rural Tool interpretation values currently in effect (never invented). */
  getCarriedValues(): Promise<CarriedRuralToolValues[]>;
  replaceNormalized(input: {
    source_id: string;
    snapshot_id: string;
    rows: NormalizedCountyRow[];
    effective_date: string | null;
    source_version: string | null;
  }): Promise<number>;
  completeRun(runId: string, patch: Record<string, unknown>): Promise<void>;
  updateSourceHealth(sourceId: string, patch: Record<string, unknown>): Promise<void>;
}

export interface FccIngestionResult {
  ok: boolean;
  failure_code?: FccFailureCode;
  stage?: string;
  message?: string;
  source_key: string;
  as_of_date?: string;
  snapshot_id?: string;
  run_id?: string;
  records_written?: number;
  artifacts?: StoredArtifact[];
  derivation?: DerivationSummary;
  content_hash?: string;
  comparison?: CountyComparison[];
}

export interface CountyComparison {
  county_name: string;
  field: string;
  previous: number | null;
  fcc_derived: number;
  delta: number | null;
}

/** Operational comparison of FCC-derived tiers vs. what was in effect. */
export const buildComparison = (
  metrics: CountyFccMetrics[],
  previous: { county_key: string; pct_100_20_plus: number; pct_25_3_to_100_20: number; pct_below_25_3: number }[],
): CountyComparison[] => {
  const prev = new Map(previous.map((p) => [p.county_key, p]));
  const fields: (keyof CountyFccMetrics & string)[] = [
    'pct_100_20_plus',
    'pct_25_3_to_100_20',
    'pct_below_25_3',
  ];
  const out: CountyComparison[] = [];
  for (const m of metrics) {
    const p = prev.get(m.county_key);
    for (const field of fields) {
      const before = p ? (p as unknown as Record<string, number>)[field] : null;
      const after = m[field] as number;
      out.push({
        county_name: m.county_name,
        field,
        previous: before ?? null,
        fcc_derived: after,
        delta: before === null || before === undefined
          ? null
          : Math.round((after - before) * 10) / 10,
      });
    }
  }
  return out;
};

const asError = (err: unknown, secrets: (string | undefined)[]) => {
  if (err instanceof FccIngestionError) {
    return {
      code: err.code,
      stage: err.stage,
      message: redactCredentials(err.message, secrets),
      detail: err.detail,
    };
  }
  return {
    code: 'fcc_download_failed' as FccFailureCode,
    stage: 'download',
    message: redactCredentially(err, secrets),
    detail: undefined,
  };
};

const redactCredentially = (err: unknown, secrets: (string | undefined)[]) =>
  redactCredentials(err instanceof Error ? err.message : String(err), secrets);

export interface RunOptions {
  /** Operator override; when absent the latest published release is used. */
  asOfDate?: string | null;
  /** Dry run: acquire, hash, store evidence, derive — but do not replace. */
  dryRun?: boolean;
}

export const runFccBroadbandIngestion = async (
  ports: FccIngestionPorts,
  options: RunOptions = {},
): Promise<FccIngestionResult> => {
  const startedAt = ports.now().toISOString();
  let creds: FccCredentials | null = null;
  let runId: string | null = null;
  let sourceId: string | null = null;

  const secretValues = () => [creds?.username, creds?.hashValue];

  const fail = async (err: unknown): Promise<FccIngestionResult> => {
    const e = asError(err, secretValues());
    if (runId) {
      await ports.completeRun(runId, {
        status: 'failed',
        completed_at: ports.now().toISOString(),
        error_count: 1,
        failure_code: e.code,
        error_summary: e.message,
        run_metadata: {
          stage: e.stage,
          detail: e.detail ?? null,
          acquisition_protocol: ACQUISITION_PROTOCOL_VERSION,
          transformation_version: DERIVATION_VERSION,
        },
      });
    }
    if (sourceId) {
      await ports.updateSourceHealth(sourceId, {
        status: 'degraded',
        last_failed_ingestion_at: ports.now().toISOString(),
        notes: `Last ingestion failed at stage "${e.stage}" (${e.code}). Application continues on the previous normalized dataset.`,
      });
    }
    return {
      ok: false,
      failure_code: e.code,
      stage: e.stage,
      message: e.message,
      source_key: SOURCE_KEY,
      run_id: runId ?? undefined,
    };
  };

  try {
    // ── 1. Credentials (fails closed, names only) ──
    creds = resolveCredentials(ports.readEnv);
    const headers = {
      username: creds.username,
      hash_value: creds.hashValue,
      Accept: 'application/json',
    };

    // ── 2. Registry + run open ──
    const source = await ports.getSource(SOURCE_KEY);
    if (!source) {
      throw new FccIngestionError(
        'fcc_persistence_failed',
        `Source "${SOURCE_KEY}" is not present in the source registry.`,
      );
    }
    sourceId = source.id;
    runId = await ports.startRun(source.id, startedAt);

    // ── 3. Release discovery ──
    let asOfDate: string;
    if (options.asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(options.asOfDate)) {
      asOfDate = options.asOfDate;
    } else {
      const res = await ports.getJson(fccEndpoints.listAsOfDates(), headers);
      if (res.status === 401 || res.status === 403) {
        throw new FccIngestionError(
          'fcc_authentication_failed',
          `FCC API rejected the configured credentials (HTTP ${res.status}).`,
        );
      }
      if (!res.ok) {
        throw new FccIngestionError(
          'fcc_release_discovery_failed',
          `FCC listAsOfDates returned HTTP ${res.status}.`,
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.text ?? '');
      } catch {
        throw new FccIngestionError(
          'fcc_release_discovery_failed',
          'FCC listAsOfDates response is not valid JSON.',
        );
      }
      asOfDate = selectLatestPublishedRelease(parsed, ports.now()).asOfDate;
    }

    // ── 4. Manifest discovery ──
    const manifestRes = await ports.getJson(fccEndpoints.listAvailabilityData(asOfDate), headers);
    if (manifestRes.status === 401 || manifestRes.status === 403) {
      throw new FccIngestionError(
        'fcc_authentication_failed',
        `FCC API rejected the configured credentials on the manifest call (HTTP ${manifestRes.status}).`,
      );
    }
    if (!manifestRes.ok) {
      throw new FccIngestionError(
        'fcc_manifest_failed',
        `FCC listAvailabilityData(${asOfDate}) returned HTTP ${manifestRes.status}.`,
      );
    }
    let manifest: unknown;
    try {
      manifest = JSON.parse(manifestRes.text ?? '');
    } catch {
      throw new FccIngestionError(
        'fcc_manifest_failed',
        'FCC availability manifest response is not valid JSON.',
      );
    }
    const required: RequiredArtifact[] = selectRequiredNevadaArtifacts(manifest);

    // ── 5. Download + hash + immutable evidence ──
    const stored: StoredArtifact[] = [];
    let csvText = '';

    for (const artifact of required) {
      const res = await ports.getBytes(fccEndpoints.downloadFile(artifact.fileId), headers);
      if (res.status === 401 || res.status === 403) {
        throw new FccIngestionError(
          'fcc_authentication_failed',
          `FCC API rejected the configured credentials on the file download (HTTP ${res.status}).`,
        );
      }
      if (!res.ok || !res.bytes || res.bytes.byteLength === 0) {
        throw new FccIngestionError(
          'fcc_download_failed',
          `Download of "${artifact.fileName}" failed (HTTP ${res.status}, ${res.bytes?.byteLength ?? 0} bytes).`,
        );
      }

      let sha256: string;
      try {
        sha256 = await ports.sha256(res.bytes);
      } catch (hashErr) {
        throw new FccIngestionError(
          'fcc_source_hash_failed',
          `Could not hash "${artifact.fileName}": ${(hashErr as Error).message}`,
        );
      }

      const storagePath = `${SOURCE_KEY}/${asOfDate}/${sha256.slice(0, 12)}/${artifact.fileName}`;
      const finalPath = await ports.putEvidence(
        storagePath,
        res.bytes,
        res.contentType ?? 'application/zip',
      );

      stored.push({
        fileName: artifact.fileName,
        storagePath: finalPath,
        sha256,
        byteSize: res.bytes.byteLength,
        role: artifact.role,
        fileId: artifact.fileId,
      });

      if (artifact.role === 'fixed_summary_by_geography') {
        try {
          csvText = await ports.unzipCsv(res.bytes);
        } catch (zipErr) {
          throw new FccIngestionError(
            'fcc_source_parse_failed',
            `Could not decompress "${artifact.fileName}": ${(zipErr as Error).message}`,
          );
        }
      }
    }

    if (!csvText) {
      throw new FccIngestionError(
        'fcc_source_parse_failed',
        'No county summary CSV was extracted from the downloaded FCC evidence.',
      );
    }

    const contentHash = await ports.sha256(
      new TextEncoder().encode(
        aggregateArtifactIdentity(stored.map((s) => ({ fileName: s.fileName, sha256: s.sha256 }))),
      ),
    );

    // ── 6. Derivation + validation (throws before any write) ──
    const { metrics, summary } = deriveNevadaCounties(csvText);

    // ── 7. Snapshot provenance (raw evidence is referenced, not inlined) ──
    const snapshotId = await ports.insertSnapshot({
      source_id: source.id,
      retrieved_at: ports.now().toISOString(),
      source_url: fccEndpoints.listAvailabilityData(asOfDate),
      http_status: 200,
      content_type: 'application/zip',
      raw_payload: {
        note: 'Raw bytes are stored immutably in Storage; see storage_bucket/storage_path and source_artifacts.',
        as_of_date: asOfDate,
      },
      content_hash: contentHash,
      record_count: metrics.length,
      source_version: asOfDate,
      effective_date: asOfDate,
      storage_bucket: EVIDENCE_BUCKET,
      storage_path: stored[0]?.storagePath ?? null,
      acquisition_protocol: ACQUISITION_PROTOCOL_VERSION,
      source_artifacts: {
        endpoints: {
          list_as_of_dates: fccEndpoints.listAsOfDates(),
          list_availability_data: fccEndpoints.listAvailabilityData(asOfDate),
          download_file: fccEndpoints.downloadFile('{file_id}'),
        },
        auth_header_names: ['username', 'hash_value'],
        artifacts: stored,
        derivation: summary,
        technology_treatment: TECHNOLOGY_TREATMENT,
      },
    });

    // ── 8. Compatibility boundary + atomic replacement ──
    const carried = await ports.getCarriedValues();
    const comparison = buildComparison(
      metrics,
      carried.map((c) => ({
        county_key: c.county_key,
        pct_100_20_plus: (c as unknown as Record<string, number>).pct_100_20_plus ?? null,
        pct_25_3_to_100_20: (c as unknown as Record<string, number>).pct_25_3_to_100_20 ?? null,
        pct_below_25_3: (c as unknown as Record<string, number>).pct_below_25_3 ?? null,
      })) as never,
    );
    const rows = toNormalizedRows(metrics, carried);

    if (options.dryRun) {
      await ports.completeRun(runId, {
        status: 'succeeded',
        completed_at: ports.now().toISOString(),
        run_type: 'dry_run',
        records_received: metrics.length,
        records_accepted: metrics.length,
        records_rejected: 0,
        content_hash: contentHash,
        source_version: asOfDate,
        transformation_version: DERIVATION_VERSION,
        run_metadata: { dry_run: true, derivation: summary, artifacts: stored },
      });
      return {
        ok: true,
        source_key: SOURCE_KEY,
        as_of_date: asOfDate,
        snapshot_id: snapshotId,
        run_id: runId,
        records_written: 0,
        artifacts: stored,
        derivation: summary,
        content_hash: contentHash,
        comparison,
      };
    }

    let written = 0;
    try {
      written = await ports.replaceNormalized({
        source_id: source.id,
        snapshot_id: snapshotId,
        rows,
        effective_date: asOfDate,
        source_version: asOfDate,
      });
    } catch (persistErr) {
      throw new FccIngestionError(
        'fcc_persistence_failed',
        `Atomic replacement failed; the previous normalized dataset is unchanged: ${(persistErr as Error).message}`,
      );
    }

    // ── 9. Run + source health ──
    const completedAt = ports.now().toISOString();
    await ports.completeRun(runId, {
      status: 'succeeded',
      completed_at: completedAt,
      records_received: metrics.length,
      records_accepted: metrics.length,
      records_rejected: 0,
      records_updated: written,
      content_hash: contentHash,
      source_version: asOfDate,
      transformation_version: DERIVATION_VERSION,
      run_metadata: { derivation: summary, artifacts: stored, comparison_rows: comparison.length },
    });
    await ports.updateSourceHealth(source.id, {
      status: 'active',
      last_retrieved_at: completedAt,
      last_successful_ingestion_at: completedAt,
      last_record_count: written,
      content_hash: contentHash,
      source_version: asOfDate,
      transformation_version: DERIVATION_VERSION,
      effective_date: asOfDate,
      is_stale: false,
      internalization_target: 'internalized',
    });

    return {
      ok: true,
      source_key: SOURCE_KEY,
      as_of_date: asOfDate,
      snapshot_id: snapshotId,
      run_id: runId,
      records_written: written,
      artifacts: stored,
      derivation: summary,
      content_hash: contentHash,
      comparison,
    };
  } catch (err) {
    return fail(err);
  }
};
