/**
 * Client-safe `[geocode:...]` tag helpers for `access_notes`.
 *
 * Phase 2D: this module contains NO network behavior. The browser never talks
 * to an external geocoder; it only reads/writes the structured tag token that
 * the admin UI displays.
 *
 * DATA INTEGRITY: `access_notes` may contain human operational content. Only
 * the structured `[geocode:...]` token is ever replaced or removed — the rest
 * of the field is preserved verbatim.
 *
 * Mirrors `supabase/functions/_shared/geocodeTags.ts`.
 */
export const GEOCODE_TAG_PREFIX = '[geocode:';

const TAG_RE = /\[geocode:[^\]]*\]/gi;

export type GeocodeStrategy =
  | 'address_full'
  | 'city_county_fallback'
  | 'census_onelineaddress'
  | 'internal_cache'
  | 'failed';

export type GeocodeConfidence = 'high' | 'medium' | 'low';

/** Remove ONLY the structured geocode token; all other text is preserved. */
export const stripGeocodeTag = (notes: string | null | undefined): string => {
  if (notes == null) return '';
  return String(notes)
    .replace(TAG_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** Replace (or add) the structured geocode token, preserving human notes. */
export const stampGeocodeTag = (
  notes: string | null | undefined,
  strategy: GeocodeStrategy | string,
  confidence: 'high' | 'low' | string,
  date: string = new Date().toISOString().slice(0, 10),
): string => {
  const base = stripGeocodeTag(notes);
  const tag = `${GEOCODE_TAG_PREFIX}${strategy}|${confidence}|${date}]`;
  return base.length > 0 ? `${base}\n${tag}` : tag;
};

export const parseGeocodeTag = (
  notes: string | null | undefined,
): { strategy: GeocodeStrategy; confidence: 'high' | 'low'; date: string } | null => {
  if (!notes) return null;
  const m = String(notes).match(/\[geocode:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/i);
  if (!m) return null;
  const conf = m[2].toLowerCase();
  return {
    strategy: m[1] as GeocodeStrategy,
    confidence: conf === 'low' ? 'low' : 'high',
    date: m[3],
  };
};

export const isGeocodeFailed = (notes: string | null | undefined): boolean =>
  !!notes && /\[geocode:failed/i.test(notes);
