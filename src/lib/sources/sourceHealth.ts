/**
 * Source Registry — deterministic source-health calculation.
 *
 * Single source of truth for how a `data_sources` row is graded. Health is
 * CALCULATED from dates and status, never read from a manually-edited opinion
 * field. `data_sources.is_stale` / `status` are stored for query convenience
 * only; this helper is authoritative for display.
 *
 * Nothing in the live map, Decision Assist, coverage, or scoring pipeline
 * imports this module. The registry is governance metadata only.
 */

export type SourceHealth = 'current' | 'review_due' | 'stale' | 'failing' | 'unknown';

export const SOURCE_HEALTH_LABEL: Record<SourceHealth, string> = {
  current: 'Current',
  review_due: 'Review Due',
  stale: 'Stale',
  failing: 'Failing',
  unknown: 'Unknown',
};

/** Minimal shape needed to grade a source. Matches `data_sources` columns. */
export interface SourceHealthInput {
  status?: string | null;
  stale_after_days?: number | null;
  last_verified_at?: string | null;
  last_successful_ingestion_at?: string | null;
  last_failed_ingestion_at?: string | null;
  next_review_at?: string | null;
}

const parse = (value?: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const DAY_MS = 86_400_000;

/**
 * Grade a source. Precedence, highest first:
 *  1. `failing` / `disabled` status (explicit operational state)
 *  2. a failed ingestion newer than the last successful ingestion → failing
 *  3. no freshness evidence at all → unknown
 *  4. freshness older than `stale_after_days` → stale
 *  5. `next_review_at` in the past → review_due
 *  6. otherwise → current
 */
export const calculateSourceHealth = (
  source: SourceHealthInput,
  now: Date = new Date(),
): SourceHealth => {
  const nowMs = now.getTime();
  const status = source.status ?? null;

  if (status === 'failing' || status === 'disabled') return 'failing';

  const lastSuccess = parse(source.last_successful_ingestion_at);
  const lastFailure = parse(source.last_failed_ingestion_at);
  if (lastFailure !== null && (lastSuccess === null || lastFailure > lastSuccess)) {
    return 'failing';
  }

  const lastVerified = parse(source.last_verified_at);
  const freshness =
    lastVerified !== null && lastSuccess !== null
      ? Math.max(lastVerified, lastSuccess)
      : (lastVerified ?? lastSuccess);

  const nextReview = parse(source.next_review_at);

  if (freshness === null) {
    // No verification or ingestion evidence. A pending review date alone is
    // not enough to call a source current.
    return nextReview !== null && nextReview < nowMs ? 'review_due' : 'unknown';
  }

  const staleAfter = source.stale_after_days;
  if (typeof staleAfter === 'number' && staleAfter > 0) {
    if (nowMs - freshness > staleAfter * DAY_MS) return 'stale';
  }

  if (nextReview !== null && nextReview < nowMs) return 'review_due';

  return 'current';
};

/** Governance gaps worth surfacing to Admin. Never shown on the public map. */
export interface SourceWarning {
  code:
    | 'stale'
    | 'review_overdue'
    | 'runtime_critical_failing'
    | 'missing_credential_reference'
    | 'missing_owner'
    | 'no_successful_ingestion';
  message: string;
}

export interface SourceWarningInput extends SourceHealthInput {
  source_name: string;
  runtime_dependency?: boolean | null;
  requires_credentials?: boolean | null;
  credential_reference?: string | null;
  owner_role?: string | null;
  owner_name?: string | null;
  internalization_target?: string | null;
}

export const getSourceWarnings = (
  source: SourceWarningInput,
  now: Date = new Date(),
): SourceWarning[] => {
  const health = calculateSourceHealth(source, now);
  const warnings: SourceWarning[] = [];
  const name = source.source_name;

  if (health === 'stale') {
    warnings.push({ code: 'stale', message: `${name} is stale.` });
  }

  const nextReview = parse(source.next_review_at);
  if (nextReview !== null && nextReview < now.getTime()) {
    warnings.push({ code: 'review_overdue', message: `${name} review date has passed.` });
  }

  if (source.runtime_dependency && health === 'failing') {
    warnings.push({
      code: 'runtime_critical_failing',
      message: `${name} is runtime-critical and currently failing.`,
    });
  }

  if (source.requires_credentials && !source.credential_reference) {
    warnings.push({
      code: 'missing_credential_reference',
      message: `${name} requires credentials but has no documented credential reference.`,
    });
  }

  if (!source.owner_role && !source.owner_name) {
    warnings.push({ code: 'missing_owner', message: `${name} has no documented owner.` });
  }

  const ingestTargets = ['ingest_internal', 'fully_internal'];
  if (
    source.internalization_target &&
    ingestTargets.includes(source.internalization_target) &&
    !source.last_successful_ingestion_at
  ) {
    warnings.push({
      code: 'no_successful_ingestion',
      message: `${name} is targeted for ingestion but has no successful ingestion history.`,
    });
  }

  return warnings;
};

export const summarizeHealth = (
  sources: SourceHealthInput[],
  now: Date = new Date(),
): Record<SourceHealth, number> => {
  const counts: Record<SourceHealth, number> = {
    current: 0,
    review_due: 0,
    stale: 0,
    failing: 0,
    unknown: 0,
  };
  for (const source of sources) counts[calculateSourceHealth(source, now)] += 1;
  return counts;
};
