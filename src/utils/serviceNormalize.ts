/**
 * Normalization helpers for the Nye rural ingestion pipeline (v5).
 *
 * Pure string utilities — no Cloud calls. Used by:
 *  - serviceHeaderResolver (header normalization for alias matching)
 *  - serviceUpsertMatch    (comparison normalization for fallback matching)
 *  - mappingPipelineCsv    (row-level normalization + noise filtering)
 *
 * IMPORTANT: All normalization is comparison-only. Original raw fields are
 * preserved on the staging row.
 */

const COMMON_ORG_SUFFIXES = [
  'incorporated', 'inc', 'llc', 'l.l.c', 'llp', 'corp', 'corporation', 'company', 'co',
  'center', 'centre', 'clinic', 'services', 'service', 'foundation', 'association',
  'organization', 'org',
];

const ADDRESS_SUFFIX_MAP: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr',
  lane: 'ln', court: 'ct', place: 'pl', highway: 'hwy', parkway: 'pkwy',
  suite: 'ste', apartment: 'apt',
};

const NOISE_PHRASES = new Set([
  '', 'n/a', 'na', 'none', 'unknown', 'unk',
  'call for info', 'call for information', 'tbd', 'tba',
  'see notes', 'see website', 'no info', 'no information',
]);

/** Lowercase, replace spaces/hyphens with `_`, strip remaining punctuation. */
export const normalizeHeader = (s: string): string =>
  s.trim().toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

/**
 * Normalize an organization / provider name for fuzzy comparison.
 * Lowercase → strip punctuation → drop common org suffixes.
 */
export const normalizeName = (s: string | null | undefined): string => {
  if (!s) return '';
  let v = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMMON_ORG_SUFFIXES) {
      const re = new RegExp(`(^|\\s)${suffix}(\\s|$)`, 'g');
      const next = v.replace(re, ' ').replace(/\s+/g, ' ').trim();
      if (next !== v) { v = next; changed = true; }
    }
  }
  return v;
};

/** Phone → digits only (preserves the canonical compare key). */
export const normalizePhone = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.replace(/\D+/g, '');
};

/**
 * Address normalization for comparison only.
 * Lowercase → strip punctuation → collapse whitespace → standardize suffix tokens.
 */
export const normalizeAddress = (s: string | null | undefined): string => {
  if (!s) return '';
  let v = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  v = v.split(' ').map((tok) => ADDRESS_SUFFIX_MAP[tok] ?? tok).join(' ');
  return v;
};

/**
 * Service tag normalization. Accepts comma, semicolon, or pipe-delimited input.
 * Output: lowercase, trimmed, deduped, joined with " | ".
 */
export const normalizeTags = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const parts = s.split(/[|,;]+/g)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0 && !isNoisePhrase(p));
  if (parts.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out.join(' | ');
};

/** Noise check used by the controlled-append helper and tag normalizer. */
export const isNoisePhrase = (raw: string | null | undefined): boolean => {
  if (raw == null) return true;
  const v = raw.trim().toLowerCase();
  if (NOISE_PHRASES.has(v)) return true;
  // punctuation/whitespace only
  if (/^[\s\p{P}]+$/u.test(v)) return true;
  return false;
};

/**
 * Map a freeform category string into one of the canonical service categories.
 * Returns null when no rule matches (caller may apply a default).
 */
export const normalizeCategory = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const lc = raw.toLowerCase();
  if (/(food|pantry|meal)/.test(lc)) return 'food';
  if (/(mental health|counsel|behavioral)/.test(lc)) return 'behavioral_health';
  if (/(substance|sud|detox|mat\b|recovery)/.test(lc)) return 'substance_use';
  if (/(housing|shelter)/.test(lc)) return 'housing';
  if (/(transport|ride|mobility)/.test(lc)) return 'transport';
  if (/(legal|attorney|law)/.test(lc)) return 'legal';
  if (/(employ|job|work)/.test(lc)) return 'employment';
  if (/(utilit|financ|benefit|assist)/.test(lc)) return 'financial_support';
  if (/(govern|public|welfare|dwss)/.test(lc)) return 'public_service';
  return null;
};

/**
 * Controlled append: fold `incoming` into `existing` text using " | " as
 * the delimiter. Skips noise, prevents duplicate phrases (substring match,
 * case-insensitive), enforces a max length cap.
 */
export const controlledAppend = (
  existing: string | null | undefined,
  incoming: string | null | undefined,
  opts: { maxLength?: number } = {},
): string | null => {
  const max = opts.maxLength ?? 4000;
  const base = (existing ?? '').trim();
  const add = (incoming ?? '').trim();
  if (!add || isNoisePhrase(add)) return base.length > 0 ? base : null;

  const segments = add.split(/\s*\|\s*/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isNoisePhrase(s));

  if (segments.length === 0) return base.length > 0 ? base : null;

  const baseLc = base.toLowerCase();
  const accepted: string[] = [];
  for (const seg of segments) {
    const segLc = seg.toLowerCase();
    if (baseLc.includes(segLc)) continue;
    if (accepted.some((a) => a.toLowerCase() === segLc)) continue;
    accepted.push(seg);
  }

  if (accepted.length === 0) return base.length > 0 ? base : null;
  const merged = base.length > 0 ? `${base} | ${accepted.join(' | ')}` : accepted.join(' | ');
  return merged.length > max ? merged.slice(0, max) : merged;
};
