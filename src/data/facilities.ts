export type FacilityType = 'hospital' | 'clinic' | 'tier1';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  city: string;
  county: string;
  lat: number;
  lng: number;
  notes?: string;
}

export const defaultFacilities: Facility[] = [
  // Hospitals
  { id: "h1", name: "Desert View Hospital", type: "hospital", city: "Pahrump", county: "Nye", lat: 36.2083, lng: -115.9839, notes: "Primary Nye discharge point" },
  { id: "h2", name: "Banner Churchill Community Hospital", type: "hospital", city: "Fallon", county: "Churchill", lat: 39.4735, lng: -118.7774, notes: "Regional hospital" },
  { id: "h3", name: "Carson Tahoe Regional Medical Center", type: "hospital", city: "Carson City", county: "Carson City", lat: 39.1612, lng: -119.7674, notes: "Primary Carson hub" },
  { id: "h4", name: "Northeastern Nevada Regional Hospital", type: "hospital", city: "Elko", county: "Elko", lat: 40.8324, lng: -115.7631, notes: "True rural hub" },
  { id: "h5", name: "William Bee Ririe Hospital", type: "hospital", city: "Ely", county: "White Pine", lat: 39.2549, lng: -114.8886, notes: "Frontier coverage" },
  { id: "h6", name: "Battle Mountain General Hospital", type: "hospital", city: "Battle Mountain", county: "Lander", lat: 40.6422, lng: -116.9343, notes: "Low-density area" },
  { id: "h7", name: "South Lyon Medical Center", type: "hospital", city: "Yerington", county: "Lyon", lat: 38.9860, lng: -119.1624, notes: "Rural access point" },
  { id: "h8", name: "Mount Grant General Hospital", type: "hospital", city: "Hawthorne", county: "Mineral", lat: 38.5249, lng: -118.6240, notes: "Frontier" },
  { id: "h9", name: "Humboldt General Hospital", type: "hospital", city: "Winnemucca", county: "Humboldt", lat: 40.9729, lng: -117.7357, notes: "True rural hub" },

  // Clinics
  { id: "c1", name: "Nevada Health Centers Pahrump", type: "clinic", city: "Pahrump", county: "Nye", lat: 36.2083, lng: -115.9839, notes: "FQHC" },
  { id: "c2", name: "Nevada Health Centers Carson City", type: "clinic", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, notes: "FQHC" },
  { id: "c3", name: "Nevada Health Centers Fallon", type: "clinic", city: "Fallon", county: "Churchill", lat: 39.4735, lng: -118.7774, notes: "FQHC" },
  { id: "c4", name: "Nevada Health Centers Elko", type: "clinic", city: "Elko", county: "Elko", lat: 40.8324, lng: -115.7631, notes: "FQHC" },
  { id: "c5", name: "Nevada Health Centers Ely", type: "clinic", city: "Ely", county: "White Pine", lat: 39.2549, lng: -114.8886, notes: "FQHC" },
  { id: "c6", name: "Community Health Alliance Dayton", type: "clinic", city: "Dayton", county: "Lyon", lat: 39.2374, lng: -119.5929, notes: "Primary care + BH" },
  { id: "c7", name: "Community Health Alliance Carson", type: "clinic", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, notes: "BH + PCP" },
  { id: "c8", name: "First Med Fallon", type: "clinic", city: "Fallon", county: "Churchill", lat: 39.4735, lng: -118.7774, notes: "Urgent care access" },
];
