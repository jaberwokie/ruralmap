import { kmToMiles } from '@/utils/coverageZones';

export type ProviderAccessTier = 'strong' | 'conditional' | 'weak' | 'gap';

export const PROVIDER_ACCESS_TIER_LABELS: Record<ProviderAccessTier, string> = {
  strong: 'Strong Access',
  conditional: 'Conditional Access',
  weak: 'Weak Access',
  gap: 'Access Gap',
};

export const getProviderAccessTierByMiles = (miles: number): ProviderAccessTier => {
  if (miles <= 15) return 'strong';
  if (miles <= 30) return 'conditional';
  if (miles <= 45) return 'weak';
  return 'gap';
};

export const getProviderAccessTierByKm = (km: number): ProviderAccessTier => getProviderAccessTierByMiles(kmToMiles(km));

export const getProviderAccessTierLabelByKm = (km: number) => PROVIDER_ACCESS_TIER_LABELS[getProviderAccessTierByKm(km)];
