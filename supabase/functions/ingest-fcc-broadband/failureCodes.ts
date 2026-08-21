/**
 * Phase 2A.1 ingestion failure taxonomy.
 *
 * Every operational failure of the FCC acquisition chain resolves to exactly
 * one of these codes so `data_source_runs.error_summary` and the Admin Data
 * Sources surface can distinguish *where* the chain broke.
 *
 * Failure messages are operator-facing. They must never contain credential
 * values, Authorization headers, or any FCC secret.
 */

export const FCC_FAILURE_CODES = [
  'fcc_credentials_missing',
  'fcc_authentication_failed',
  'fcc_release_discovery_failed',
  'fcc_no_valid_release',
  'fcc_manifest_failed',
  'fcc_nevada_files_missing',
  'fcc_download_failed',
  'fcc_source_hash_failed',
  'fcc_source_parse_failed',
  'fcc_validation_failed',
  'fcc_transformation_failed',
  'fcc_persistence_failed',
] as const;

export type FccFailureCode = (typeof FCC_FAILURE_CODES)[number];

/** Ingestion stage each code belongs to (used for run_metadata). */
export const FCC_FAILURE_STAGE: Record<FccFailureCode, string> = {
  fcc_credentials_missing: 'credentials',
  fcc_authentication_failed: 'authenticate',
  fcc_release_discovery_failed: 'discover_release',
  fcc_no_valid_release: 'select_release',
  fcc_manifest_failed: 'discover_manifest',
  fcc_nevada_files_missing: 'select_nevada_files',
  fcc_download_failed: 'download',
  fcc_source_hash_failed: 'hash',
  fcc_source_parse_failed: 'parse',
  fcc_validation_failed: 'validate',
  fcc_transformation_failed: 'transform',
  fcc_persistence_failed: 'persist',
};

export class FccIngestionError extends Error {
  code: FccFailureCode;
  stage: string;
  detail?: Record<string, unknown>;

  constructor(code: FccFailureCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'FccIngestionError';
    this.code = code;
    this.stage = FCC_FAILURE_STAGE[code];
    this.detail = detail;
  }
}

/**
 * Redaction guard. Applied to every message before it reaches the database,
 * a log line, or an HTTP response body.
 */
export const redactCredentials = (
  message: string,
  secrets: (string | undefined | null)[],
): string => {
  let out = String(message ?? '');
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      out = out.split(secret).join('[redacted]');
    }
  }
  // Defensive: strip anything that looks like a credential query parameter.
  out = out.replace(/(username|hash_value|hashValue|token|api[_-]?key)=[^\s&]+/gi, '$1=[redacted]');
  return out;
};
