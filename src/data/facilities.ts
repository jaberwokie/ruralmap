export type FacilityType = 'hospital' | 'clinic' | 'tier1';
export type FacilityTier = 'tier1' | 'tier2' | 'tier3' | 'none';
export type AccessType = 'Frontier' | 'Rural' | 'Near-Urban';
export type FacilityClassification = 'hospital' | 'cah' | 'clinic_provider' | 'facility';
export type DataConfidence = 'Verified' | 'Likely Accurate' | 'Unverified';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  classification?: FacilityClassification;
  dataConfidence?: DataConfidence;
  city: string;
  county: string;
  address?: string;
  lat: number;
  lng: number;
  notes?: string;
  tier?: FacilityTier;
  service?: string;
  volume?: number;
  accessType?: AccessType;
}

export const defaultFacilities: Facility[] = [
  // Hospitals
  // Hospitals
  { id: "h1", name: "Desert View Hospital", type: "hospital", classification: "cah", city: "Pahrump", county: "Nye", address: "360 S Lola Ln", lat: 36.2142, lng: -116.0248, notes: "Primary Nye discharge point", accessType: "Near-Urban" },
  { id: "h2", name: "Banner Churchill Community Hospital", type: "hospital", classification: "cah", city: "Fallon", county: "Churchill", address: "801 E Williams Ave", lat: 39.4762, lng: -118.7662, notes: "Regional hospital", accessType: "Rural" },
  { id: "h3", name: "Carson Tahoe Regional Medical Center", type: "hospital", classification: "hospital", city: "Carson City", county: "Carson City", address: "1600 Medical Pkwy", lat: 39.2011, lng: -119.7841, notes: "Primary Carson hub" },
  { id: "h4", name: "Northeastern Nevada Regional Hospital", type: "hospital", classification: "facility", city: "Elko", county: "Elko", address: "2001 Errecart Blvd", lat: 40.8230, lng: -115.7314, notes: "True rural hub" },
  { id: "h5", name: "William Bee Ririe Hospital", type: "hospital", classification: "cah", city: "Ely", county: "White Pine", address: "1500 Avenue H", lat: 39.2556, lng: -114.8596, notes: "Frontier coverage", accessType: "Frontier" },
  { id: "h6", name: "Battle Mountain General Hospital", type: "hospital", classification: "cah", city: "Battle Mountain", county: "Lander", address: "535 S Humboldt St", lat: 40.6399, lng: -116.9407, notes: "Low-density area", accessType: "Frontier" },
  { id: "h7", name: "South Lyon Medical Center", type: "hospital", classification: "cah", city: "Yerington", county: "Lyon", address: "213 S Whitacre St", lat: 38.9841, lng: -119.1674, notes: "Rural access point", accessType: "Rural" },
  { id: "h8", name: "Mount Grant General Hospital", type: "hospital", classification: "cah", city: "Hawthorne", county: "Mineral", address: "200 S A St", lat: 38.5166, lng: -118.6274, notes: "Frontier", accessType: "Frontier" },
  { id: "h9", name: "Humboldt General Hospital", type: "hospital", classification: "cah", city: "Winnemucca", county: "Humboldt", address: "118 E Haskell St", lat: 40.9711, lng: -117.7265, notes: "True rural hub", accessType: "Rural" },
  // Additional NRHP hospitals
  { id: "h10", name: "Grover C. Dils Medical Center", type: "hospital", classification: "cah", city: "Caliente", county: "Lincoln", address: "700 N Spring St", lat: 37.6226, lng: -114.5136, notes: "Frontier coverage", accessType: "Frontier" },
  { id: "h11", name: "Pershing General Hospital", type: "hospital", classification: "cah", city: "Lovelock", county: "Pershing", address: "855 6th St", lat: 40.1762, lng: -118.4818, notes: "Rural access", accessType: "Rural" },
  { id: "h12", name: "Boulder City Hospital", type: "hospital", classification: "cah", city: "Boulder City", county: "Clark", address: "901 Adams Blvd", lat: 35.9674, lng: -114.8427, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h13", name: "Mesa View Regional Hospital", type: "hospital", classification: "cah", city: "Mesquite", county: "Clark", address: "1299 Bertha Howe Ave", lat: 36.8098, lng: -114.1161, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h14", name: "Carson Valley Health", type: "hospital", classification: "cah", city: "Gardnerville", county: "Douglas", address: "1107 Hwy 395 N", lat: 38.9413, lng: -119.7496, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h15", name: "Incline Village Community Hospital", type: "hospital", classification: "cah", city: "Incline Village", county: "Washoe", address: "880 Alder Ave", lat: 39.2516, lng: -119.9541, notes: "Near-urban access", accessType: "Near-Urban" },

  // Clinics
  { id: "c1", name: "Nevada Health Centers Pahrump", type: "clinic", classification: "clinic_provider", city: "Pahrump", county: "Nye", address: "1430 E Calvada Blvd", lat: 36.1943, lng: -115.9664, notes: "FQHC" },
  { id: "c2", name: "Nevada Health Centers Carson City", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "1802 N Carson St", lat: 39.1757, lng: -119.7670, notes: "FQHC" },
  { id: "c3", name: "Nevada Health Centers Fallon", type: "clinic", classification: "clinic_provider", city: "Fallon", county: "Churchill", address: "E Williams Ave", lat: 39.4749, lng: -118.7727, notes: "FQHC" },
  { id: "c4", name: "Nevada Health Centers Elko", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "762 14th St", lat: 40.8416, lng: -115.7584, notes: "FQHC" },
  { id: "c5", name: "Nevada Health Centers Ely", type: "clinic", classification: "clinic_provider", city: "Ely", county: "White Pine", address: "1500 Avenue H", lat: 39.2547, lng: -114.8610, notes: "FQHC" },
  { id: "c6", name: "Community Health Alliance Dayton", type: "clinic", classification: "clinic_provider", city: "Dayton", county: "Lyon", address: "Dayton, NV", lat: 39.2374, lng: -119.5929, notes: "Primary care + BH" },
  { id: "c7", name: "Community Health Alliance Carson", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "Carson City, NV", lat: 39.1674, lng: -119.7683, notes: "BH + PCP" },
  { id: "c8", name: "First Med Fallon", type: "clinic", classification: "clinic_provider", city: "Fallon", county: "Churchill", address: "560 E Williams Ave", lat: 39.4768, lng: -118.7690, notes: "Urgent care access" },

  // High-Utilization Clinic / Providers (reclassified from Tier 1 — all are location-based)
  { id: "t1", name: "Beautiful Mind of Las Vegas LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 9533, tier: "tier1" },
  { id: "t2", name: "Family Centers of Nevada LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 3305, tier: "tier1" },
  { id: "t3", name: "Carson City Community Counseling Center", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, service: "BH", volume: 2365, tier: "tier1" },
  { id: "t4", name: "Mindspace, LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1765, tier: "tier1" },
  { id: "t5", name: "Aspire Therapeutic Solutions LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1707, tier: "tier1" },
  { id: "t6", name: "Behavioral Health and Psychotherapy Services, LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1415, tier: "tier1" },
  { id: "t7", name: "Carson Tahoe Physician Clinics", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, service: "PCP", volume: 1294, tier: "tier1" },
  { id: "t8", name: "State of Nevada", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, service: "BH", volume: 1276, tier: "tier1" },
  { id: "t9", name: "Always Reach Out Behavioral Health LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1254, tier: "tier1" },
  { id: "t10", name: "Janell Anderson, LCSW, PLLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1212, tier: "tier1" },
  { id: "t11", name: "Battle Born Counseling Center", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", lat: 39.1638, lng: -119.7674, service: "BH", volume: 1179, tier: "tier1" },
  { id: "t12", name: "Oasis in the Desert Counseling, LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1131, tier: "tier1" },
  { id: "t13", name: "Dynamic Medical Group LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "PCP", volume: 1096, tier: "tier1" },
  { id: "t14", name: "Dr. Ronald Pak, PsyD LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 1086, tier: "tier1" },
  { id: "t15", name: "Serenity Counseling LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", lat: 36.1699, lng: -115.1398, service: "BH", volume: 991, tier: "tier1" },
];

export const FACILITY_CLASSIFICATION_LABELS: Record<FacilityClassification, string> = {
  hospital: 'Hospital',
  cah: 'Critical Access Hospital (CAH)',
  clinic_provider: 'Clinic / Community Provider',
  facility: 'Facility',
};

export const DATA_CONFIDENCE_LABELS: Record<DataConfidence, DataConfidence> = {
  Verified: 'Verified',
  'Likely Accurate': 'Likely Accurate',
  Unverified: 'Unverified',
};

export const getFacilityClassification = (facility: Facility): FacilityClassification =>
  facility.classification ?? (facility.type === 'hospital' ? 'hospital' : 'clinic_provider');

export const getFacilityDataConfidence = (facility: Facility): DataConfidence => {
  if (facility.dataConfidence) return facility.dataConfidence;
  if (!Number.isFinite(facility.lat) || !Number.isFinite(facility.lng) || facility.lat === 0 || facility.lng === 0) return 'Unverified';
  if (getFacilityClassification(facility) === 'facility') return 'Unverified';
  if (facility.address) return 'Verified';
  return 'Likely Accurate';
};

export const isCriticalAccessHospital = (facility: Facility) =>
  getFacilityClassification(facility) === 'cah';

export const getFacilityTypeLabel = (facility: Facility) => FACILITY_CLASSIFICATION_LABELS[getFacilityClassification(facility)];

export const auditFacilityConfidence = (facilities: Facility[]) => {
  const missingConfidence = facilities
    .filter((facility) => !facility.dataConfidence)
    .map((facility) => facility.name);

  const counts = facilities.reduce<Record<DataConfidence, number>>((acc, facility) => {
    acc[getFacilityDataConfidence(facility)] += 1;
    return acc;
  }, {
    Verified: 0,
    'Likely Accurate': 0,
    Unverified: 0,
  });

  const unverifiedFacilities = facilities
    .filter((facility) => getFacilityDataConfidence(facility) === 'Unverified')
    .map((facility) => ({
      id: facility.id,
      name: facility.name,
      classification: getFacilityClassification(facility),
      county: facility.county,
    }));

  return {
    total: facilities.length,
    counts,
    missingConfidence,
    unverifiedFacilities,
  };
};

export const auditFacilityClassifications = (facilities: Facility[]) => {
  const duplicateNameMap = new Map<string, Set<FacilityClassification>>();
  const missingClassification = facilities
    .filter((facility) => !facility.classification)
    .map((facility) => facility.name);

  const conflictingTags = facilities
    .filter((facility) => {
      const classification = getFacilityClassification(facility);
      return (facility.type === 'clinic' && (classification === 'cah' || classification === 'hospital'))
        || (facility.type === 'hospital' && classification === 'clinic_provider');
    })
    .map((facility) => facility.name);

  facilities.forEach((facility) => {
    const key = facility.name.trim().toLowerCase();
    const classifications = duplicateNameMap.get(key) ?? new Set<FacilityClassification>();
    classifications.add(getFacilityClassification(facility));
    duplicateNameMap.set(key, classifications);
  });

  const duplicateClassificationConflicts = Array.from(duplicateNameMap.entries())
    .filter(([, classifications]) => classifications.size > 1)
    .map(([name]) => name);

  const counts = facilities.reduce<Record<FacilityClassification, number>>((acc, facility) => {
    const classification = getFacilityClassification(facility);
    acc[classification] += 1;
    return acc;
  }, {
    hospital: 0,
    cah: 0,
    clinic_provider: 0,
    facility: 0,
  });

  return {
    total: facilities.length,
    counts,
    missingClassification,
    conflictingTags,
    duplicateClassificationConflicts,
  };
};
