/**
 * Source-trust tiers for Behavioral Health ingestion.
 *
 * Trusted partners (e.g. SilverSummit) supply pre-curated rosters where
 * formatting drift and category ambiguity are noise — but address gaps,
 * coordinate mismatches, and missing required fields still matter for
 * map accuracy. This utility lets us downgrade *non-critical* warnings
 * for trusted sources without touching critical errors or auto-promoting.
 */

import type { StagingBhRow, ValidationMessage } from '@/types/mappingPipeline';

/** Configured trusted sources. Match against source_file_name OR verification_source. */
export const TRUSTED_BH_SOURCES = ['silversummit'] as const;

export type BhSourceTrust = 'high' | 'standard';

const matchesTrusted = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const lc = value.toLowerCase();
  return TRUSTED_BH_SOURCES.some((s) => lc.includes(s));
};

/**
 * Derive trust from the row itself. Looks at source_file_name first
 * (set during CSV ingest), then falls back to verification_source.
 */
export const getBhSourceTrust = (row: Partial<StagingBhRow>): BhSourceTrust => {
  if (matchesTrusted(row.source_file_name) || matchesTrusted(row.verification_source)) {
    return 'high';
  }
  return 'standard';
};

/** Fields whose warnings are formatting/ambiguity noise — safe to downgrade. */
const NON_CRITICAL_WARNING_FIELDS = new Set<string>([
  'state',
  'zip',
  'bh_entity_type',
  'category_raw',
  'category_mapped',
]);

/**
 * Fields that must NEVER be downgraded — these block accurate mapping or
 * reflect duplicate / required-field problems.
 *
 * Note: errors are always preserved regardless of trust.
 */
const CRITICAL_WARNING_FIELDS = new Set<string>([
  'address',
  'latitude',
  'longitude',
  'latitude/longitude',
  'name',
  'duplicate',
]);

/**
 * For trusted sources: drop non-critical warnings, keep errors and
 * critical warnings untouched. For standard sources: pass through.
 */
export const applyTrustToBhMessages = (
  messages: ValidationMessage[],
  trust: BhSourceTrust,
): ValidationMessage[] => {
  if (trust !== 'high') return messages;
  return messages.filter((m) => {
    if (m.severity === 'error') return true;
    const field = m.field ?? '';
    if (CRITICAL_WARNING_FIELDS.has(field)) return true;
    if (NON_CRITICAL_WARNING_FIELDS.has(field)) return false;
    // Unknown field — keep to avoid silently hiding novel signals.
    return true;
  });
};
