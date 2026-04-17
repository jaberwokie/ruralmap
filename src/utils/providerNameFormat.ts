/**
 * Provider name display + match utilities (display-only).
 *
 * - `formatProviderName(raw)` produces a readable rendering that preserves
 *   common acronyms and business suffixes. Source data is never mutated.
 * - `normalizeProviderForMatch(raw)` produces a stable matching key for
 *   resolving utilization provider names to mapped facility entities.
 *
 * Strict rules:
 *  - No fuzzy matching, no Levenshtein, no partial substring matching.
 *  - Resolution is exact on the controlled normalized form only.
 */

/** Tokens that should always render in uppercase when displayed as a whole word. */
const ACRONYM_TOKENS = new Set<string>([
  'IHS', 'DHHS', 'HHS', 'FQHC', 'CAH', 'NV', 'UT', 'CA', 'AZ', 'OR', 'ID',
  'LLC', 'LLP', 'PLLC', 'INC', 'CORP', 'PC', 'PA', 'LP',
  'MD', 'DO', 'RN', 'LPCC', 'LCSW', 'CMS', 'VA', 'NPI', 'BH', 'ED', 'ER',
  'ICU', 'NRHP', 'DPBH', 'US', 'USA',
]);

/** Tokens whose canonical casing differs from plain uppercase / title case. */
const SPECIAL_CASE_TOKENS: Record<string, string> = {
  INCORPORATED: 'Incorporated',
  CORPORATION: 'Corporation',
  COMPANY: 'Company',
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  TRIBE: 'Tribe',
  TRIBES: 'Tribes',
  TRIBAL: 'Tribal',
};

/** Title-case a single ordinary word, preserving any internal apostrophes. */
const titleWord = (w: string): string => {
  if (!w) return w;
  // Hyphenated compounds: title-case each segment
  if (w.includes('-')) {
    return w.split('-').map(titleWord).join('-');
  }
  // Apostrophe contractions / possessives: capitalize first letter only
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

/**
 * Format a provider name for display.
 *
 * - Preserves known acronyms (IHS, DHHS, FQHC, etc.) in uppercase
 * - Renders standard business suffixes with conventional casing
 * - Title-cases all other words
 * - Does not mutate input
 */
export function formatProviderName(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  // If the input is mixed-case already (not ALL CAPS / not all lower), respect
  // it but still normalize whitespace. ALL CAPS or all lowercase get reformatted.
  const isAllUpper = trimmed === trimmed.toUpperCase();
  const isAllLower = trimmed === trimmed.toLowerCase();
  const shouldReformat = isAllUpper || isAllLower;

  return trimmed
    .split(' ')
    .map((word) => {
      // Strip leading/trailing punctuation for token comparison, preserve it on output
      const leadMatch = word.match(/^([^A-Za-z0-9]*)([A-Za-z0-9'\-.]*)([^A-Za-z0-9]*)$/);
      if (!leadMatch) return word;
      const [, lead, core, trail] = leadMatch;
      if (!core) return word;

      const upperCore = core.toUpperCase();

      if (ACRONYM_TOKENS.has(upperCore)) {
        return `${lead}${upperCore}${trail}`;
      }
      if (SPECIAL_CASE_TOKENS[upperCore]) {
        return `${lead}${SPECIAL_CASE_TOKENS[upperCore]}${trail}`;
      }
      if (!shouldReformat) {
        // Preserve original casing for mixed-case input
        return word;
      }
      return `${lead}${titleWord(core)}${trail}`;
    })
    .join(' ');
}

/** Strict exact-match normalization (lowercase, single-spaced, trimmed). */
export function normalizeProviderExact(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Controlled alias normalization for resolution-only fallback matching. */
const SUFFIXES_TO_STRIP = new Set<string>([
  'llc', 'llp', 'pllc', 'inc', 'incorporated', 'corp', 'corporation', 'pc',
  'pa', 'lp', 'co',
]);

const ALIAS_MAP: Record<string, string> = {
  'and': '&',
  // DHHS / HHS / IHS canonical forms (already lowercase here)
  // Keep as-is — they normalize identically on both sides via lowercase.
};

/**
 * Produce a controlled alias-normalized matching key. This is intentionally
 * conservative — never fuzzy. Used only as a secondary resolution attempt.
 */
export function normalizeProviderForMatch(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  // Replace ampersand handling: collapse "and" / "&" into a single canonical "&"
  s = s.replace(/\s+&\s+/g, ' and ');
  // Strip all punctuation except spaces and word chars
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // Apply alias map at token level
  const tokens = s.split(' ').map((t) => ALIAS_MAP[t] ?? t);
  // Strip business suffixes from the end (repeat in case multiple)
  while (tokens.length > 1 && SUFFIXES_TO_STRIP.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}
