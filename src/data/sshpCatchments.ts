/**
 * SilverSummit Rural Catchments — payer-pathway overlay metadata.
 *
 * STRICTLY ADDITIVE / INFORMATIONAL.
 * - Not used in any access-gap, coverage, FTE, clustering, or
 *   Decision Assistant scoring logic.
 * - Not merged with verified provider records.
 * - Static data only; safe to import in any client module.
 *
 * If any record fails to parse it must degrade silently (consumers
 * filter on hasValidCoords).
 */

export type SshpCategory =
  | 'Potential Novum Partner'
  | 'Residential Tx/PT'
  | 'Psychiatric IP'
  | 'CCBHC'
  | 'Mixed BH Anchor';

export type SshpPathwayType = SshpCategory;

export interface SshpAnchor {
  id: string;
  name: string;          // anchor community / city
  county: string;        // Nevada county
  lat: number;
  lng: number;
  category: SshpCategory;
  /** Operational fit per workbook review. Informational only. */
  fit: 'High' | 'Medium' | 'Low' | 'Mixed';
  notes?: string;
}

export interface SshpCatchmentRoute {
  id: string;
  /** Origin community or feed-in area */
  originId: string;
  /** Destination anchor community */
  destinationId: string;
  category: SshpCategory;
  /** Optional partner-development flag */
  potentialPartner?: boolean;
  /** Short referral-context note (one sentence). */
  note?: string;
  /** Confidence labelling per workbook review. */
  fit: 'High' | 'Medium' | 'Low' | 'Mixed';
}

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export const hasValidAnchorCoords = (a: Pick<SshpAnchor, 'lat' | 'lng'>): boolean =>
  isFiniteNumber(a.lat) && isFiniteNumber(a.lng) &&
  a.lat >= 35 && a.lat <= 42.1 && a.lng >= -120.1 && a.lng <= -113.9;

/**
 * Anchor list — coordinates are approximate community centroids only.
 * They are NOT verified provider locations; they are routing anchors
 * for the directional overlay only.
 */
export const SSHP_ANCHORS: SshpAnchor[] = [
  { id: 'pahrump',         name: 'Pahrump',                 county: 'Nye',         lat: 36.2083, lng: -115.9839, category: 'CCBHC',                 fit: 'High',   notes: 'WestCare CCBHC + Desert View; do not let Tonopah catchment override local Pahrump access.' },
  { id: 'tonopah',         name: 'Tonopah',                 county: 'Nye',         lat: 38.0691, lng: -117.2293, category: 'Mixed BH Anchor',       fit: 'Low',    notes: 'Rural Clinic only; treat catchment as routing context.' },
  { id: 'gold-hill',       name: 'Gold Hill',               county: 'Storey',      lat: 39.2810, lng: -119.6440, category: 'Mixed BH Anchor',       fit: 'Low',    notes: 'No verified BH row; pathway context only.' },
  { id: 'fernley',         name: 'Fernley',                 county: 'Lyon',        lat: 39.6080, lng: -119.2520, category: 'CCBHC',                 fit: 'High',   notes: 'Outpatient/CCBHC cluster; corridor toward Reno.' },
  { id: 'silver-springs',  name: 'Silver Springs',          county: 'Lyon',        lat: 39.4080, lng: -119.2300, category: 'CCBHC',                 fit: 'High' },
  { id: 'reno',            name: 'Reno',                    county: 'Washoe',      lat: 39.5296, lng: -119.8138, category: 'Psychiatric IP',        fit: 'High' },
  { id: 'carson-city',     name: 'Carson City',             county: 'Carson City', lat: 39.1638, lng: -119.7674, category: 'Mixed BH Anchor',       fit: 'High' },
  { id: 'gardnerville',    name: 'Gardnerville / Minden',   county: 'Douglas',     lat: 38.9407, lng: -119.7497, category: 'Potential Novum Partner', fit: 'High' },
  { id: 'yerington',       name: 'Yerington',               county: 'Lyon',        lat: 38.9854, lng: -119.1631, category: 'Mixed BH Anchor',       fit: 'Medium' },
  { id: 'fallon',          name: 'Fallon',                  county: 'Churchill',   lat: 39.4735, lng: -118.7774, category: 'CCBHC',                 fit: 'High' },
  { id: 'hawthorne',       name: 'Hawthorne',               county: 'Mineral',     lat: 38.5246, lng: -118.6248, category: 'Residential Tx/PT',     fit: 'Medium', notes: 'Aurora PRTF currently flagged suspended — not usable access until re-verified.' },
  { id: 'battle-mountain', name: 'Battle Mountain',         county: 'Lander',      lat: 40.6420, lng: -116.9343, category: 'Mixed BH Anchor',       fit: 'Medium' },
  { id: 'winnemucca',      name: 'Winnemucca',              county: 'Humboldt',    lat: 40.9730, lng: -117.7357, category: 'Residential Tx/PT',     fit: 'Medium', notes: 'Residential/PT category needs validation; treat as I-80 anchor.' },
  { id: 'carlin',          name: 'Carlin',                  county: 'Elko',        lat: 40.7141, lng: -116.1027, category: 'Potential Novum Partner', fit: 'Medium' },
  { id: 'elko',            name: 'Elko',                    county: 'Elko',        lat: 40.8324, lng: -115.7631, category: 'CCBHC',                 fit: 'High',   notes: 'Vitality CCBHC + FQHC cluster; out-of-state pathway to Twin Falls / SLC.' },
  // External destination anchors (out-of-state) — coords approximate, used for arrow direction only.
  { id: 'twin-falls',      name: 'Twin Falls, ID',          county: 'External',    lat: 42.5630, lng: -114.4609, category: 'Mixed BH Anchor',       fit: 'Mixed',  notes: 'Out-of-state SSHP referral pathway.' },
  { id: 'salt-lake',       name: 'Salt Lake City, UT',      county: 'External',    lat: 40.7608, lng: -111.8910, category: 'Psychiatric IP',        fit: 'Mixed',  notes: 'Out-of-state SSHP referral pathway.' },
  { id: 'bishop',          name: 'Bishop, CA',              county: 'External',    lat: 37.3614, lng: -118.3950, category: 'Mixed BH Anchor',       fit: 'Mixed' },
];

const ANCHOR_BY_ID = new Map(SSHP_ANCHORS.map(a => [a.id, a]));
export const getSshpAnchor = (id: string): SshpAnchor | undefined => ANCHOR_BY_ID.get(id);

/**
 * Routes — origin → destination directional referral linkages from the
 * SSHP catchment workbook. Informational overlay only.
 */
export const SSHP_ROUTES: SshpCatchmentRoute[] = [
  { id: 'tonopah-pahrump',       originId: 'tonopah',         destinationId: 'pahrump',      category: 'CCBHC',                 fit: 'Medium', note: 'Northern Nye routes to Pahrump for outpatient BH/CCBHC.' },
  { id: 'gold-hill-pahrump',     originId: 'gold-hill',       destinationId: 'pahrump',      category: 'CCBHC',                 fit: 'Low',    note: 'Pathway context; Gold Hill BH presence not verified.' },
  { id: 'fernley-reno',          originId: 'fernley',         destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'High',   note: 'Western Lyon corridor toward Reno.' },
  { id: 'silver-springs-reno',   originId: 'silver-springs',  destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'High' },
  { id: 'silver-springs-carson', originId: 'silver-springs',  destinationId: 'carson-city',  category: 'Mixed BH Anchor',       fit: 'High' },
  { id: 'fernley-carson',        originId: 'fernley',         destinationId: 'carson-city',  category: 'Mixed BH Anchor',       fit: 'High' },
  { id: 'battle-mountain-reno',  originId: 'battle-mountain', destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'Medium', note: 'I-80 corridor escalation pathway.' },
  { id: 'battle-mountain-fallon',originId: 'battle-mountain', destinationId: 'fallon',       category: 'CCBHC',                 fit: 'Medium' },
  { id: 'winnemucca-reno',       originId: 'winnemucca',      destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'Medium' },
  { id: 'winnemucca-twin-falls', originId: 'winnemucca',      destinationId: 'twin-falls',   category: 'Residential Tx/PT',     fit: 'Mixed',  note: 'Out-of-state pathway via I-80.' },
  { id: 'elko-twin-falls',       originId: 'elko',            destinationId: 'twin-falls',   category: 'Psychiatric IP',        fit: 'Mixed' },
  { id: 'elko-salt-lake',        originId: 'elko',            destinationId: 'salt-lake',    category: 'Psychiatric IP',        fit: 'Mixed' },
  { id: 'carlin-elko',           originId: 'carlin',          destinationId: 'elko',         category: 'Potential Novum Partner', potentialPartner: true, fit: 'Medium' },
  { id: 'gardnerville-carson',   originId: 'gardnerville',    destinationId: 'carson-city',  category: 'Potential Novum Partner', potentialPartner: true, fit: 'High' },
  { id: 'gardnerville-reno',     originId: 'gardnerville',    destinationId: 'reno',         category: 'Potential Novum Partner', potentialPartner: true, fit: 'High' },
  { id: 'yerington-gardnerville',originId: 'yerington',       destinationId: 'gardnerville', category: 'Mixed BH Anchor',       fit: 'Medium' },
  { id: 'yerington-carson',      originId: 'yerington',       destinationId: 'carson-city',  category: 'Mixed BH Anchor',       fit: 'Medium' },
  { id: 'yerington-reno',        originId: 'yerington',       destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'Medium' },
  { id: 'hawthorne-carson',      originId: 'hawthorne',       destinationId: 'carson-city',  category: 'Residential Tx/PT',     fit: 'Medium' },
  { id: 'hawthorne-reno',        originId: 'hawthorne',       destinationId: 'reno',         category: 'Residential Tx/PT',     fit: 'Medium' },
  { id: 'hawthorne-bishop',      originId: 'hawthorne',       destinationId: 'bishop',       category: 'Residential Tx/PT',     fit: 'Mixed' },
  { id: 'fallon-reno',           originId: 'fallon',          destinationId: 'reno',         category: 'Psychiatric IP',        fit: 'High' },
];

/** Validated route subset — drops any route whose endpoints are missing or have invalid coords. */
export const getValidSshpRoutes = (): Array<SshpCatchmentRoute & {
  origin: SshpAnchor;
  destination: SshpAnchor;
}> => {
  const out: Array<SshpCatchmentRoute & { origin: SshpAnchor; destination: SshpAnchor }> = [];
  for (const r of SSHP_ROUTES) {
    const origin = ANCHOR_BY_ID.get(r.originId);
    const destination = ANCHOR_BY_ID.get(r.destinationId);
    if (!origin || !destination) continue;
    if (!hasValidAnchorCoords(origin) || !hasValidAnchorCoords(destination)) continue;
    out.push({ ...r, origin, destination });
  }
  return out;
};

/** Color map per category — kept muted; informational overlay. */
export const SSHP_CATEGORY_COLOR: Record<SshpCategory, string> = {
  'Potential Novum Partner': 'hsl(142, 50%, 45%)', // muted green
  'Residential Tx/PT':       'hsl(28, 75%, 50%)',  // muted orange
  'Psychiatric IP':          'hsl(330, 55%, 55%)', // muted pink
  'CCBHC':                   'hsl(220, 55%, 55%)', // muted blue
  'Mixed BH Anchor':         'hsl(265, 35%, 55%)', // muted purple
};

/**
 * Lightweight informational tags for a county or community.
 * Returns an empty array when nothing matches — caller renders nothing.
 */
export interface SshpInfoTag {
  label: string;
  category: SshpCategory;
}

export const getSshpTagsForCounty = (county: string | null | undefined): SshpInfoTag[] => {
  if (!county) return [];
  const tags: SshpInfoTag[] = [];
  const seen = new Set<string>();
  const pushTag = (label: string, category: SshpCategory) => {
    const k = `${label}::${category}`;
    if (seen.has(k)) return;
    seen.add(k);
    tags.push({ label, category });
  };
  for (const a of SSHP_ANCHORS) {
    if (a.county === county) {
      pushTag('SSHP Catchment Anchor', a.category);
      if (a.category === 'Potential Novum Partner') pushTag('Potential Novum Partner', a.category);
      if (a.category === 'Residential Tx/PT')       pushTag('Residential Tx/PT Pathway', a.category);
      if (a.category === 'Psychiatric IP')          pushTag('Psych IP Pathway', a.category);
      if (a.category === 'CCBHC')                   pushTag('CCBHC Pathway', a.category);
    }
  }
  return tags;
};

/**
 * Decision Assistant — payer pathway context.
 * NON-SCORING. Returns a short sentence or null.
 */
export const getSshpPayerPathwayContext = (
  county: string | null | undefined,
): string | null => {
  if (!county) return null;
  const valid = getValidSshpRoutes();
  // Routes whose origin community lies in this county.
  const outbound = valid.filter(r => r.origin.county === county);
  if (outbound.length === 0) {
    // Anchor in this county itself?
    const anchor = SSHP_ANCHORS.find(a => a.county === county);
    if (anchor) {
      return `SSHP workbook references ${anchor.name} as a payer-pathway anchor (${anchor.category}).`
        + ' Informational only · Non-authoritative · Does not change operational scoring.';
    }
    return 'No SSHP pathway context identified.';
  }
  // Group destinations.
  const dests = Array.from(new Set(outbound.map(r => r.destination.name))).slice(0, 3);
  return `SSHP workbook indicates a potential referral/catchment relationship toward ${dests.join(' / ')} for this county.`
    + ' Informational only · Non-authoritative · Does not change operational scoring.';
};
