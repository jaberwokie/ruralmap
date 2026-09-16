/**
 * Phase 2E — deterministic street-identity keys for the internal Nevada
 * TIGER/Line street-range geocoder.
 *
 * ONE implementation, shared by:
 *   - the ingestion script that loads public Census TIGER/Line reference data
 *     (`scripts/ingest-tiger-nevada.ts`)
 *   - the member-address geocoder inside the `resolve-address` edge function
 *
 * If ingestion and lookup ever normalized differently, valid addresses would
 * silently stop matching, so both sides MUST import this module.
 *
 * PRIVACY: pure string functions. Nothing here logs, persists, or transmits
 * anything. Member text passed in stays in memory for the request only.
 */

/** Street-type aliases → one canonical expanded token. */
const STREET_TYPES: Record<string, string> = {
  st: 'street', str: 'street', street: 'street',
  ave: 'avenue', av: 'avenue', avenue: 'avenue',
  rd: 'road', road: 'road',
  blvd: 'boulevard', blv: 'boulevard', boulevard: 'boulevard',
  dr: 'drive', drv: 'drive', drive: 'drive',
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
  spur: 'spur',
  run: 'run',
  row: 'row',
  path: 'path',
  pass: 'pass',
  crk: 'creek', creek: 'creek',
  rnch: 'ranch', ranch: 'ranch',
  hl: 'hill', hill: 'hill',
  vw: 'view', view: 'view',
  pt: 'point', point: 'point',
};

/** Directional aliases → one canonical expanded token. */
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
  /\b(suite|ste|unit|apt|apartment|bldg|building|room|rm|floor|fl|lot|space|spc|trlr|#)\s*[\w-]*/gi;

/** Ordinal digits keep a single canonical spelling: 6TH, not SIXTH/6. */
const normalizeOrdinal = (token: string): string =>
  /^\d+(st|nd|rd|th)$/.test(token) ? token : token;

const tokenize = (input: string): string[] =>
  String(input ?? '')
    .normalize('NFKC')
    .replace(/[\u2010-\u2015]/g, '-')
    .toLowerCase()
    .replace(UNIT_TOKENS, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const expand = (token: string): string =>
  DIRECTIONALS[token] ?? STREET_TYPES[token] ?? normalizeOrdinal(token);

export interface StreetKeys {
  /** Full normalized street identity, e.g. `GRISWOLD DRIVE`. */
  streetKey: string;
  /** Identity without directionals and without a trailing street type. */
  streetCore: string;
}

/**
 * Normalize a street name (no house number) into stable comparison keys.
 * Deterministic and idempotent: `normalizeStreetName(normalizeStreetName(x))`
 * produces the same keys.
 */
export const normalizeStreetName = (name: string | null | undefined): StreetKeys => {
  const tokens = tokenize(name ?? '').map(expand);
  if (tokens.length === 0) return { streetKey: '', streetCore: '' };

  const streetKey = tokens.join(' ').toUpperCase();

  const core = [...tokens];
  // Drop a trailing street type only when something else remains (so
  // "AVENUE F" and "BROADWAY" keep their identity).
  if (core.length > 1 && Object.values(STREET_TYPES).includes(core[core.length - 1])) {
    core.pop();
  }
  const withoutDirectionals = core.filter((t) => !Object.values(DIRECTIONALS).includes(t));
  const coreTokens = withoutDirectionals.length > 0 ? withoutDirectionals : core;

  return { streetKey, streetCore: coreTokens.join(' ').toUpperCase() };
};

export interface ParsedMemberAddress {
  houseNumber: number | null;
  streetKey: string;
  streetCore: string;
  city: string | null;
  zip: string | null;
  /** True when the input carries the Nevada state token. */
  isNevada: boolean;
  /** True when a numeric house number AND a street identity are present. */
  isStreetAddress: boolean;
}

const NV_STATE = /\b(nevada|nev|nv)\b/i;

/**
 * Parse an address string into the pieces the internal TIGER matcher needs.
 *
 * Only the leading comma segment is treated as the street. A house number must
 * be purely numeric — hyphenated/lettered house numbers (`12-B`, `100A`) are
 * intentionally not interpolated, because TIGER address ranges are numeric and
 * a wrong pin is worse than no pin.
 */
export const parseMemberAddress = (input: string | null | undefined): ParsedMemberAddress => {
  const raw = String(input ?? '').trim();
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{1,4})?\b/);
  const zip = zipMatch?.[1] ?? null;

  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const streetSegment = segments[0] ?? '';

  // City = the segment before the state/ZIP tail, when present.
  let city: string | null = null;
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (NV_STATE.test(seg) || /\d{5}/.test(seg)) break;
    city = seg;
  }

  const houseMatch = streetSegment.match(/^(\d{1,6})(?=\s)/);
  const houseNumber = houseMatch ? Number(houseMatch[1]) : null;
  const streetName = houseMatch ? streetSegment.slice(houseMatch[0].length) : streetSegment;
  const { streetKey, streetCore } = normalizeStreetName(streetName);

  return {
    houseNumber,
    streetKey,
    streetCore,
    city,
    zip,
    isNevada: NV_STATE.test(raw),
    isStreetAddress: houseNumber !== null && streetKey.length > 0,
  };
};
