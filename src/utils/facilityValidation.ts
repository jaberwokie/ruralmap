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
    sourceAddress: 'Dayton, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'approximate',
    notes: 'No street address is stored; pin represents a Dayton city-level estimate.',
  },
  c7: {
    sourceAddress: 'Carson City, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'approximate',
    notes: 'No street address is stored; pin represents a Carson City city-level estimate.',
  },
  c8: {
    coordinateSource: 'street_level_geocode',
    confidence: 'approximate',
    notes: 'Address resolves to Williams Avenue rather than a verified building-level urgent care point.',
  },
  t1: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t2: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t3: {
    sourceAddress: 'Carson City, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Carson City coordinate with unrelated providers; exact facility address is missing.',
  },
  t4: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t5: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t6: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t7: {
    sourceAddress: 'Carson City, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Carson City coordinate with unrelated providers; exact facility address is missing.',
  },
  t8: {
    sourceAddress: 'Carson City, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Current coordinate aligns with a generic Carson City civic area, not a verified provider site.',
  },
  t9: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t10: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t11: {
    sourceAddress: 'Carson City, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Carson City coordinate with unrelated providers; exact facility address is missing.',
  },
  t12: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t13: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t14: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
  },
  t15: {
    sourceAddress: 'Las Vegas, NV',
    coordinateSource: 'city_level_estimate',
    confidence: 'manual_review',
    notes: 'Shared fallback Las Vegas city-center coordinate with unrelated providers; exact facility address is missing.',
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
