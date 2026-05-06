/**
 * Provider / BH / service visibility helpers — stable re-export surface.
 * All thresholds and classifications remain in their existing modules.
 */
export {
  PROVIDER_ACCESS_TIER_LABELS,
  getProviderAccessTierByMiles,
  getProviderAccessTierByKm,
  getProviderAccessTierLabelByKm,
} from '@/utils/providerAccessTiers';
export type { ProviderAccessTier } from '@/utils/providerAccessTiers';

export {
  BEHAVIORAL_HEALTH_SERVICE_CATEGORIES,
  isBehavioralHealthService,
  isCommunitySupportService,
} from '@/utils/ruralServiceClassification';

export { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
