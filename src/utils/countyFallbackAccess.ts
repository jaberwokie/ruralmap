/**
 * Derived fallback destination layer for psychiatric and inpatient access.
 * Pure derivation — no source data mutations.
 */
import { defaultFacilities, countyHasHospital, type Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import { derivePsychiatricAccess, deriveInpatientAccess } from '@/types/service-lines';

// ── Types ──

export type PsychFallbackReason = 'zero_verified_psychiatry' | 'no_psychiatry_offered' | 'verification_needed' | 'unknown';
export type InpatientFallbackReason = 'no_hospital_in_county' | 'transfer_dependent' | 'zero_verified_inpatient' | 'verification_needed' | 'unknown';

export interface CountyFallbackResult {
  county: string;
  psychiatric_fallback_needed: boolean;
  psychiatric_fallback_county: string | null;
  psychiatric_fallback_entity_id: string | null;
  psychiatric_fallback_entity_name: string | null;
  psychiatric_fallback_reason: PsychFallbackReason | null;
  inpatient_fallback_needed: boolean;
  inpatient_fallback_county: string | null;
  inpatient_fallback_entity_id: string | null;
  inpatient_fallback_entity_name: string | null;
  inpatient_fallback_reason: InpatientFallbackReason | null;
}

export const PSYCH_FALLBACK_REASON_LABELS: Record<PsychFallbackReason, string> = {
  zero_verified_psychiatry: 'No verified psychiatry in county',
  no_psychiatry_offered: 'No psychiatry offered in county',
  verification_needed: 'Verification still needed',
  unknown: 'Unknown',
};

export const INPATIENT_FALLBACK_REASON_LABELS: Record<InpatientFallbackReason, string> = {
  no_hospital_in_county: 'No hospital in county',
  transfer_dependent: 'Local inpatient is transfer dependent',
  zero_verified_inpatient: 'No verified inpatient in county',
  verification_needed: 'Verification still needed',
  unknown: 'Unknown',
};

// ── Haversine helper ──

const toRad = (d: number) => (d * Math.PI) / 180;
const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getCountyCenter = (county: string): [number, number] | null => {
  const c = nevadaCounties.find(nc => nc.name === county);
  return c ? c.center : null;
};

// ── Derivation ──

const VERIFIED = ['directly_verified', 'verified_via_directory'] as const;

function findNearestPsychFallback(fromCounty: string): { entity: Facility; county: string } | null {
  const center = getCountyCenter(fromCounty);
  if (!center) return null;

  const candidates = defaultFacilities
    .filter(f => f.county !== fromCounty && f.type !== 'hospital')
    .map(f => ({ f, access: derivePsychiatricAccess(f.psychiatric) }))
    .filter(({ access }) => access === 'operationally_usable' || access === 'fragile_access')
    .map(({ f, access }) => ({
      f,
      priority: access === 'operationally_usable' ? 0 : 1,
      dist: haversine(center[0], center[1], f.lat, f.lng),
    }))
    .sort((a, b) => a.priority - b.priority || a.dist - b.dist);

  if (candidates.length === 0) {
    // fallback to verified_via_directory
    const dirCandidates = defaultFacilities
      .filter(f => f.county !== fromCounty && f.type !== 'hospital' && f.psychiatric?.psychiatric_verification_status != null && VERIFIED.includes(f.psychiatric.psychiatric_verification_status as any))
      .map(f => ({ f, dist: haversine(center[0], center[1], f.lat, f.lng) }))
      .sort((a, b) => a.dist - b.dist);
    if (dirCandidates.length > 0) return { entity: dirCandidates[0].f, county: dirCandidates[0].f.county };
    return null;
  }

  return { entity: candidates[0].f, county: candidates[0].f.county };
}

function findNearestInpatientFallback(fromCounty: string): { entity: Facility; county: string } | null {
  const center = getCountyCenter(fromCounty);
  if (!center) return null;

  const candidates = defaultFacilities
    .filter(f => f.county !== fromCounty && f.type === 'hospital' && f.inpatient)
    .map(f => ({ f, access: deriveInpatientAccess(f.inpatient) }))
    .filter(({ access }) => access === 'operationally_usable' || access === 'fragile_access')
    .map(({ f, access }) => ({
      f,
      priority: access === 'operationally_usable' ? 0 : 1,
      dist: haversine(center[0], center[1], f.lat, f.lng),
    }))
    .sort((a, b) => a.priority - b.priority || a.dist - b.dist);

  if (candidates.length === 0) {
    const modCandidates = defaultFacilities
      .filter(f => f.county !== fromCounty && f.type === 'hospital' && f.inpatient?.inpatient_verification_status != null && VERIFIED.includes(f.inpatient.inpatient_verification_status as any) && f.inpatient?.inpatient_transfer_dependency === 'moderate')
      .map(f => ({ f, dist: haversine(center[0], center[1], f.lat, f.lng) }))
      .sort((a, b) => a.dist - b.dist);
    if (modCandidates.length > 0) return { entity: modCandidates[0].f, county: modCandidates[0].f.county };
    // last resort: any verified hospital
    const anyCandidates = defaultFacilities
      .filter(f => f.county !== fromCounty && f.type === 'hospital' && f.inpatient?.inpatient_verification_status != null && VERIFIED.includes(f.inpatient.inpatient_verification_status as any))
      .map(f => ({ f, dist: haversine(center[0], center[1], f.lat, f.lng) }))
      .sort((a, b) => a.dist - b.dist);
    if (anyCandidates.length > 0) return { entity: anyCandidates[0].f, county: anyCandidates[0].f.county };
    return null;
  }

  return { entity: candidates[0].f, county: candidates[0].f.county };
}

export function deriveCountyFallback(county: string): CountyFallbackResult {
  const countyFacs = defaultFacilities.filter(f => f.county === county);
  const providers = countyFacs.filter(f => f.type !== 'hospital');
  const hospitals = countyFacs.filter(f => f.type === 'hospital');

  // ── Psychiatric fallback ──
  const psychProviders = providers.filter(f => f.psychiatric);
  const offeredPsych = psychProviders.filter(f => f.psychiatric?.psychiatric_services_offered === true);
  const verifiedPsych = psychProviders.filter(f => f.psychiatric?.psychiatric_verification_status != null && VERIFIED.includes(f.psychiatric!.psychiatric_verification_status as any));
  const allNotOffered = psychProviders.length > 0 && psychProviders.every(f => f.psychiatric?.psychiatric_services_offered === false || f.psychiatric?.psychiatric_verification_status === 'not_offered');
  const allVerifNeeded = offeredPsych.length > 0 && offeredPsych.every(f => derivePsychiatricAccess(f.psychiatric) === 'verification_needed');

  let psychFallbackNeeded = false;
  let psychReason: PsychFallbackReason | null = null;

  if (offeredPsych.length === 0 && (psychProviders.length === 0 || allNotOffered)) {
    psychFallbackNeeded = true;
    psychReason = 'no_psychiatry_offered';
  } else if (verifiedPsych.length === 0 && offeredPsych.length > 0) {
    psychFallbackNeeded = true;
    psychReason = allVerifNeeded ? 'verification_needed' : 'zero_verified_psychiatry';
  }

  let psychFallback: { entity: Facility; county: string } | null = null;
  if (psychFallbackNeeded) {
    psychFallback = findNearestPsychFallback(county);
  }

  // ── Inpatient fallback ──
  const hasHosp = countyHasHospital(county);
  const inpHospitals = hospitals.filter(f => f.inpatient);
  const verifiedInp = inpHospitals.filter(f => f.inpatient?.inpatient_verification_status != null && VERIFIED.includes(f.inpatient!.inpatient_verification_status as any));
  const allTransferDep = inpHospitals.length > 0 && inpHospitals.every(f => deriveInpatientAccess(f.inpatient) === 'transfer_dependent');
  const allInpVerifNeeded = inpHospitals.length > 0 && inpHospitals.every(f => deriveInpatientAccess(f.inpatient) === 'verification_needed');

  let inpFallbackNeeded = false;
  let inpReason: InpatientFallbackReason | null = null;

  if (!hasHosp) {
    inpFallbackNeeded = true;
    inpReason = 'no_hospital_in_county';
  } else if (verifiedInp.length === 0 && inpHospitals.length > 0) {
    inpFallbackNeeded = true;
    inpReason = allInpVerifNeeded ? 'verification_needed' : 'zero_verified_inpatient';
  } else if (allTransferDep) {
    inpFallbackNeeded = true;
    inpReason = 'transfer_dependent';
  }

  let inpFallback: { entity: Facility; county: string } | null = null;
  if (inpFallbackNeeded) {
    inpFallback = findNearestInpatientFallback(county);
  }

  return {
    county,
    psychiatric_fallback_needed: psychFallbackNeeded,
    psychiatric_fallback_county: psychFallback?.county ?? null,
    psychiatric_fallback_entity_id: psychFallback?.entity.id ?? null,
    psychiatric_fallback_entity_name: psychFallback?.entity.name ?? null,
    psychiatric_fallback_reason: psychReason,
    inpatient_fallback_needed: inpFallbackNeeded,
    inpatient_fallback_county: inpFallback?.county ?? null,
    inpatient_fallback_entity_id: inpFallback?.entity.id ?? null,
    inpatient_fallback_entity_name: inpFallback?.entity.name ?? null,
    inpatient_fallback_reason: inpReason,
  };
}

/** Summary counts across all counties present in facility data */
export function getFallbackSummaryCounts() {
  const allCounties = Array.from(new Set(defaultFacilities.map(f => f.county)));
  const results = allCounties.map(deriveCountyFallback);
  return {
    countiesNeedingPsychFallback: results.filter(r => r.psychiatric_fallback_needed).length,
    countiesNeedingInpatientFallback: results.filter(r => r.inpatient_fallback_needed).length,
    countiesWithNoHospital: results.filter(r => r.inpatient_fallback_reason === 'no_hospital_in_county').length,
    countiesWithZeroVerifiedPsych: results.filter(r => r.psychiatric_fallback_reason === 'zero_verified_psychiatry' || r.psychiatric_fallback_reason === 'verification_needed').length,
    countiesWithTransferDependentOnly: results.filter(r => r.inpatient_fallback_reason === 'transfer_dependent').length,
  };
}
