/**
 * Service Routing Priority — deterministic, explainable ranking.
 *
 * Routing tiers:
 *   1. In-network tribal provider (highest)
 *   2. In-network non-tribal provider
 *   3. Nearest provider with warning (fallback)
 *
 * Each ranking is explainable in plain terms.
 */

import type { ServiceOperationalMeta, MedicaidParticipationStatus } from '@/types/medicaid';
import { resolveOperationalMeta } from '@/types/medicaid';

// ── Routing Tiers ──

export type ServiceRoutingTier =
  | 'preferred_tribal'    // in-network + tribal
  | 'preferred_standard'  // in-network + non-tribal
  | 'fallback_nearest';   // nearest regardless, with warning

export const ROUTING_TIER_LABELS: Record<ServiceRoutingTier, string> = {
  preferred_tribal: 'In-network Tribal Provider',
  preferred_standard: 'In-network Provider',
  fallback_nearest: 'Nearest Available',
};

export const ROUTING_TIER_PRIORITY: Record<ServiceRoutingTier, number> = {
  preferred_tribal: 1,
  preferred_standard: 2,
  fallback_nearest: 3,
};

// ── Tier Resolution ──

export const getServiceRoutingTier = (
  meta?: Partial<ServiceOperationalMeta> | null,
): ServiceRoutingTier => {
  const resolved = resolveOperationalMeta(meta);

  const isParticipating = resolved.medicaidParticipationStatus === 'participating';

  if (isParticipating && (resolved.isTribalProvider || resolved.isTriballyOperated)) {
    return 'preferred_tribal';
  }
  if (isParticipating) {
    return 'preferred_standard';
  }
  return 'fallback_nearest';
};

// ── Warning Generation ──

export const getServiceRoutingWarning = (
  meta?: Partial<ServiceOperationalMeta> | null,
): string | null => {
  const resolved = resolveOperationalMeta(meta);
  const tier = getServiceRoutingTier(resolved);

  if (tier !== 'fallback_nearest') return null;

  // Build warning from context
  const parts: string[] = [];

  if (resolved.medicaidParticipationStatus === 'unknown') {
    parts.push('Nevada Medicaid participation not confirmed.');
  } else if (resolved.medicaidParticipationStatus === 'non_participating') {
    parts.push('Not a Nevada Medicaid participating provider.');
  }

  if (resolved.isCrossBorderService) {
    parts.push('Out-of-state or cross-border reimbursement may need verification.');
  }

  if (resolved.serviceAccessWarning) {
    parts.push(resolved.serviceAccessWarning);
  }

  return parts.length > 0
    ? `Nearest available option. ${parts.join(' ')}`
    : 'Nearest available option.';
};

// ── Candidate Ranking ──

export interface ServiceCandidate {
  id: string;
  distanceKm: number;
  meta: Partial<ServiceOperationalMeta> | null;
}

export interface RankedServiceCandidate extends ServiceCandidate {
  tier: ServiceRoutingTier;
  tierPriority: number;
  warning: string | null;
  tierLabel: string;
}

/**
 * Rank service candidates by routing priority, then by distance.
 * Result is deterministic and inspectable.
 */
export const rankServiceCandidates = (
  candidates: ServiceCandidate[],
): RankedServiceCandidate[] => {
  return candidates
    .map((candidate) => {
      const tier = getServiceRoutingTier(candidate.meta);
      return {
        ...candidate,
        tier,
        tierPriority: ROUTING_TIER_PRIORITY[tier],
        warning: getServiceRoutingWarning(candidate.meta),
        tierLabel: ROUTING_TIER_LABELS[tier],
      };
    })
    .sort((a, b) => {
      // Primary: tier priority (lower = better)
      if (a.tierPriority !== b.tierPriority) return a.tierPriority - b.tierPriority;
      // Secondary: distance (closer = better)
      return a.distanceKm - b.distanceKm;
    });
};

// ── Explanation Helper ──

/**
 * Generate a plain-language explanation for why a service was ranked at its tier.
 */
export const explainRoutingDecision = (
  meta?: Partial<ServiceOperationalMeta> | null,
): string => {
  const resolved = resolveOperationalMeta(meta);
  const tier = getServiceRoutingTier(resolved);

  switch (tier) {
    case 'preferred_tribal':
      return 'Nevada Medicaid participating tribal provider. Preferred routing.';
    case 'preferred_standard':
      return 'Nevada Medicaid participating provider.';
    case 'fallback_nearest':
      return getServiceRoutingWarning(resolved) ?? 'Nearest available option.';
  }
};
