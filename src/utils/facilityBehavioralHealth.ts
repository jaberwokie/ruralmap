import type { Facility } from '@/data/facilities';
import { ruralServices, type RuralService } from '@/data/rural-services';
import { isBehavioralHealthService } from '@/utils/ruralServiceClassification';

const BEHAVIORAL_HEALTH_TEXT_PATTERNS = [
  /\bbehavioral\s+health\b/i,
  /\bmental\s+health\b/i,
  /\bsubstance\s+use\b/i,
  /\bcounsel(?:ing|ling)\b/i,
  /\bpsych(?:iatry|iatric|otherapy)?\b/i,
  /\btherapeutic\b/i,
  /\btherapy\b/i,
  /\b(?:^|\W)bh(?:\W|$)/i,
];

const GENERIC_NAME_TOKENS = new Set([
  'and', 'behavioral', 'center', 'centers', 'clinic', 'clinics', 'community', 'county', 'health', 'hospital',
  'llc', 'inc', 'medical', 'of', 'outpatient', 'physician', 'regional', 'services', 'state', 'the', 'treatment',
]);

const MAX_NEARBY_MATCH_KM = 1.2;

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tokenizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !GENERIC_NAME_TOKENS.has(token));

const hasBehavioralHealthText = (facility: Facility) => {
  const text = [facility.name, facility.notes, facility.service].filter(Boolean).join(' ');
  return BEHAVIORAL_HEALTH_TEXT_PATTERNS.some((pattern) => pattern.test(text));
};

const sharesOrganizationIdentity = (facility: Facility, service: RuralService) => {
  const facilityTokens = new Set(tokenizeName(facility.name));
  const serviceTokens = tokenizeName(service.name);
  const overlapCount = serviceTokens.filter((token) => facilityTokens.has(token)).length;
  return overlapCount >= 1;
};

const hasNearbyBehavioralHealthService = (facility: Facility, services: RuralService[]) =>
  services.some((service) => {
    if (!isBehavioralHealthService(service)) return false;
    if (service.county !== facility.county) return false;

    const distanceKm = haversineKm(facility.lat, facility.lng, service.lat, service.lng);
    if (distanceKm > MAX_NEARBY_MATCH_KM) return false;

    return service.city === facility.city || sharesOrganizationIdentity(facility, service);
  });

export const facilityOffersBehavioralHealth = (facility: Facility, services: RuralService[] = ruralServices) => {
  if (facility.service === 'BH') return true;
  if (hasBehavioralHealthText(facility)) return true;
  return hasNearbyBehavioralHealthService(facility, services);
};
