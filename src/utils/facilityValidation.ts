import { DataConfidence, Facility, getFacilityClassification } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';

export type FacilityCoordinateSource =
  | 'exact_coordinates'
  | 'street_level_geocode'
  | 'city_level_estimate'
  | 'county_level_estimate';

export type FacilityValidationConfidence = 'verified' | 'approximate' | 'manual_review';

export interface FacilityValidationRecord {
  facilityId: string;
  sourceAddress: string;
  coordinateSource: FacilityCoordinateSource;
  confidence: FacilityValidationConfidence;
  corrected: boolean;
  duplicateFacilityIds: string[];
  issues: string[];
  insideNevada: boolean;
  insideExpectedCounty: boolean;
  malformedCoordinates: boolean;
  zeroCoordinates: boolean;
  possibleLatLngReversal: boolean;
  notes?: string;
}

export interface FacilityValidationSummary {
  totalFacilitiesReviewed: number;
  verifiedCount: number;
  approximateCount: number;
  correctedCount: number;
  manualReviewCount: number;
}

export const getDataConfidenceFromValidation = (
  facility: Facility,
  confidence: FacilityValidationConfidence,
  issues: string[],
): DataConfidence => {
  const classification = getFacilityClassification(facility);

  if (!Number.isFinite(facility.lat) || !Number.isFinite(facility.lng) || facility.lat === 0 || facility.lng === 0) {
    return 'Unverified';
  }

  if (classification === 'facility') {
    return 'Unverified';
  }

  if (confidence === 'manual_review') {
    return 'Unverified';
  }

  if (issues.some((issue) => issue.includes('outside the expected county') || issue.includes('may be reversed') || issue.includes('outside Nevada bounds'))) {
    return 'Unverified';
  }

  if (confidence === 'verified') {
    return 'Verified';
  }

  return 'Likely Accurate';
};

interface FacilityValidationOverride {
  sourceAddress?: string;
  coordinateSource?: FacilityCoordinateSource;
  confidence?: FacilityValidationConfidence;
  corrected?: boolean;
  notes?: string;
  issueOverrides?: string[];
}

const NEVADA_BOUNDS = {
  minLat: 35,
  maxLat: 42.5,
  minLng: -120.5,
  maxLng: -114,
};

const FACILITY_VALIDATION_OVERRIDES: Record<string, FacilityValidationOverride> = {
  h10: {
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Adjusted to the mapped hospital footprint at 700 N Spring St.',
  },
  h11: {
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Adjusted to the mapped hospital footprint at 855 6th St.',
  },
  h12: {
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Adjusted to the mapped hospital footprint at 901 Adams Blvd.',
  },
  h13: {
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Adjusted to the mapped hospital footprint at 1299 Bertha Howe Ave.',
  },
  h14: {
    coordinateSource: 'exact_coordinates',
    confidence: 'manual_review',
    notes: 'Stored coordinates retained, but the street address could not be externally confirmed during audit.',
  },
  h15: {
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Adjusted to the mapped hospital footprint at 880 Alder Ave.',
  },
  c1: {
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Address resolves only to the road segment on East Calvada Boulevard, not a mapped building footprint.',
  },
  c3: {
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Stored coordinates align to East Williams Avenue rather than a building-level clinic footprint.',
  },
  c6: {
    sourceAddress: '25 Dayton Village Pkwy, Dayton, NV 89403',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Address confirmed to street segment; building footprint not individually verified.',
  },
  c7: {
    sourceAddress: '3325 Research Way, Carson City, NV 89706',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Address confirmed to street segment; building footprint not individually verified.',
  },
  c8: {
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Address resolves to Williams Avenue rather than a verified building-level urgent care point.',
  },
  t1: {
    sourceAddress: '4955 S Durango Dr, Ste 214, Las Vegas, NV 89113',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    corrected: true,
    notes: 'Placed on S Durango Dr commercial corridor; building footprint not individually verified.',
  },
  t2: {
    sourceAddress: '1397 E Calvada Blvd, Pahrump, NV 89048',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas fallback to Pahrump HQ address.',
  },
  t3: {
    sourceAddress: '207 S Pratt St, Carson City, NV 89701',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from generic Carson City coordinate to verified street address.',
  },
  t4: {
    sourceAddress: '2850 W Horizon Ridge Pkwy, Ste 200, Henderson, NV 89052',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    corrected: true,
    notes: 'Placed on W Horizon Ridge Pkwy commercial corridor in Henderson.',
  },
  t5: {
    sourceAddress: '1017 E Basin Ave, Ste 3, Pahrump, NV 89060',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas fallback to Pahrump verified address.',
  },
  t6: {
    sourceAddress: '3006 S Maryland Pkwy, Ste 600, Las Vegas, NV 89109',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    corrected: true,
    notes: 'Placed on S Maryland Pkwy commercial corridor.',
  },
  t7: {
    sourceAddress: '1600 Medical Pkwy, Carson City, NV 89703',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from generic Carson City coordinate to verified medical campus address.',
  },
  t8: {
    sourceAddress: '4126 Technology Way, Carson City, NV 89706',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from generic Carson City civic coordinate to verified state office address.',
  },
  t9: {
    sourceAddress: '4560 W Sahara Ave, Ste 205, Las Vegas, NV 89102',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    corrected: true,
    notes: 'Placed on W Sahara Ave commercial corridor.',
  },
  t10: {
    sourceAddress: '1515 7th St, Elko, NV 89801',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas fallback to Elko verified address.',
  },
  t11: {
    sourceAddress: '1802 N Carson St, Unit 103, Carson City, NV 89701',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from generic Carson City coordinate to verified street address.',
  },
  t12: {
    sourceAddress: '7361 Prairie Falcon Rd, Ste 110, Las Vegas, NV 89128',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas city-center fallback to verified address.',
  },
  t13: {
    sourceAddress: '2020 Goldring Ave, Ste 401, Las Vegas, NV 89106',
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    corrected: true,
    notes: 'Placed on Goldring Ave medical corridor.',
  },
  t14: {
    sourceAddress: '311 S Frontage Rd, Ste 106, Pahrump, NV 89048',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas fallback to Pahrump verified address.',
  },
  t15: {
    sourceAddress: '6879 W Charleston Blvd, Las Vegas, NV 89117',
    coordinateSource: 'exact_coordinates',
    confidence: 'verified',
    corrected: true,
    notes: 'Corrected from Las Vegas city-center fallback to verified address.',
  },
};

const pointInPolygon = (lat: number, lng: number, polygon: [number, number][]) => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];

    const intersects = ((xi > lng) !== (xj > lng))
      && (lat < ((yj - yi) * (lng - xi)) / ((xj - xi) || Number.EPSILON) + yi);

    if (intersects) inside = !inside;
  }

  return inside;
};

const getSourceAddress = (facility: Facility, override?: FacilityValidationOverride) => {
  if (override?.sourceAddress) return override.sourceAddress;
  if (facility.address) return `${facility.address}, ${facility.city}, NV`;
  return `${facility.city}, NV`;
};

const getDefaultSourceType = (facility: Facility): FacilityCoordinateSource => {
  if (!facility.address) return 'city_level_estimate';
  if (facility.address === `${facility.city}, NV`) return 'city_level_estimate';
  return 'exact_coordinates';
};

const getDefaultConfidence = (facility: Facility): FacilityValidationConfidence => (
  facility.address ? 'verified' : 'approximate'
);

export const buildFacilityValidationIndex = (facilities: Facility[]) => {
  const duplicateMap = new Map<string, string[]>();

  facilities.forEach((facility) => {
    const key = `${facility.lat},${facility.lng}`;
    duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), facility.id]);
  });

  const records = new Map<string, FacilityValidationRecord>();

  facilities.forEach((facility) => {
    const override = FACILITY_VALIDATION_OVERRIDES[facility.id];
    const county = nevadaCounties.find((entry) => entry.name === facility.county);
    const malformedCoordinates = !Number.isFinite(facility.lat) || !Number.isFinite(facility.lng);
    const zeroCoordinates = facility.lat === 0 || facility.lng === 0;
    const insideNevada = !malformedCoordinates
      && facility.lat >= NEVADA_BOUNDS.minLat
      && facility.lat <= NEVADA_BOUNDS.maxLat
      && facility.lng >= NEVADA_BOUNDS.minLng
      && facility.lng <= NEVADA_BOUNDS.maxLng;
    const insideExpectedCounty = county ? pointInPolygon(facility.lat, facility.lng, county.boundaries) : true;
    const possibleLatLngReversal = !insideNevada
      && facility.lng >= NEVADA_BOUNDS.minLat
      && facility.lng <= NEVADA_BOUNDS.maxLat
      && facility.lat >= NEVADA_BOUNDS.minLng
      && facility.lat <= NEVADA_BOUNDS.maxLng;
    const duplicateFacilityIds = duplicateMap.get(`${facility.lat},${facility.lng}`) ?? [facility.id];

    const issues: string[] = [];

    if (malformedCoordinates) issues.push('Coordinates are malformed.');
    if (zeroCoordinates) issues.push('Coordinates are zeroed out.');
    if (!insideNevada) issues.push('Coordinates fall outside Nevada bounds.');
    if (!insideExpectedCounty) issues.push('Coordinates fall outside the expected county boundary.');
    if (possibleLatLngReversal) issues.push('Coordinates may be reversed.');
    if (duplicateFacilityIds.length > 1) issues.push(`Shares exact coordinates with ${duplicateFacilityIds.length - 1} other facility records.`);

    const coordinateSource = override?.coordinateSource ?? getDefaultSourceType(facility);
    const confidence = override?.confidence ?? getDefaultConfidence(facility);

    if (coordinateSource === 'city_level_estimate') {
      issues.push('Pin is using a city-level estimate rather than a facility-specific address.');
    }
    if (coordinateSource === 'county_level_estimate') {
      issues.push('Pin is using a county-level estimate rather than a facility-specific address.');
    }
    if (coordinateSource === 'street_level_geocode') {
      issues.push('Pin is only confirmed to the street segment, not a building footprint.');
    }
    if (confidence === 'manual_review') {
      issues.push('Record still needs manual review to confirm the exact facility location.');
    }

    const uniqueIssues = override?.issueOverrides ?? Array.from(new Set(issues));
    facility.dataConfidence = getDataConfidenceFromValidation(facility, confidence, uniqueIssues);

    records.set(facility.id, {
      facilityId: facility.id,
      sourceAddress: getSourceAddress(facility, override),
      coordinateSource,
      confidence,
      corrected: override?.corrected ?? false,
      duplicateFacilityIds,
      issues: uniqueIssues,
      insideNevada,
      insideExpectedCounty,
      malformedCoordinates,
      zeroCoordinates,
      possibleLatLngReversal,
      notes: override?.notes,
    });
  });

  const summary: FacilityValidationSummary = {
    totalFacilitiesReviewed: facilities.length,
    verifiedCount: Array.from(records.values()).filter((record) => record.confidence === 'verified').length,
    approximateCount: Array.from(records.values()).filter((record) => record.confidence !== 'verified').length,
    correctedCount: Array.from(records.values()).filter((record) => record.corrected).length,
    manualReviewCount: Array.from(records.values()).filter((record) => record.confidence === 'manual_review').length,
  };

  return { records, summary };
};

export const getFacilityCoordinateSourceLabel = (source: FacilityCoordinateSource) => {
  switch (source) {
    case 'exact_coordinates':
      return 'Exact coordinates';
    case 'street_level_geocode':
      return 'Street-level geocode';
    case 'city_level_estimate':
      return 'City-level estimate';
    case 'county_level_estimate':
      return 'County-level estimate';
    default:
      return source;
  }
};
