/**
 * Coordinate validation for rural services, mirroring facilityValidation.ts
 * for provider facilities. Provides a unified audit surface for all map pins.
 */

import type { RuralService } from '@/data/rural-services';
import { nevadaCounties } from '@/data/nevada-counties';

export type ServiceCoordinateSource =
  | 'address_geocode'
  | 'city_center_approx'
  | 'cross_county_office';

export type ServiceValidationConfidence = 'verified' | 'approximate' | 'unverified';

export interface ServiceValidationRecord {
  serviceId: string;
  name: string;
  county: string;
  city: string;
  hasAddress: boolean;
  coordinateSource: ServiceCoordinateSource;
  confidence: ServiceValidationConfidence;
  insideNevada: boolean;
  insideExpectedCounty: boolean;
  duplicateIds: string[];
  issues: string[];
  notes?: string;
}

export interface ServiceValidationSummary {
  totalReviewed: number;
  verifiedCount: number;
  approximateCount: number;
  unverifiedCount: number;
  missingAddressCount: number;
  cityCenterApproxCount: number;
  outOfCountyCount: number;
  outOfStateCount: number;
}

const NEVADA_BOUNDS = {
  minLat: 35,
  maxLat: 42.5,
  minLng: -120.5,
  maxLng: -114,
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

export const buildServiceValidationIndex = (services: RuralService[]) => {
  const duplicateMap = new Map<string, string[]>();
  services.forEach(s => {
    const key = `${s.lat},${s.lng}`;
    duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), s.id]);
  });

  const records = new Map<string, ServiceValidationRecord>();

  services.forEach(service => {
    const hasAddress = !!service.address;
    const isCityApprox = service.notes?.includes('city-center approx') ?? false;
    const isCrossCounty = service.notes?.includes('Serves') && service.notes?.includes('from') ? true : false;

    const insideNevada =
      Number.isFinite(service.lat) && Number.isFinite(service.lng) &&
      service.lat >= NEVADA_BOUNDS.minLat && service.lat <= NEVADA_BOUNDS.maxLat &&
      service.lng >= NEVADA_BOUNDS.minLng && service.lng <= NEVADA_BOUNDS.maxLng;

    const county = nevadaCounties.find(c => c.name === service.county);
    const insideExpectedCounty = county
      ? pointInPolygon(service.lat, service.lng, county.boundaries)
      : true; // can't validate without boundary

    const duplicateIds = duplicateMap.get(`${service.lat},${service.lng}`) ?? [service.id];

    const issues: string[] = [];

    if (!Number.isFinite(service.lat) || !Number.isFinite(service.lng)) {
      issues.push('Coordinates are malformed.');
    }
    if (service.lat === 0 || service.lng === 0) {
      issues.push('Coordinates are zeroed out.');
    }
    if (!insideNevada) {
      issues.push('Coordinates fall outside Nevada bounds.');
    }
    if (!insideExpectedCounty && !isCrossCounty) {
      issues.push('Coordinates fall outside the expected county boundary.');
    }
    if (isCityApprox) {
      issues.push('Using city-center approximation instead of address-level coordinates.');
    }
    if (!hasAddress && !isCityApprox) {
      issues.push('No address on record; coordinate source unknown.');
    }
    if (duplicateIds.length > 1) {
      issues.push(`Shares exact coordinates with ${duplicateIds.length - 1} other service records.`);
    }

    let coordinateSource: ServiceCoordinateSource = 'address_geocode';
    if (isCrossCounty) coordinateSource = 'cross_county_office';
    else if (isCityApprox || !hasAddress) coordinateSource = 'city_center_approx';

    let confidence: ServiceValidationConfidence = 'verified';
    if (isCityApprox || !hasAddress) confidence = 'approximate';
    if (!insideNevada || (!insideExpectedCounty && !isCrossCounty)) confidence = 'unverified';

    records.set(service.id, {
      serviceId: service.id,
      name: service.name,
      county: service.county,
      city: service.city,
      hasAddress,
      coordinateSource,
      confidence,
      insideNevada,
      insideExpectedCounty,
      duplicateIds,
      issues,
      notes: service.notes,
    });
  });

  const values = Array.from(records.values());
  const summary: ServiceValidationSummary = {
    totalReviewed: services.length,
    verifiedCount: values.filter(r => r.confidence === 'verified').length,
    approximateCount: values.filter(r => r.confidence === 'approximate').length,
    unverifiedCount: values.filter(r => r.confidence === 'unverified').length,
    missingAddressCount: values.filter(r => !r.hasAddress).length,
    cityCenterApproxCount: values.filter(r => r.coordinateSource === 'city_center_approx').length,
    outOfCountyCount: values.filter(r => !r.insideExpectedCounty).length,
    outOfStateCount: values.filter(r => !r.insideNevada).length,
  };

  return { records, summary };
};

/** Check if a service record has validated coordinates suitable for pin placement */
export const isServiceCoordinateReliable = (record: ServiceValidationRecord): boolean => {
  return record.confidence !== 'unverified' && record.insideNevada;
};

/** Label for coordinate source display */
export const getServiceCoordinateSourceLabel = (source: ServiceCoordinateSource): string => {
  switch (source) {
    case 'address_geocode': return 'Address geocode';
    case 'city_center_approx': return 'City-center estimate';
    case 'cross_county_office': return 'Cross-county office';
  }
};
