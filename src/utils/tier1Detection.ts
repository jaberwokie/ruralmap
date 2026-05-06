/**
 * Detect whether a provider/facility record qualifies as Tier 1 from
 * loose CSV / provider metadata fields.
 *
 * Strict rules:
 *  - Never infer Tier 1 from distance, county, or provider type alone.
 *  - Only explicit textual signals from supported fields qualify.
 *  - Returns `true` only when an accepted token is found.
 */

const ACCEPTED_TOKENS = [
  'tier 1',
  'tier1',
  'high priority',
  'priority',
  'preferred',
  'anchor provider',
];

const FIELD_KEYS = [
  'tier',
  'provider_tier',
  'network_tier',
  'priority',
  'tags',
];

const matches = (raw: unknown): boolean => {
  if (raw == null) return false;
  const s = String(raw).toLowerCase().trim();
  if (!s) return false;
  return ACCEPTED_TOKENS.some((t) => s === t || s.includes(t));
};

/**
 * Detect Tier 1 from a free-form record. Returns true only when an
 * explicit token is present in one of the supported fields.
 */
export const detectTier1 = (record: Record<string, unknown> | null | undefined): boolean => {
  if (!record) return false;
  for (const k of FIELD_KEYS) {
    // case-insensitive key lookup
    const hit = Object.keys(record).find((rk) => rk.toLowerCase() === k);
    if (hit && matches(record[hit])) return true;
  }
  return false;
};
