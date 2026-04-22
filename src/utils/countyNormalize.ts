/**
 * Canonical county-name normalizer.
 *
 * Used everywhere a county name from a stored record (static dataset, live
 * verified import, or freeform CSV) is compared against the application's
 * `selectedCounty` string. Both sides of the comparison MUST flow through
 * `normalizeCounty()` — never compare raw `county` values with `===` for
 * data that may have been ingested from external sources.
 *
 * Normalization steps:
 *   1. lowercase
 *   2. trim leading/trailing whitespace
 *   3. strip punctuation (commas, periods, parens, etc.)
 *   4. collapse internal whitespace
 *   5. remove a trailing " county" suffix
 *
 * Examples (all normalize to "nye"):
 *   "Nye"
 *   "Nye County"
 *   " nye  county "
 *   "NYE COUNTY"
 *   "Nye, County"
 */

export const normalizeCounty = (raw: string | null | undefined): string => {
  if (!raw) return '';
  let v = String(raw).toLowerCase();
  // strip punctuation → spaces, then collapse whitespace
  v = v.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  // remove trailing " county"
  v = v.replace(/\s+county$/u, '').trim();
  return v;
};

/** True when two county strings refer to the same county. */
export const sameCounty = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  const na = normalizeCounty(a);
  const nb = normalizeCounty(b);
  return na.length > 0 && na === nb;
};
