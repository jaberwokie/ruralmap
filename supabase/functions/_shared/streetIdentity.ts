/**
 * Phase 2D.1 — deterministic street-identity comparison.
 *
 * Purpose: prove that an external forward-geocode result refers to the SAME
 * physical street as the source address. State + ZIP agreement is NOT enough:
 * an unrelated street inside the same Nevada ZIP would otherwise pass.
 *
 * Deliberately conservative and deterministic:
 *   - no fuzzy/edit-distance matching
 *   - no organization/name matching
 *   - no probabilistic scoring
 * When the evidence is insufficient the comparison REJECTS rather than guesses.
 */

/** Street-type aliases → canonical expanded form. */
const STREET_TYPES: Record<string, string> = {
  st: 'street', str: 'street', street: 'street',
  ave: 'avenue', av: 'avenue', avenue: 'avenue',
  rd: 'road', road: 'road',
  blvd: 'boulevard', boulevard: 'boulevard',
  dr: 'drive', drive: 'drive',
  ln: 'lane', lane: 'lane',
  ct: 'court', court: 'court',
  pkwy: 'parkway', pky: 'parkway', parkway: 'parkway',
  hwy: 'highway', highway: 'highway',
  cir: 'circle', circle: 'circle',
  pl: 'place', place: 'place',
  ter: 'terrace', terr: 'terrace', terrace: 'terrace',
  trl: 'trail', trail: 'trail',
  way: 'way',
  sq: 'square', square: 'square',
  plz: 'plaza', plaza: 'plaza',
  byp: 'bypass', bypass: 'bypass',
  rte: 'route', rt: 'route', route: 'route',
  loop: 'loop',
  aly: 'alley', alley: 'alley',
  expy: 'expressway', expressway: 'expressway',
  cyn: 'canyon', canyon: 'canyon',
  mtn: 'mountain', mountain: 'mountain',
};

/** Directional aliases → canonical expanded form. */
const DIRECTIONALS: Record<string, string> = {
  n: 'north', north: 'north',
  s: 'south', south: 'south',
  e: 'east', east: 'east',
  w: 'west', west: 'west',
  ne: 'northeast', northeast: 'northeast',
  nw: 'northwest', northwest: 'northwest',
  se: 'southeast', southeast: 'southeast',
  sw: 'southwest', southwest: 'southwest',
};

const UNIT_TOKENS =
  /\b(suite|ste|unit|apt|apartment|bldg|building|room|rm|floor|fl|#)\s*[\w-]*/gi;

export interface ParsedStreet {
  /** Leading house number, e.g. `1000` or `1000b`. */
  houseNumber: string | null;
  /** Normalized street-name tokens with the house number removed. */
  tokens: string[];
  /** Leading/trailing directional tokens, expanded. */
  directionals: string[];
  /** Canonical street type when present, expanded. */
  streetType: string | null;
  /** Core name tokens: no house number, no directional, no street type. */
  core: string[];
}

/**
 * Parse the STREET portion of an address. Only the first comma segment is
 * considered a street; city/state/ZIP tails are ignored.
 */
export const parseStreet = (input: string | null | undefined): ParsedStreet => {
  const first = String(input ?? '').split(',')[0] ?? '';
  const cleaned = first
    .normalize('NFKC')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(UNIT_TOKENS, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleaned) {
    return { houseNumber: null, tokens: [], directionals: [], streetType: null, core: [] };
  }

  const raw = cleaned.split(/\s+/).filter(Boolean);

  let houseNumber: string | null = null;
  let rest = raw;
  if (raw.length > 1 && /^\d+[a-z]?$/.test(raw[0])) {
    houseNumber = raw[0];
    rest = raw.slice(1);
  }

  // Expand every token deterministically.
  const tokens = rest.map((t) => DIRECTIONALS[t] ?? STREET_TYPES[t] ?? t);

  const directionals: string[] = [];
  const core: string[] = [];
  let streetType: string | null = null;

  tokens.forEach((t, i) => {
    const isDirectional = Object.values(DIRECTIONALS).includes(t);
    const isType = Object.values(STREET_TYPES).includes(t);
    // Directionals are only meaningful at the edges (N Carson St, Main St W).
    if (isDirectional && (i === 0 || i === tokens.length - 1)) {
      directionals.push(t);
      return;
    }
    // The LAST type-looking token is the street type; earlier ones are names
    // (e.g. "Highway 50" keeps `highway` as a name token when numbered).
    if (isType && i === tokens.length - 1 && core.length > 0) {
      streetType = t;
      return;
    }
    core.push(t);
  });

  return { houseNumber, tokens, directionals, streetType, core };
};

export type StreetVerdict = 'match' | 'mismatch' | 'insufficient_evidence';

export interface StreetComparison {
  house_number_match: boolean | null;
  street_name_match: boolean | null;
  verdict: StreetVerdict;
  reason: string | null;
}

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Compare a SOURCE street against an externally MATCHED street.
 *
 * Rules (all deterministic):
 *   - both house numbers present → must be exactly equal
 *   - source has a house number but match does not → insufficient evidence
 *   - core street names must be exactly equal after alias expansion
 *   - conflicting directionals → mismatch; an omitted directional on one side
 *     is treated as an omission, not a conflict (documented relaxation)
 *   - a missing/absent matched street name → insufficient evidence
 */
export const compareStreetIdentity = (
  sourceStreet: string | null | undefined,
  matchedStreet: string | null | undefined,
): StreetComparison => {
  const src = parseStreet(sourceStreet);
  const mat = parseStreet(matchedStreet);

  if (src.core.length === 0) {
    return {
      house_number_match: null,
      street_name_match: null,
      verdict: 'insufficient_evidence',
      reason: 'source_street_name_unavailable',
    };
  }
  if (mat.core.length === 0) {
    return {
      house_number_match: null,
      street_name_match: null,
      verdict: 'insufficient_evidence',
      reason: 'matched_street_name_unavailable',
    };
  }

  // House number.
  let houseMatch: boolean | null = null;
  if (src.houseNumber && mat.houseNumber) {
    houseMatch = src.houseNumber === mat.houseNumber;
    if (!houseMatch) {
      return {
        house_number_match: false,
        street_name_match: null,
        verdict: 'mismatch',
        reason: 'house_number_mismatch',
      };
    }
  } else if (src.houseNumber && !mat.houseNumber) {
    return {
      house_number_match: null,
      street_name_match: null,
      verdict: 'insufficient_evidence',
      reason: 'matched_house_number_unavailable',
    };
  }

  // Core street name must be identical after deterministic expansion.
  if (!sameSet(src.core, mat.core)) {
    return {
      house_number_match: houseMatch,
      street_name_match: false,
      verdict: 'mismatch',
      reason: 'street_name_mismatch',
    };
  }

  // Directional conflict check (only when BOTH sides declare one).
  if (src.directionals.length > 0 && mat.directionals.length > 0) {
    if (!sameSet(src.directionals, mat.directionals)) {
      return {
        house_number_match: houseMatch,
        street_name_match: false,
        verdict: 'mismatch',
        reason: 'street_directional_mismatch',
      };
    }
  }

  // Street-type conflict check (only when BOTH sides declare one).
  if (src.streetType && mat.streetType && src.streetType !== mat.streetType) {
    return {
      house_number_match: houseMatch,
      street_name_match: false,
      verdict: 'mismatch',
      reason: 'street_type_mismatch',
    };
  }

  return {
    house_number_match: houseMatch,
    street_name_match: true,
    verdict: 'match',
    reason: null,
  };
};
