export type FacilityType = 'hospital' | 'clinic' | 'tier1';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  city: string;
  county: string;
  lat: number;
  lng: number;
}

export const hospitals: Facility[] = [
  { id: "h1", name: "Desert View Hospital", type: "hospital", city: "Pahrump", county: "Nye", lat: 36.21, lng: -115.98 },
  { id: "h2", name: "Banner Churchill Community Hospital", type: "hospital", city: "Fallon", county: "Churchill", lat: 39.47, lng: -118.78 },
  { id: "h3", name: "Northeastern Nevada Regional Hospital", type: "hospital", city: "Elko", county: "Elko", lat: 40.84, lng: -115.76 },
  { id: "h4", name: "William Bee Ririe Hospital", type: "hospital", city: "Ely", county: "White Pine", lat: 39.25, lng: -114.89 },
  { id: "h5", name: "Carson Tahoe Regional Medical Center", type: "hospital", city: "Carson City", county: "Carson City", lat: 39.15, lng: -119.77 },
  { id: "h6", name: "Renown Regional Medical Center", type: "hospital", city: "Reno", county: "Washoe", lat: 39.53, lng: -119.82 },
  { id: "h7", name: "Saint Mary's Regional Medical Center", type: "hospital", city: "Reno", county: "Washoe", lat: 39.52, lng: -119.81 },
  { id: "h8", name: "Sunrise Hospital & Medical Center", type: "hospital", city: "Las Vegas", county: "Clark", lat: 36.12, lng: -115.10 },
  { id: "h9", name: "University Medical Center", type: "hospital", city: "Las Vegas", county: "Clark", lat: 36.15, lng: -115.16 },
  { id: "h10", name: "Mountainview Hospital", type: "hospital", city: "Las Vegas", county: "Clark", lat: 36.24, lng: -115.24 },
  { id: "h11", name: "Valley Hospital Medical Center", type: "hospital", city: "Las Vegas", county: "Clark", lat: 36.17, lng: -115.18 },
  { id: "h12", name: "Spring Valley Hospital", type: "hospital", city: "Las Vegas", county: "Clark", lat: 36.10, lng: -115.25 },
  { id: "h13", name: "Henderson Hospital", type: "hospital", city: "Henderson", county: "Clark", lat: 36.01, lng: -115.03 },
  { id: "h14", name: "Boulder City Hospital", type: "hospital", city: "Boulder City", county: "Clark", lat: 35.98, lng: -114.84 },
  { id: "h15", name: "Mesa View Regional Hospital", type: "hospital", city: "Mesquite", county: "Clark", lat: 36.81, lng: -114.07 },
  { id: "h16", name: "Grover C. Dils Medical Center", type: "hospital", city: "Caliente", county: "Lincoln", lat: 37.62, lng: -114.51 },
  { id: "h17", name: "Pershing General Hospital", type: "hospital", city: "Lovelock", county: "Pershing", lat: 40.18, lng: -118.47 },
  { id: "h18", name: "Humboldt General Hospital", type: "hospital", city: "Winnemucca", county: "Humboldt", lat: 40.97, lng: -117.74 },
  { id: "h19", name: "Battle Mountain General Hospital", type: "hospital", city: "Battle Mountain", county: "Lander", lat: 40.64, lng: -116.93 },
  { id: "h20", name: "South Lyon Medical Center", type: "hospital", city: "Yerington", county: "Lyon", lat: 38.99, lng: -119.16 },
  { id: "h21", name: "Carson Valley Medical Center", type: "hospital", city: "Gardnerville", county: "Douglas", lat: 38.94, lng: -119.75 },
  { id: "h22", name: "Northern Nevada Medical Center", type: "hospital", city: "Sparks", county: "Washoe", lat: 39.55, lng: -119.72 },
  { id: "h23", name: "Incline Village Community Hospital", type: "hospital", city: "Incline Village", county: "Washoe", lat: 39.25, lng: -119.95 },
  { id: "h24", name: "Mt. Grant General Hospital", type: "hospital", city: "Hawthorne", county: "Mineral", lat: 38.53, lng: -118.63 },
];

export const clinics: Facility[] = [
  { id: "c1", name: "Nye Communities Coalition Health Center", type: "clinic", city: "Pahrump", county: "Nye", lat: 36.20, lng: -115.99 },
  { id: "c2", name: "Community Health Alliance - Reno", type: "clinic", city: "Reno", county: "Washoe", lat: 39.53, lng: -119.80 },
  { id: "c3", name: "Community Health Alliance - Sparks", type: "clinic", city: "Sparks", county: "Washoe", lat: 39.54, lng: -119.75 },
  { id: "c4", name: "Nevada Health Centers - Carson City", type: "clinic", city: "Carson City", county: "Carson City", lat: 39.17, lng: -119.76 },
  { id: "c5", name: "Nevada Health Centers - Elko", type: "clinic", city: "Elko", county: "Elko", lat: 40.83, lng: -115.77 },
  { id: "c6", name: "Nevada Health Centers - Fallon", type: "clinic", city: "Fallon", county: "Churchill", lat: 39.47, lng: -118.77 },
  { id: "c7", name: "Nevada Health Centers - Gardnerville", type: "clinic", city: "Gardnerville", county: "Douglas", lat: 38.94, lng: -119.74 },
  { id: "c8", name: "Nevada Health Centers - Yerington", type: "clinic", city: "Yerington", county: "Lyon", lat: 38.99, lng: -119.17 },
  { id: "c9", name: "Nevada Health Centers - Winnemucca", type: "clinic", city: "Winnemucca", county: "Humboldt", lat: 40.97, lng: -117.73 },
  { id: "c10", name: "Nevada Health Centers - Ely", type: "clinic", city: "Ely", county: "White Pine", lat: 39.25, lng: -114.88 },
  { id: "c11", name: "Nevada Health Centers - Battle Mountain", type: "clinic", city: "Battle Mountain", county: "Lander", lat: 40.64, lng: -116.92 },
  { id: "c12", name: "Tonopah Community Health Center", type: "clinic", city: "Tonopah", county: "Nye", lat: 38.07, lng: -117.23 },
];

export const defaultFacilities: Facility[] = [...hospitals, ...clinics];
