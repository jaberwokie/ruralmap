/**
 * Local Transit Zones — additive access-support overlay.
 *
 * STRICTLY ADDITIVE. These are NOT providers, services, verification entities,
 * scoring inputs, or queue inputs. They model where structured local public
 * transportation may support first-mile / last-mile movement in rural Nevada.
 *
 * Geometry is APPROXIMATE — polygons are conservative route-shape approximations
 * derived from each operator's known local operating footprint. They are not
 * authoritative service-area shapes. Coverage should not be overstated.
 *
 * Coordinates are [lat, lng] arrays forming a closed polygon ring.
 */

export type LocalTransitOperator =
  | 'Silver Rider'
  | 'Jump Around Carson'
  | 'GET My Ride'
  | 'Ely Bus'
  | 'Lincoln County Transportation'
  | 'CART'
  | 'Pleasant Senior Center'
  | 'Lyon County Human Services'
  | 'Nye County Senior Nutrition'
  | 'Pyramid Lake Tribal Transit';

export type LocalTransitSupportLevel = 'local';

export type LocalTransitZoneCoverageConfidence = 'confirmed' | 'approximate';

export interface LocalTransitZone {
  id: string;
  name: string;
  operator: LocalTransitOperator;
  /** Discriminator for any future transport-context types. */
  type: 'local_transit_zone';
  geometryType: 'polygon';
  /** Closed polygon ring as [lat, lng] pairs. APPROXIMATE route-shape footprint. */
  geometry: [number, number][];
  active: boolean;
  /** Currently always 'local' — first-mile / last-mile in-town support only. */
  supportLevel: LocalTransitSupportLevel;
  /** Short caption shown in member-access context lines. */
  shortLabel: string;
  /** Registry source. Defaults to NDOT for all current zones. */
  source?: 'NDOT';
  /** Confidence in zone geometry. Current zones are conservative approximations. */
  coverageConfidence?: LocalTransitZoneCoverageConfidence;
}

/**
 * Route-shape approximations.
 * These outlines hug the published local operating footprint of each system
 * but are intentionally conservative. They do not imply service-area authority.
 */
export const localTransitZones: LocalTransitZone[] = [
  // ── Silver Rider — Mesquite / Bunkerville ──
  // Hugs the I-15 corridor from Bunkerville through Mesquite city.
  {
    id: 'ltz-silverrider-mesquite',
    name: 'Silver Rider — Mesquite / Bunkerville',
    operator: 'Silver Rider',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Mesquite local transit zone',
    geometry: [
      [36.7820, -114.1500],
      [36.8250, -114.1100],
      [36.8400, -114.0500],
      [36.8350, -113.9950],
      [36.8050, -113.9650],
      [36.7720, -113.9700],
      [36.7550, -114.0050],
      [36.7600, -114.0700],
      [36.7700, -114.1200],
      [36.7820, -114.1500],
    ],
  },

  // ── Silver Rider — Boulder City ──
  // Compact town footprint around Boulder City core.
  {
    id: 'ltz-silverrider-boulder-city',
    name: 'Silver Rider — Boulder City',
    operator: 'Silver Rider',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Boulder City local transit zone',
    geometry: [
      [35.9950, -114.8650],
      [36.0150, -114.8500],
      [36.0220, -114.8200],
      [36.0150, -114.7850],
      [35.9900, -114.7700],
      [35.9650, -114.7800],
      [35.9550, -114.8150],
      [35.9650, -114.8500],
      [35.9800, -114.8650],
      [35.9950, -114.8650],
    ],
  },

  // ── Silver Rider — Pahrump ──
  // Pahrump Valley corridor along Hwy 160 (~15 mi N–S band).
  {
    id: 'ltz-silverrider-pahrump',
    name: 'Silver Rider — Pahrump',
    operator: 'Silver Rider',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Pahrump local transit zone',
    geometry: [
      [36.0900, -116.0250],
      [36.1500, -115.9950],
      [36.2400, -115.9750],
      [36.3100, -115.9800],
      [36.3400, -116.0150],
      [36.3300, -116.0750],
      [36.2700, -116.0950],
      [36.1900, -116.0900],
      [36.1300, -116.0800],
      [36.0900, -116.0500],
      [36.0900, -116.0250],
    ],
  },

  // ── JAC — Carson City ──
  // Carson City core covering JAC fixed-route and deviated service area.
  {
    id: 'ltz-jac-carson',
    name: 'JAC — Carson City',
    operator: 'Jump Around Carson',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Carson City local transit zone',
    geometry: [
      [39.2050, -119.7900],
      [39.2200, -119.7650],
      [39.2050, -119.7250],
      [39.1850, -119.7100],
      [39.1500, -119.7100],
      [39.1250, -119.7250],
      [39.1100, -119.7550],
      [39.1200, -119.7900],
      [39.1500, -119.8050],
      [39.1850, -119.8050],
      [39.2050, -119.7900],
    ],
  },

  // ── GET My Ride — Elko ──
  // Conservative polygon around Elko city + Spring Creek footprint.
  {
    id: 'ltz-getmyride-elko',
    name: 'GET My Ride — Elko',
    operator: 'GET My Ride',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Elko local transit zone',
    geometry: [
      [40.8950, -115.8400],
      [40.8950, -115.7100],
      [40.8550, -115.6400],
      [40.7900, -115.6100],
      [40.7250, -115.6500],
      [40.6900, -115.7400],
      [40.7100, -115.8400],
      [40.7700, -115.8800],
      [40.8400, -115.8800],
      [40.8950, -115.8400],
    ],
  },

  // ── Ely Bus — Ely / White Pine ──
  // Conservative polygon around Ely, East Ely, Ruth corridor.
  {
    id: 'ltz-elybus-ely',
    name: 'Ely Bus — Ely',
    operator: 'Ely Bus',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Ely local transit zone',
    geometry: [
      [39.2700, -114.9700],
      [39.2750, -114.8500],
      [39.2550, -114.8200],
      [39.2200, -114.8150],
      [39.1850, -114.8400],
      [39.1750, -114.9000],
      [39.1900, -114.9600],
      [39.2300, -114.9850],
      [39.2700, -114.9700],
    ],
  },

  // ── Lincoln County Transportation ──
  // Conservative N–S corridor covering Pioche, Panaca, Caliente population centers.
  {
    id: 'ltz-linctrans-corridor',
    name: 'Lincoln County Transportation — Pioche / Panaca / Caliente',
    operator: 'Lincoln County Transportation',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Lincoln County local transit corridor',
    geometry: [
      [38.0150, -114.4900],
      [38.0250, -114.4350],
      [37.9550, -114.3700],
      [37.8500, -114.3950],
      [37.7300, -114.4700],
      [37.6050, -114.5000],
      [37.5950, -114.5650],
      [37.6700, -114.5800],
      [37.8000, -114.5450],
      [37.9300, -114.5200],
      [38.0150, -114.4900],
    ],
  },

  // ── CART — Fallon / Churchill ──
  // Conservative polygon around Fallon city + immediate service footprint.
  {
    id: 'ltz-cart-fallon',
    name: 'CART — Fallon',
    operator: 'CART',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Fallon local transit zone',
    geometry: [
      [39.5250, -118.8500],
      [39.5350, -118.7500],
      [39.5100, -118.6900],
      [39.4700, -118.6700],
      [39.4250, -118.7000],
      [39.4050, -118.7700],
      [39.4200, -118.8400],
      [39.4700, -118.8700],
      [39.5250, -118.8500],
    ],
  },

  // ── Pleasant Senior Center — Winnemucca ──
  // Tight polygon around the Winnemucca city core. Limited community transport;
  // do NOT extend to the rest of Humboldt County.
  {
    id: 'ltz-pleasant-senior-winnemucca',
    name: 'Pleasant Senior Center — Winnemucca',
    operator: 'Pleasant Senior Center',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Winnemucca limited transit zone',
    source: 'NDOT',
    coverageConfidence: 'approximate',
    geometry: [
      [40.9920, -117.7550],
      [41.0050, -117.7350],
      [40.9980, -117.7050],
      [40.9750, -117.6950],
      [40.9550, -117.7150],
      [40.9550, -117.7450],
      [40.9700, -117.7600],
      [40.9920, -117.7550],
    ],
  },

  // ── Lyon County Human Services — Yerington ──
  // Tight polygon around Yerington city. Conservative.
  {
    id: 'ltz-lyon-hs-yerington',
    name: 'Lyon County Human Services — Yerington',
    operator: 'Lyon County Human Services',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Yerington limited transit zone',
    source: 'NDOT',
    coverageConfidence: 'approximate',
    geometry: [
      [38.9950, -119.1850],
      [39.0080, -119.1500],
      [38.9920, -119.1250],
      [38.9700, -119.1200],
      [38.9520, -119.1450],
      [38.9550, -119.1800],
      [38.9750, -119.1950],
      [38.9950, -119.1850],
    ],
  },

  // ── Lyon County Human Services — Dayton / Fernley corridor ──
  // Two anchor towns connected by a narrow corridor along US-50 / I-80.
  {
    id: 'ltz-lyon-hs-dayton-fernley',
    name: 'Lyon County Human Services — Dayton / Fernley corridor',
    operator: 'Lyon County Human Services',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Dayton–Fernley limited transit corridor',
    source: 'NDOT',
    coverageConfidence: 'approximate',
    geometry: [
      [39.2500, -119.6050],
      [39.2650, -119.5650],
      [39.5050, -119.2350],
      [39.6300, -119.2050],
      [39.6450, -119.2400],
      [39.5200, -119.2900],
      [39.2700, -119.5950],
      [39.2400, -119.6200],
      [39.2500, -119.6050],
    ],
  },

  // ── Nye County Senior Nutrition — Tonopah ──
  // Tight polygon around Tonopah town only.
  {
    id: 'ltz-nye-senior-tonopah',
    name: 'Nye County Senior Nutrition — Tonopah',
    operator: 'Nye County Senior Nutrition',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Tonopah limited transit zone',
    source: 'NDOT',
    coverageConfidence: 'approximate',
    geometry: [
      [38.0850, -117.2500],
      [38.0950, -117.2200],
      [38.0820, -117.1950],
      [38.0600, -117.1900],
      [38.0420, -117.2100],
      [38.0450, -117.2400],
      [38.0650, -117.2550],
      [38.0850, -117.2500],
    ],
  },

  // ── Pyramid Lake Tribal Transit — Nixon ──
  // Tight polygon around Nixon and the immediate Pyramid Lake reservation core.
  // Intentionally small — distinct from the broader Tribal Nations layer.
  {
    id: 'ltz-pyramid-lake-nixon',
    name: 'Pyramid Lake Tribal Transit — Nixon',
    operator: 'Pyramid Lake Tribal Transit',
    type: 'local_transit_zone',
    geometryType: 'polygon',
    active: true,
    supportLevel: 'local',
    shortLabel: 'Nixon / Pyramid Lake limited transit zone',
    source: 'NDOT',
    coverageConfidence: 'approximate',
    geometry: [
      [39.8400, -119.3850],
      [39.8500, -119.3500],
      [39.8350, -119.3200],
      [39.8100, -119.3150],
      [39.7900, -119.3400],
      [39.7950, -119.3750],
      [39.8150, -119.3950],
      [39.8400, -119.3850],
    ],
  },
];

// ── Geometry helpers (point-in-polygon via ray casting) ──

/**
 * Returns true if the point [lat, lng] is inside the closed polygon ring.
 * Pure ray-casting — no external dependencies.
 */
export function pointInZone(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Returns the first active zone containing the point, or null. */
export function findZoneContaining(lat: number, lng: number): LocalTransitZone | null {
  for (const z of localTransitZones) {
    if (!z.active) continue;
    if (pointInZone(lat, lng, z.geometry)) return z;
  }
  return null;
}
