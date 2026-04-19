/**
 * Deterministic, rule-based "Recommended Next Step" guidance for a provider.
 *
 * Strictly display-layer logic. Does not change scoring, queue, badges, filters,
 * or any underlying verification model. Wording is grounded and operational.
 */

import type { Facility } from '@/data/facilities';
import type { ProviderEnrichmentRecord } from '@/utils/providerEnrichmentStore';
import { resolveOperationalMeta } from '@/types/medicaid';

export type NextStepTone = 'go' | 'caution' | 'verify' | 'fallback';

export interface RecommendedNextStep {
  /** Short label */
  title: string;
  /** One-sentence guidance */
  detail: string;
  tone: NextStepTone;
}

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const memberTier = (mi: number): 'tier1' | 'tier2' | 'tier3' | 'nonViable' => {
  if (mi <= 10) return 'tier1';
  if (mi <= 25) return 'tier2';
  if (mi <= 40) return 'tier3';
  return 'nonViable';
};

const isVerified = (facility: Facility): boolean => {
  const meta = resolveOperationalMeta(facility.id, 'facility');
  if (meta?.verificationStatus === 'verified_participating') return true;
  if (meta?.verificationStatus === 'verified_non_participating') return true;
  // Service-line directory verification also counts as verified record
  if (facility.psychiatric?.psychiatric_verification_status === 'verified_via_directory') return true;
  if (facility.inpatient?.inpatient_verification_status === 'verified_via_directory') return true;
  return false;
};

const enrichmentHasContact = (e?: ProviderEnrichmentRecord): boolean => {
  if (!e) return false;
  return !!(e.imported_phone?.trim() || e.imported_website?.trim());
};

export const deriveRecommendedNextStep = (
  facility: Facility,
  enrichment: ProviderEnrichmentRecord | undefined,
  memberLocation: { lat: number; lng: number } | null,
): RecommendedNextStep => {
  const verified = isVerified(facility);
  const hasContact = !!(facility.phone || facility.website || enrichmentHasContact(enrichment));

  // Distance gating only applies when a member is selected
  let tier: 'tier1' | 'tier2' | 'tier3' | 'nonViable' | null = null;
  if (memberLocation) {
    const mi = haversineMi(memberLocation.lat, memberLocation.lng, facility.lat, facility.lng);
    tier = memberTier(mi);
  }

  if (verified && tier === 'nonViable') {
    return {
      title: 'Consider closer alternatives first',
      detail: 'Verified resource, but distance makes routine engagement impractical. Use only if no closer option exists.',
      tone: 'fallback',
    };
  }

  if (verified && (tier === 'tier1' || tier === 'tier2')) {
    return {
      title: 'Direct referral recommended',
      detail: 'Verified resource within practical access range. Refer directly.',
      tone: 'go',
    };
  }

  if (verified && tier === 'tier3') {
    return {
      title: 'Referral possible — confirm transport',
      detail: 'Verified resource, but at high-friction distance. Confirm transportation and access barriers first.',
      tone: 'caution',
    };
  }

  if (verified && tier === null) {
    return {
      title: 'Direct referral recommended',
      detail: 'Verified resource. Confirm member-side access factors before scheduling.',
      tone: 'go',
    };
  }

  // Unverified branch
  if (!verified && hasContact) {
    return {
      title: 'Call to verify before referring',
      detail: 'Resource not verified through current operational metadata. Confirm details directly before referral.',
      tone: 'verify',
    };
  }

  return {
    title: 'Verify resource details first',
    detail: 'Resource not verified and lacks reliable contact information. Confirm availability before relying on this option.',
    tone: 'verify',
  };
};
