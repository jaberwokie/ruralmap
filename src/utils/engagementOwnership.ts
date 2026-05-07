/**
 * Engagement Ownership — single source of truth for in-person vs remote
 * engagement availability for a county.
 *
 * Both the Engagement Ownership card and the Member Access recommendation
 * card MUST resolve their availability state through this helper so the two
 * surfaces cannot disagree (e.g. card says "In-Person: Not Available" while
 * the recommendation says "Local in-person engagement viable").
 *
 * Display-layer only. Does not change scoring, layers, filters, routing tiers,
 * field strain, geocoding, clustering, or coverage geometry.
 */

import { countyHasFieldCoverage } from '@/utils/fieldCoverageStatus';

export type EngagementOwnershipType = 'primary' | 'remote' | 'none';

export interface EngagementOwnership {
  /** Resolved county name (or null if not resolved). */
  county: string | null;
  /** True only when the county has meaningful in-person field FTE coverage. */
  inPersonAvailable: boolean;
  /** Telehealth/remote engagement availability (Primary or Remote CHW). */
  telehealthAvailable: boolean;
  /** Ownership type: primary CHW (field), remote CHW, or none. */
  ownershipType: EngagementOwnershipType;
  /** Header label as displayed by the Engagement Ownership card. */
  ownershipLabel: 'Primary CHW Coverage' | 'Remote CHW Coverage' | 'No Engagement Ownership';
}

export function getEngagementOwnership(county: string | null | undefined): EngagementOwnership {
  if (!county) {
    return {
      county: null,
      inPersonAvailable: false,
      telehealthAvailable: false,
      ownershipType: 'none',
      ownershipLabel: 'No Engagement Ownership',
    };
  }
  const isPrimary = countyHasFieldCoverage(county);
  return {
    county,
    inPersonAvailable: isPrimary,
    // Mirrors EngagementOwnershipBlock: telehealth is always available when a
    // county is resolved (Remote CHW is the fallback ownership state).
    telehealthAvailable: true,
    ownershipType: isPrimary ? 'primary' : 'remote',
    ownershipLabel: isPrimary ? 'Primary CHW Coverage' : 'Remote CHW Coverage',
  };
}
