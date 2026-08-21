/**
 * FCC broadband ingestion orchestration.
 *
 * Pure orchestration over injected ports so every stage (retrieval failure,
 * malformed payload, transformation failure, persistence failure) is testable
 * without Deno or a live database.
 *
 * A run is marked successful ONLY after retrieval + validation +
 * transformation + normalized persistence have all succeeded.
 */

import {
  BroadbandValidationError,
  TRANSFORMATION_VERSION,
  contentHash,
  parsePayload,
  validateAndTransform,
  type NormalizedBroadbandRow,
} from './transform.ts';

export const SOURCE_KEY = 'fcc_broadband';

export interface FetchResult {
  ok: boolean;
  status: number;
  contentType: string | null;
  body: string;
}

export interface RegistrySource {
  id: string;
  source_url: string | null;
}

export interface IngestionPorts {
  getSource(sourceKey: string): Promise<RegistrySource | null>;
  fetchSource(url: string): Promise<FetchResult>;
  startRun(sourceId: string, startedAt: string): Promise<string>;
  insertSnapshot(input: {
    source_id: string;
    retrieved_at: string;
    source_url: string;
    http_status: number;
    content_type: string | null;
    raw_payload: unknown;
    content_hash: string;
    record_count: number | null;
    source_version: string | null;
    effective_date: string | null;
  }): Promise<string>;
  replaceNormalized(input: {
    source_id: string;
    snapshot_id: string;
    rows: NormalizedBroadbandRow[];
    effective_date: string | null;
    source_version: string | null;
  }): Promise<number>;
  completeRun(
    runId: string,
    patch: {
      status: 'success' | 'failed';
      completed_at: string;
      records_received?: number | null;
      records_accepted?: number | null;
      records_created?: number | null;
      error_count?: number;
      error_summary?: string | null;
      content_hash?: string | null;
      source_version?: string | null;
      transformation_version?: string | null;
      run_metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
  updateSourceHealth(sourceId: string, patch: Record<string, unknown>): Promise<void>;
  now(): Date;
}

export interface IngestionRequest {
  /** Authoritative retrieval URL. Falls back to data_sources.source_url. */
  sourceUrl?: string | null;
  /** Only forwarded when the operator/authoritative response establishes it. */
  effectiveDate?: string | null;
  sourceVersion?: string | null;
}

export interface IngestionResult {
  ok: boolean;
  runId: string | null;
  snapshotId: string | null;
  contentHash: string | null;
  recordCount: number | null;
  sourceUrl: string | null;
  stage: string;
  errorCode?: string;
  error?: string;
}

class StageError extends Error {
  stage: string;
  code: string;
  constructor(stage: string, code: string, message: string) {
    super(message);
    this.stage = stage;
    this.code = code;
  }
}

export const runBroadbandIngestion = async (
  ports: IngestionPorts,
  request: IngestionRequest = {},
): Promise<IngestionResult> => {
  const startedAt = ports.now().toISOString();

  const source = await ports.getSource(SOURCE_KEY);
  if (!source) {
    return {
      ok: false, runId: null, snapshotId: null, contentHash: null, recordCount: null,
      sourceUrl: null, stage: 'resolve_source', errorCode: 'source_not_registered',
      error: `No data_sources row with source_key "${SOURCE_KEY}"`,
    };
  }

  const sourceUrl = (request.sourceUrl ?? source.source_url ?? '').trim();
  if (!sourceUrl) {
    // The authoritative FCC URL is not recorded in the registry and we do not
    // invent one. Fail before opening a run.
    return {
      ok: false, runId: null, snapshotId: null, contentHash: null, recordCount: null,
      sourceUrl: null, stage: 'resolve_source_url', errorCode: 'source_url_unknown',
      error: 'No authoritative source URL. Set data_sources.source_url for fcc_broadband or pass source_url explicitly.',
    };
  }

  const runId = await ports.startRun(source.id, startedAt);
  let snapshotId: string | null = null;
  let hash: string | null = null;
  let received: number | null = null;

  try {
    // ── Retrieval ──
    let fetched: FetchResult;
    try {
      fetched = await ports.fetchSource(sourceUrl);
    } catch (err) {
      throw new StageError('retrieve', 'network_error', (err as Error).message);
    }
    if (!fetched.ok) {
      throw new StageError('retrieve', 'http_error', `Authoritative source returned HTTP ${fetched.status}`);
    }

    hash = await contentHash(fetched.body);
    const payload = parsePayload(fetched.body);
    received = Array.isArray(payload) ? payload.length : null;

    // ── Immutable snapshot (every retrieval is preserved) ──
    snapshotId = await ports.insertSnapshot({
      source_id: source.id,
      retrieved_at: ports.now().toISOString(),
      source_url: sourceUrl,
      http_status: fetched.status,
      content_type: fetched.contentType,
      raw_payload: payload,
      content_hash: hash,
      record_count: received,
      source_version: request.sourceVersion ?? null,
      effective_date: request.effectiveDate ?? null,
    });

    // ── Validation + transformation ──
    const rows = validateAndTransform(payload);

    // ── Atomic normalized persistence ──
    const inserted = await ports.replaceNormalized({
      source_id: source.id,
      snapshot_id: snapshotId,
      rows,
      effective_date: request.effectiveDate ?? null,
      source_version: request.sourceVersion ?? null,
    });

    const completedAt = ports.now().toISOString();
    await ports.completeRun(runId, {
      status: 'success',
      completed_at: completedAt,
      records_received: received,
      records_accepted: rows.length,
      records_created: inserted,
      error_count: 0,
      content_hash: hash,
      source_version: request.sourceVersion ?? null,
      transformation_version: TRANSFORMATION_VERSION,
      run_metadata: { source_url: sourceUrl, snapshot_id: snapshotId, http_status: fetched.status },
    });

    // Evidence-backed source-health fields only.
    const healthPatch: Record<string, unknown> = {
      last_retrieved_at: completedAt,
      last_successful_ingestion_at: completedAt,
      last_record_count: inserted,
      content_hash: hash,
      transformation_version: TRANSFORMATION_VERSION,
      status: 'current',
      is_stale: false,
    };
    if (request.effectiveDate) healthPatch.effective_date = request.effectiveDate;
    if (request.sourceVersion) healthPatch.source_version = request.sourceVersion;
    await ports.updateSourceHealth(source.id, healthPatch);

    return {
      ok: true, runId, snapshotId, contentHash: hash, recordCount: inserted,
      sourceUrl, stage: 'complete',
    };
  } catch (err) {
    const stage = err instanceof StageError
      ? err.stage
      : err instanceof BroadbandValidationError
        ? 'validate'
        : 'persist';
    const code = err instanceof StageError
      ? err.code
      : err instanceof BroadbandValidationError
        ? err.code
        : 'persistence_error';
    const message = (err as Error).message;
    const failedAt = ports.now().toISOString();

    await ports.completeRun(runId, {
      status: 'failed',
      completed_at: failedAt,
      records_received: received,
      records_accepted: 0,
      records_created: 0,
      error_count: 1,
      error_summary: `${stage}: ${message}`,
      content_hash: hash,
      transformation_version: TRANSFORMATION_VERSION,
      run_metadata: { source_url: sourceUrl, snapshot_id: snapshotId, error_code: code },
    });

    const failurePatch: Record<string, unknown> = {
      last_failed_ingestion_at: failedAt,
      status: 'failing',
    };
    // Retrieval demonstrably happened if we got as far as hashing a body.
    if (hash) failurePatch.last_retrieved_at = failedAt;
    await ports.updateSourceHealth(source.id, failurePatch);

    return {
      ok: false, runId, snapshotId, contentHash: hash, recordCount: null,
      sourceUrl, stage, errorCode: code, error: message,
    };
  }
};
