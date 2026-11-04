/**
 * No payer-specific claims or provider utilization figures ship with the
 * independent edition. Provider-location records are preserved separately.
 */
export interface ProviderUtilization {
  name: string;
  totalMembers: number;
  totalVisits: number;
  visitsPerMember: number;
  rank: number;
  providerTypes: string[];
}
export const providerUtilizationData: ProviderUtilization[] = [];
export function getProviderUtilization(_name: string): ProviderUtilization | undefined {
  return undefined;
}
