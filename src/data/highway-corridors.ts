/**
 * Major Nevada highway corridors as simplified polyline segments.
 * Used for lightweight proximity checks — not routing.
 *
 * Each corridor is an array of [lat, lng] waypoints tracing the approximate path.
 * Buffer distance determines "near highway" qualification.
 */

export interface HighwayCorridor {
  id: string;
  label: string;
  /** Ordered waypoints [lat, lng] */
  path: [number, number][];
}

export const HIGHWAY_BUFFER_MI = 5; // resource within 5 mi of corridor qualifies

export const nevadaHighwayCorridors: HighwayCorridor[] = [
  {
    id: 'I-80',
    label: 'I-80',
    path: [
      [40.74, -119.83], // Verdi (CA border)
      [40.50, -119.78], // Reno
      [39.53, -119.81], // Sparks (corrected — actually I-80 stays north)
      [40.68, -118.63], // Lovelock
      [40.83, -117.82], // Winnemucca
      [40.73, -117.48], // Golconda
      [40.84, -116.93], // Battle Mountain
      [40.57, -116.07], // Carlin
      [40.83, -115.76], // Elko
      [40.86, -115.09], // Wells
      [40.74, -114.07], // West Wendover (UT border)
    ],
  },
  {
    id: 'US-93',
    label: 'US-93',
    path: [
      [40.86, -115.09], // Wells
      [40.73, -115.19], // south of Wells
      [39.59, -115.15], // Ely area
      [38.54, -114.85], // Pioche area
      [37.80, -114.60], // Caliente
      [36.68, -114.47], // Mesquite area
      [36.17, -115.14], // Las Vegas (north end)
      [35.98, -114.74], // Boulder City / Hoover Dam
    ],
  },
  {
    id: 'US-95',
    label: 'US-95',
    path: [
      [41.97, -117.54], // McDermitt (OR border)
      [41.19, -117.56], // Orovada
      [40.83, -117.82], // Winnemucca
      [40.07, -117.62], // south of Winnemucca
      [39.48, -117.78], // Fallon area
      [38.54, -118.43], // Hawthorne
      [38.03, -118.13], // Coaldale
      [37.77, -117.63], // Goldfield
      [37.33, -117.23], // Beatty area
      [36.63, -116.41], // Amargosa Valley
      [36.17, -115.14], // Las Vegas
    ],
  },
  {
    id: 'US-50',
    label: 'US-50',
    path: [
      [39.16, -119.77], // Carson City
      [39.25, -119.32], // Dayton
      [39.47, -118.78], // Fallon
      [39.33, -117.64], // Austin
      [39.59, -115.96], // Eureka
      [39.25, -115.15], // Ely
    ],
  },
  {
    id: 'NV-160',
    label: 'NV-160',
    path: [
      [36.17, -115.14], // Las Vegas (Blue Diamond Rd)
      [36.07, -115.46], // Blue Diamond
      [36.21, -115.99], // Pahrump
    ],
  },
  {
    id: 'US-6',
    label: 'US-6',
    path: [
      [38.03, -118.13], // Coaldale Junction
      [38.50, -117.85], // Tonopah
      [39.25, -115.15], // Ely
    ],
  },
  {
    id: 'I-15',
    label: 'I-15',
    path: [
      [36.17, -115.14], // Las Vegas
      [36.60, -114.84], // Moapa
      [36.80, -114.07], // Mesquite
    ],
  },
  {
    id: 'US-395',
    label: 'US-395',
    path: [
      [39.16, -119.77], // Carson City
      [39.53, -119.81], // Reno
      [40.50, -119.78], // north Reno / Stead
    ],
  },
];
