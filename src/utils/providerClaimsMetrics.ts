import { Facility } from '@/data/facilities';
import { providerUtilizationData, ProviderUtilization } from '@/data/provider-utilization';
import { memberVolumeData } from '@/data/member-volume';

export interface ProviderClaimsMetrics {
  totalMembersAttributed: number;
  membersSeen: number;
  visitPenetrationRate: number;
  totalEncounters: number;
  avgEncountersPerSeenMember: number;
}

// Build county → totalMembers lookup
const countyMemberMap = new Map<string, number>(
  memberVolumeData.map(m => [m.county, m.memberCount])
);

// Build name → utilization lookup (uppercase key for matching)
const utilByName = new Map<string, ProviderUtilization>(
  providerUtilizationData.map(u => [u.name.toUpperCase(), u])
);

// Precomputed metrics cache keyed by facility id
const metricsCache = new Map<string, ProviderClaimsMetrics>();

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[,.\-]/g, '').replace(/\s+/g, ' ').trim();
}

function findUtilization(facility: Facility): ProviderUtilization | null {
  // Exact match first
  const exact = utilByName.get(facility.name.toUpperCase());
  if (exact) return exact;

  // Normalized match
  const normalizedFacility = normalizeName(facility.name);
  for (const [key, val] of utilByName) {
    if (normalizeName(key) === normalizedFacility) return val;
  }

  // Substring containment
  for (const [key, val] of utilByName) {
    if (key.includes(normalizedFacility) || normalizedFacility.includes(normalizeName(key))) {
      return val;
    }
  }

  return null;
}

export function getProviderClaimsMetrics(facility: Facility): ProviderClaimsMetrics | null {
  const cached = metricsCache.get(facility.id);
  if (cached) return cached;

  const util = findUtilization(facility);
  if (!util) return null;

  const totalMembersAttributed = countyMemberMap.get(facility.county) ?? 0;
  const membersSeen = util.totalMembers;
  const totalEncounters = util.totalVisits;

  const visitPenetrationRate = totalMembersAttributed > 0
    ? membersSeen / totalMembersAttributed
    : 0;

  const avgEncountersPerSeenMember = membersSeen > 0
    ? totalEncounters / membersSeen
    : 0;

  const metrics: ProviderClaimsMetrics = {
    totalMembersAttributed,
    membersSeen,
    visitPenetrationRate,
    totalEncounters,
    avgEncountersPerSeenMember,
  };

  metricsCache.set(facility.id, metrics);
  return metrics;
}
