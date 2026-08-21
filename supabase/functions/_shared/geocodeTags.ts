/**
 * Phase 2D — structured `[geocode:...]` tag handling for `access_notes`.
 *
 * `access_notes` may contain human operational content. Geocoding must NEVER
 * wipe the whole field to clear a machine tag: only the structured token is
 * ever replaced or removed.
 *
 * Mirror of the client-side helpers in `src/utils/geocodeTags.ts` — a test
 * asserts both implementations behave identically.
 */
export const GEOCODE_TAG_PREFIX = '[geocode:';

const TAG_RE = /\[geocode:[^\]]*\]/gi;

/** Remove ONLY the structured geocode token; all other text is preserved. */
export const stripGeocodeTag = (notes: string | null | undefined): string => {
  if (notes == null) return '';
  return String(notes)
    .replace(TAG_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Replace (or add) the structured geocode token while preserving human notes.
 * Returns null when the result would be empty, so an untouched empty field is
 * not turned into an empty string.
 */
export const stampGeocodeTag = (
  notes: string | null | undefined,
  strategy: string,
  confidence: string,
  date: string = new Date().toISOString().slice(0, 10),
): string => {
  const base = stripGeocodeTag(notes);
  const tag = `${GEOCODE_TAG_PREFIX}${strategy}|${confidence}|${date}]`;
  return base.length > 0 ? `${base}\n${tag}` : tag;
};

export const parseGeocodeTag = (
  notes: string | null | undefined,
): { strategy: string; confidence: string; date: string } | null => {
  if (!notes) return null;
  const m = String(notes).match(/\[geocode:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/i);
  if (!m) return null;
  return { strategy: m[1], confidence: m[2].toLowerCase(), date: m[3] };
};
