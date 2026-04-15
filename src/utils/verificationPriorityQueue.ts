/**
 * Derived verification priority queue for psychiatric and inpatient service-lines.
 * Pure derivation — no source data mutations.
 */
import { defaultFacilities, countyHasHospital, type Facility } from '@/data/facilities';
import { nevadaCounties } from '@/data/nevada-counties';
import {
  derivePsychiatricAccess, deriveInpatientAccess,
  derivePsychiatricFreshness, deriveInpatientFreshness,
  type PsychiatricOperationalAccess, type InpatientOperationalAccess,
  type VerificationFreshness,
} from '@/types/service-lines';
import { deriveCountyFallback } from '@/utils/countyFallbackAccess';

// ── Types ──

export type PriorityTier = 'high' | 'medium' | 'low';

export interface VerificationPriorityRecord {
  entity_id: string;
  entity_name: string;
  entity_type: 'provider' | 'hospital';
  county: string;
  service_line: 'psychiatry' | 'inpatient';
  operational_access: string | null;
  verification_status: string | null;
  verification_freshness: VerificationFreshness | null;
  is_fallback_destination: boolean;
  dependent_counties: string[];
  dependent_county_count: number;
  priority_score: number;
  priority_tier: PriorityTier;
  priority_reason: string[];
}

// ── Helpers ──

const VERIFIED_STATUSES = ['directly_verified', 'verified_via_directory'];

/** Build a map of entity_id → counties that depend on it as a fallback */
function buildFallbackDependencyMap(): {
  psychMap: Map<string, string[]>;
  inpatientMap: Map<string, string[]>;
} {
  const psychMap = new Map<string, string[]>();
  const inpatientMap = new Map<string, string[]>();

  const allCounties = Array.from(new Set(defaultFacilities.map(f => f.county)));
  // Also include counties from nevadaCounties that might not have facilities
  for (const nc of nevadaCounties) {
    if (!allCounties.includes(nc.name)) allCounties.push(nc.name);
  }

  for (const county of allCounties) {
    const fb = deriveCountyFallback(county);
    if (fb.psychiatric_fallback_needed && fb.psychiatric_fallback_entity_id) {
      const existing = psychMap.get(fb.psychiatric_fallback_entity_id) ?? [];
      existing.push(county);
      psychMap.set(fb.psychiatric_fallback_entity_id, existing);
    }
    if (fb.inpatient_fallback_needed && fb.inpatient_fallback_entity_id) {
      const existing = inpatientMap.get(fb.inpatient_fallback_entity_id) ?? [];
      existing.push(county);
      inpatientMap.set(fb.inpatient_fallback_entity_id, existing);
    }
  }

  return { psychMap, inpatientMap };
}

/** Count verified psychiatric providers in a county */
function countyVerifiedPsychCount(county: string): number {
  return defaultFacilities.filter(f =>
    f.county === county && f.type !== 'hospital' &&
    f.psychiatric?.psychiatric_verification_status != null &&
    VERIFIED_STATUSES.includes(f.psychiatric.psychiatric_verification_status)
  ).length;
}

/** Count psychiatric providers in a county */
function countyPsychProviderCount(county: string): number {
  return defaultFacilities.filter(f =>
    f.county === county && f.type !== 'hospital' &&
    (f.psychiatric?.psychiatric_services_offered === true ||
     f.psychiatric?.psychiatric_verification_status != null)
  ).length;
}

function assignTier(score: number): PriorityTier {
  if (score >= 10) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

// ── Main derivation ──

export function deriveVerificationQueue(): VerificationPriorityRecord[] {
  const { psychMap, inpatientMap } = buildFallbackDependencyMap();
  const records: VerificationPriorityRecord[] = [];

  for (const f of defaultFacilities) {
    // Psychiatric queue (provider entities only)
    if (f.type !== 'hospital' && (
      f.psychiatric?.psychiatric_services_offered === true ||
      f.psychiatric?.psychiatric_verification_status != null
    )) {
      // Skip not_offered unless it's a fallback destination (shouldn't normally happen)
      if (f.psychiatric?.psychiatric_verification_status === 'not_offered' && !psychMap.has(f.id)) {
        // skip
      } else {
        const access = derivePsychiatricAccess(f.psychiatric);
        const freshness = derivePsychiatricFreshness(f.psychiatric);
        const isFallback = psychMap.has(f.id);
        const depCounties = psychMap.get(f.id) ?? [];
        const depCount = depCounties.length;

        let score = 0;
        const reasons: string[] = [];

        if (freshness === 'stale') { score += 4; reasons.push('Stale verification'); }
        if (freshness === 'unknown') { score += 3; reasons.push('Unknown verification date'); }
        if (access === 'fragile_access') { score += 3; reasons.push('Fragile access'); }
        if (access === 'verification_needed') { score += 4; reasons.push('Verification needed'); }
        if (isFallback) { score += 4; reasons.push('Used as fallback destination'); }
        if (depCount >= 2) { score += 2; reasons.push('Multiple counties depend on this entity'); }
        if (countyVerifiedPsychCount(f.county) === 0) { score += 3; reasons.push('County has zero verified psychiatric providers'); }
        if (countyPsychProviderCount(f.county) === 1) { score += 2; reasons.push('Only likely psychiatric source in county'); }
        if (f.psychiatric?.psychiatric_medicaid_status === 'participating') { score += 1; reasons.push('Medicaid participating'); }

        records.push({
          entity_id: f.id,
          entity_name: f.name,
          entity_type: 'provider',
          county: f.county,
          service_line: 'psychiatry',
          operational_access: access,
          verification_status: f.psychiatric?.psychiatric_verification_status ?? null,
          verification_freshness: freshness,
          is_fallback_destination: isFallback,
          dependent_counties: depCounties,
          dependent_county_count: depCount,
          priority_score: score,
          priority_tier: assignTier(score),
          priority_reason: reasons,
        });
      }
    }

    // Inpatient queue (hospital entities only)
    if (f.type === 'hospital' && (
      f.inpatient?.inpatient_services_offered === true ||
      f.inpatient?.inpatient_verification_status != null
    )) {
      if (f.inpatient?.inpatient_verification_status === 'not_offered' && !inpatientMap.has(f.id)) {
        // skip
      } else {
        const access = deriveInpatientAccess(f.inpatient);
        const freshness = deriveInpatientFreshness(f.inpatient);
        const isFallback = inpatientMap.has(f.id);
        const depCounties = inpatientMap.get(f.id) ?? [];
        const depCount = depCounties.length;

        let score = 0;
        const reasons: string[] = [];

        if (freshness === 'stale') { score += 4; reasons.push('Stale verification'); }
        if (freshness === 'unknown') { score += 3; reasons.push('Unknown verification date'); }
        if (access === 'fragile_access') { score += 3; reasons.push('Fragile access'); }
        if (access === 'transfer_dependent') { score += 4; reasons.push('Transfer dependent hospital'); }
        if (access === 'verification_needed') { score += 4; reasons.push('Verification needed'); }
        if (isFallback) { score += 4; reasons.push('Used as fallback destination'); }
        if (depCount >= 2) { score += 2; reasons.push('Multiple counties depend on this entity'); }
        // Check if any dependent county has no hospital
        const depNoHosp = depCounties.filter(c => !countyHasHospital(c));
        if (depNoHosp.length > 0) { score += 3; reasons.push('No hospital in dependent county'); }
        if (f.inpatient?.inpatient_transfer_dependency === 'high') { score += 2; reasons.push('High transfer dependency'); }
        if (f.inpatient?.inpatient_medicaid_status === 'participating') { score += 1; reasons.push('Medicaid participating'); }

        records.push({
          entity_id: f.id,
          entity_name: f.name,
          entity_type: 'hospital',
          county: f.county,
          service_line: 'inpatient',
          operational_access: access,
          verification_status: f.inpatient?.inpatient_verification_status ?? null,
          verification_freshness: freshness,
          is_fallback_destination: isFallback,
          dependent_counties: depCounties,
          dependent_county_count: depCount,
          priority_score: score,
          priority_tier: assignTier(score),
          priority_reason: reasons,
        });
      }
    }
  }

  // Sort: high > medium > low, then by score desc, then by name
  const tierOrder: Record<PriorityTier, number> = { high: 0, medium: 1, low: 2 };
  records.sort((a, b) =>
    tierOrder[a.priority_tier] - tierOrder[b.priority_tier] ||
    b.priority_score - a.priority_score ||
    a.entity_name.localeCompare(b.entity_name)
  );

  return records;
}

/** Summary counts for optional county summary append */
export function getVerificationQueueSummary() {
  const queue = deriveVerificationQueue();
  return {
    highPriorityPsychiatric: queue.filter(r => r.service_line === 'psychiatry' && r.priority_tier === 'high').length,
    highPriorityInpatient: queue.filter(r => r.service_line === 'inpatient' && r.priority_tier === 'high').length,
    totalPsychiatric: queue.filter(r => r.service_line === 'psychiatry').length,
    totalInpatient: queue.filter(r => r.service_line === 'inpatient').length,
  };
}

// ── Display labels ──

export const PRIORITY_TIER_LABELS: Record<PriorityTier, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_TIER_COLORS: Record<PriorityTier, string> = {
  high: 'text-destructive',
  medium: 'text-amber-600',
  low: 'text-muted-foreground',
};
