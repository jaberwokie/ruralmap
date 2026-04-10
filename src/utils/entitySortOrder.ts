/**
 * Deterministic entity sort by routing tier → verification confidence → name.
 *
 * Priority:
 *   1. Recommended (verified_participating + direct confidence)
 *   2. NPI Confirmed (needs_verification + inferred_strong)
 *   3. Unverified / unknown
 *   4. Fallback (deferred, non-participating)
 *   5. Alphabetical tie-breaker
 */

import { getOperationalTagIndex } from '@/data/operational-metadata';
import { resolveOperationalMeta } from '@/types/medicaid';

/** Numeric priority — lower = higher priority */
const resolveEntitySortPriority = (entityId: string): number => {
  const tag = getOperationalTagIndex().get(entityId);
  if (!tag) return 3; // untagged → unverified

  // Deferred → fallback
  if (tag.verificationStatus === 'deferred') return 4;

  // Verified participating + direct confidence → recommended
  if (tag.verificationStatus === 'verified_participating' && tag.verificationConfidence === 'direct') return 1;

  // Legacy facility tags (no verificationStatus but participating) → recommended
  if (!tag.verificationStatus && tag.isNevadaMedicaidParticipating === true) return 1;

  // NPI confirmed but unverified enrollment
  if (tag.verificationStatus === 'needs_verification' && tag.verificationConfidence === 'inferred_strong') return 2;

  // Non-participating → fallback
  const resolved = resolveOperationalMeta({
    medicaidParticipationStatus:
      tag.isNevadaMedicaidParticipating === true ? 'participating'
        : tag.isNevadaMedicaidParticipating === false ? 'non_participating'
        : 'unknown',
  });
  if (resolved.medicaidParticipationStatus === 'non_participating') return 4;

  // Unknown / unverified
  return 3;
};

/**
 * Compare two entities for sorting. Use with Array.prototype.sort().
 * Requires each item to have `id` (entityId) and `name` (display name).
 */
export const compareEntitiesByOperationalPriority = (
  a: { id: string; name: string },
  b: { id: string; name: string },
): number => {
  const pa = resolveEntitySortPriority(a.id);
  const pb = resolveEntitySortPriority(b.id);
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
};

/**
 * Sort an array of entities in-place by operational priority.
 * Returns a new sorted array (does not mutate input).
 */
export const sortEntitiesByOperationalPriority = <T extends { id: string; name: string }>(
  entities: T[],
): T[] => [...entities].sort(compareEntitiesByOperationalPriority);
