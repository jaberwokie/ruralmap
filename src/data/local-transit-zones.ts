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
  | 'CART';

export type LocalTransitSupportLevel = 'local';

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
