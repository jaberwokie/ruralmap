// Nevada county boundary coordinates (simplified polygons for rendering)

export type CoverageArea = 'area1' | 'area2' | 'area3';

export interface CountyData {
  name: string;
  center: [number, number]; // [lat, lng]
  isPrimary: boolean;
  zone: CoverageArea;
  secondaryZone?: CoverageArea; // flexible support from another area
  boundaries: [number, number][]; // simplified polygon coordinates [lat, lng]
}

export const COVERAGE_AREA_LABELS: Record<CoverageArea, string> = {
  area1: 'Area 1 — Western Hub',
  area2: 'Area 2 — Northern / Rural Hub',
  area3: 'Area 3 — Southern / Rural Hub',
};

export const RURAL_ACCESS_DEPENDENCE: Record<CoverageArea, string> = {
  area1: 'Low',
  area2: 'Moderate',
  area3: 'High',
};


// Build a county→area lookup for quick facility coloring
export function getCountyArea(countyName: string): CoverageArea {
  const county = nevadaCounties.find(c => c.name === countyName);
  return county?.zone ?? 'area3';
}

export const nevadaCounties: CountyData[] = [
  // ── Area 1 — Western Hub (Green) ──
  {
    name: "Washoe",
    center: [40.66, -119.68],
    isPrimary: false,
    zone: 'area1',
    boundaries: [
      [41.0, -120.0], [41.0, -119.33], [39.52, -119.33],
      [39.52, -120.0], [41.0, -120.0]
    ]
  },
  {
    name: "Carson City",
    center: [39.16, -119.77],
    isPrimary: true,
    zone: 'area1',
    boundaries: [
      [39.26, -119.88], [39.26, -119.67], [39.06, -119.67],
      [39.06, -119.88], [39.26, -119.88]
    ]
  },
  {
    name: "Douglas",
    center: [38.91, -119.62],
    isPrimary: true,
    zone: 'area1',
    boundaries: [
      [39.06, -119.88], [39.06, -119.33], [38.72, -119.33],
      [38.72, -119.88], [39.06, -119.88]
    ]
  },
  {
    name: "Storey",
    center: [39.44, -119.53],
    isPrimary: false,
    zone: 'area1',
    boundaries: [
      [39.52, -119.67], [39.52, -119.4], [39.34, -119.4],
      [39.34, -119.67], [39.52, -119.67]
    ]
  },

  // ── Area 2 — Northern / Rural Hub (Orange) ──
  {
    name: "Humboldt",
    center: [41.0, -118.1],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [41.99, -119.33], [41.99, -117.02], [40.5, -117.02],
      [40.5, -118.5], [41.0, -119.33], [41.99, -119.33]
    ]
  },
  {
    name: "Pershing",
    center: [40.46, -118.4],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [41.0, -119.33], [41.0, -117.6], [40.0, -117.6],
      [40.0, -118.75], [40.5, -119.33], [41.0, -119.33]
    ]
  },
  {
    name: "Lander",
    center: [40.07, -117.04],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [40.86, -117.6], [40.86, -116.6], [39.52, -116.6],
      [39.52, -117.6], [40.86, -117.6]
    ]
  },
  {
    name: "Eureka",
    center: [39.98, -116.0],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [40.86, -116.6], [40.86, -115.7], [39.52, -115.7],
      [39.52, -116.6], [40.86, -116.6]
    ]
  },
  {
    name: "Elko",
    center: [40.83, -115.76],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [41.99, -117.02], [41.99, -114.04], [40.0, -114.04],
      [40.0, -117.02], [41.99, -117.02]
    ]
  },
  {
    name: "White Pine",
    center: [39.44, -114.9],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [40.86, -115.7], [40.86, -114.04], [38.57, -114.04],
      [38.57, -115.7], [40.86, -115.7]
    ]
  },

  // ── Area 3 — Southern / Rural Hub (Blue) ──
  {
    name: "Mineral",
    center: [38.54, -118.43],
    isPrimary: false,
    zone: 'area3',
    boundaries: [
      [39.0, -118.75], [39.0, -117.6], [38.24, -117.6],
      [38.24, -118.75], [39.0, -118.75]
    ]
  },
  {
    name: "Esmeralda",
    center: [37.78, -117.63],
    isPrimary: false,
    zone: 'area3',
    boundaries: [
      [38.24, -118.44], [38.24, -117.17], [37.46, -117.17],
      [37.46, -118.44], [38.24, -118.44]
    ]
  },
  {
    name: "Nye",
    center: [37.5, -116.5],
    isPrimary: true,
    zone: 'area3',
    boundaries: [
      [39.0, -118.75], [39.0, -115.7],
      [38.57, -115.7], [36.84, -115.7],
      [36.0, -115.9], [36.0, -117.17],
      [37.46, -117.17], [38.24, -117.6],
      [39.0, -118.75]
    ]
  },
  {
    name: "Lincoln",
    center: [37.64, -114.88],
    isPrimary: false,
    zone: 'area3',
    boundaries: [
      [38.57, -115.7], [38.57, -114.04], [36.84, -114.04],
      [36.84, -115.7], [38.57, -115.7]
    ]
  },
  {
    name: "Clark",
    center: [36.21, -115.02],
    isPrimary: false,
    zone: 'area3',
    boundaries: [
      [37.0, -115.9], [37.0, -114.05], [35.0, -114.05],
      [35.0, -115.9], [36.0, -115.9], [37.0, -115.9]
    ]
  },
  // ── Lyon and Churchill assigned to Area 2 for geographic continuity ──
  {
    name: "Lyon",
    center: [39.02, -119.19],
    isPrimary: true,
    zone: 'area2',
    boundaries: [
      [39.34, -119.33], [39.34, -119.0], [38.72, -119.0],
      [38.72, -119.33], [39.34, -119.33]
    ]
  },
  {
    name: "Churchill",
    center: [39.72, -118.34],
    isPrimary: false,
    zone: 'area2',
    boundaries: [
      [40.0, -118.75], [40.0, -117.6], [39.0, -117.6],
      [39.0, -118.75], [40.0, -118.75]
    ]
  },
];
