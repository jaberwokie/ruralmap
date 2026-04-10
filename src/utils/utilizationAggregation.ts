import { providerUtilizationData, getProviderUtilization, ProviderUtilization } from '@/data/provider-utilization';
import { defaultFacilities, Facility } from '@/data/facilities';
import { fteCapacityData } from '@/data/fte-capacity';
import { memberVolumeData } from '@/data/member-volume';
import { engagedMemberVolumeData } from '@/data/engaged-member-volume';
import { nevadaCounties } from '@/data/nevada-counties';

// ── Provider-level utilization for facility pins ──

export interface FacilityUtilization {
  totalMembers: number;
  totalVisits: number;
  visitsPerMember: number;
  rank: number;
}

const _facilityUtilCache = new Map<string, FacilityUtilization | null>();

export function getFacilityUtilization(facility: Facility): FacilityUtilization | null {
  if (_facilityUtilCache.has(facility.id)) return _facilityUtilCache.get(facility.id)!;
  const match = getProviderUtilization(facility.name);
  if (!match) { _facilityUtilCache.set(facility.id, null); return null; }
  const result: FacilityUtilization = {
    totalMembers: match.totalMembers,
    totalVisits: match.totalVisits,
    visitsPerMember: match.visitsPerMember,
    rank: match.rank,
  };
  _facilityUtilCache.set(facility.id, result);
  return result;
}

// ── Sub-county Washoe zone split ──
// Latitude threshold: facilities north of this are "Northern Washoe" (rural).
// Reno/Sparks core sits at ~39.50–39.55; 39.60 cleanly separates.
export const WASHOE_URBAN_RURAL_LAT = 39.60;

/** Excluded from all engagement gap logic */
const ENGAGEMENT_GAP_EXCLUDED_COUNTIES = new Set(['Carson City']);
const NEVADA_COUNTY_NAMES = new Set(nevadaCounties.map((county) => county.name));

export function isUrbanWashoe(facility: Facility): boolean {
  return facility.county === 'Washoe' && facility.lat <= WASHOE_URBAN_RURAL_LAT;
}

export function isNorthernWashoe(facility: Facility): boolean {
  return facility.county === 'Washoe' && facility.lat > WASHOE_URBAN_RURAL_LAT;
}

// ── County-level aggregation ──

export interface CountyUtilization {
  totalMembers: number;
  totalVisits: number;
  avgVisitsPerMember: number;
  activeProviderCount: number;
  topProviders: { name: string; visits: number }[];
  /** Whether CCC / CHW / field engagement is present */
  hasEngagementSupport: boolean;
  operationalRead: 'Stable' | 'Strained' | 'Under-engaged' | 'Low-access';
  engagementGap: boolean;
  /** Watchlist: moderate utilization without engagement support */
  engagementWatchlist: boolean;
  /** Early Signal: emerging utilization without engagement support */
  engagementEarlySignal: boolean;
}

export interface CountyEngagementMetrics {
  county: string;
  totalMembers: number;
  engagedMembers: number;
  unengagedMembers: number;
  engagementRate: number;
  rank: number;
  isTop5Unengaged: boolean;
}

// Counties with CCC/CHW/field engagement presence (based on FTE field assignments)
function countyHasEngagementSupport(county: string): boolean {
  return fteCapacityData
    .filter(f => f.hubLocation !== null) // field FTEs only
    .some(f => f.counties.includes(county));
}

function computeOperationalRead(
  avgVpm: number,
  providerCount: number,
  hasEngagement: boolean,
): CountyUtilization['operationalRead'] {
  const highUtil = avgVpm > 18;
  const modUtil = avgVpm >= 10;
  const lowUtil = avgVpm < 10;

  // Priority order: Under-engaged → Strained → Low-access → Stable
  if (avgVpm > 15 && !hasEngagement) return 'Under-engaged';
  if (highUtil && providerCount <= 3) return 'Strained';
  if (providerCount < 2 && lowUtil) return 'Low-access';
  if ((modUtil || highUtil) && hasEngagement) return 'Stable';
  return 'Stable';
}

const _countyUtilCache = new Map<string, CountyUtilization>();
let _countyEngagementRankingsCache: CountyEngagementMetrics[] | null = null;
const _countyEngagementCache = new Map<string, CountyEngagementMetrics>();

export function getCountyUtilization(county: string): CountyUtilization {
  if (_countyUtilCache.has(county)) return _countyUtilCache.get(county)!;

  // Find all facilities in this county that have utilization data
  const countyFacilities = defaultFacilities.filter(f => f.county === county);
  let totalMembers = 0;
  let totalVisits = 0;
  let activeProviderCount = 0;
  const providerList: { name: string; visits: number }[] = [];

  countyFacilities.forEach(f => {
    const util = getFacilityUtilization(f);
    if (util) {
      totalMembers += util.totalMembers;
      totalVisits += util.totalVisits;
      activeProviderCount++;
      providerList.push({ name: f.name, visits: util.totalVisits });
    }
  });

  const avgVisitsPerMember = totalMembers > 0 ? Math.round((totalVisits / totalMembers) * 100) / 100 : 0;
  const topProviders = providerList.sort((a, b) => b.visits - a.visits).slice(0, 3);
  const hasEngagement = countyHasEngagementSupport(county);

  // Engagement gap / watchlist / early signal (county-level; Washoe sub-county handled separately)
  const isExcluded = ENGAGEMENT_GAP_EXCLUDED_COUNTIES.has(county);
  const engagementGap = !isExcluded && county !== 'Washoe' && avgVisitsPerMember > 15 && !hasEngagement;
  const engagementWatchlist = !isExcluded && county !== 'Washoe' && avgVisitsPerMember > 10 && avgVisitsPerMember <= 15 && !hasEngagement;
  const engagementEarlySignal = !isExcluded && county !== 'Washoe' && avgVisitsPerMember > 6 && avgVisitsPerMember <= 10 && !hasEngagement;

  const operationalRead = computeOperationalRead(avgVisitsPerMember, activeProviderCount, hasEngagement);

  const result: CountyUtilization = {
    totalMembers,
    totalVisits,
    avgVisitsPerMember,
    activeProviderCount,
    topProviders,
    hasEngagementSupport: hasEngagement,
    operationalRead,
    engagementGap,
    engagementWatchlist,
    engagementEarlySignal,
  };
  _countyUtilCache.set(county, result);
  return result;
}

function buildCountyEngagementRankings(): CountyEngagementMetrics[] {
  if (_countyEngagementRankingsCache) return _countyEngagementRankingsCache;

  const totalMembersByCounty = new Map(
    memberVolumeData
      .filter(({ county }) => NEVADA_COUNTY_NAMES.has(county))
      .map(({ county, memberCount }) => [county, memberCount]),
  );

  const engagedMembersByCounty = new Map(
    engagedMemberVolumeData
      .filter(({ county }) => NEVADA_COUNTY_NAMES.has(county))
      .map(({ county, memberCount }) => [county, memberCount]),
  );

  const rankings = nevadaCounties
    .map(({ name }) => {
      const totalMembers = totalMembersByCounty.get(name) ?? 0;
      const engagedMembers = Math.min(engagedMembersByCounty.get(name) ?? 0, totalMembers);
      const unengagedMembers = Math.max(totalMembers - engagedMembers, 0);
      const engagementRate = totalMembers > 0 ? engagedMembers / totalMembers : 0;

      return {
        county: name,
        totalMembers,
        engagedMembers,
        unengagedMembers,
        engagementRate,
      };
    })
    .sort((left, right) => {
      if (right.unengagedMembers !== left.unengagedMembers) {
        return right.unengagedMembers - left.unengagedMembers;
      }

      const leftRate = left.totalMembers > 0 ? left.engagementRate : Number.POSITIVE_INFINITY;
      const rightRate = right.totalMembers > 0 ? right.engagementRate : Number.POSITIVE_INFINITY;
      if (leftRate !== rightRate) {
        return leftRate - rightRate;
      }

      return left.county.localeCompare(right.county);
    })
    .map((metrics, index) => ({
      ...metrics,
      rank: index + 1,
      isTop5Unengaged: index < 5,
    } satisfies CountyEngagementMetrics));

  _countyEngagementCache.clear();
  rankings.forEach((metrics) => {
    _countyEngagementCache.set(metrics.county, metrics);
  });

  _countyEngagementRankingsCache = rankings;
  return rankings;
}

export function getCountyEngagementMetrics(county: string): CountyEngagementMetrics {
  if (_countyEngagementCache.has(county)) return _countyEngagementCache.get(county)!;

  buildCountyEngagementRankings();

  return _countyEngagementCache.get(county) ?? {
    county,
    totalMembers: 0,
    engagedMembers: 0,
    unengagedMembers: 0,
    engagementRate: 0,
    rank: 0,
    isTop5Unengaged: false,
  };
}

export function getCountyEngagementRankings(): CountyEngagementMetrics[] {
  return buildCountyEngagementRankings();
}

export function getTopUnengagedCounties(limit = 5): CountyEngagementMetrics[] {
  return buildCountyEngagementRankings()
    .filter((metrics) => metrics.totalMembers > 0)
    .slice(0, limit);
}

export function getFilteredEngagementPriorityCounties(
  options: { belowRateThreshold?: number } = {},
): CountyEngagementMetrics[] {
  const { belowRateThreshold } = options;

  return buildCountyEngagementRankings().filter((metrics) => {
    if (metrics.totalMembers <= 0) return false;
    if (belowRateThreshold == null) return true;
    return metrics.engagementRate < belowRateThreshold;
  });
}

// ── Utilization intensity tier ──
export type UtilizationTier = 'low' | 'moderate' | 'high';

export function getUtilizationTier(avgVpm: number): UtilizationTier {
  if (avgVpm > 18) return 'high';
  if (avgVpm >= 10) return 'moderate';
  return 'low';
}

export const UTILIZATION_COLORS: Record<UtilizationTier, { fill: string; border: string; label: string }> = {
  low:      { fill: 'hsla(270, 30%, 75%, 0.20)', border: 'hsla(270, 30%, 60%, 0.40)', label: 'Low (<10 visits/member)' },
  moderate: { fill: 'hsla(270, 45%, 55%, 0.30)', border: 'hsla(270, 45%, 45%, 0.50)', label: 'Moderate (10–18 visits/member)' },
  high:     { fill: 'hsla(270, 60%, 40%, 0.40)', border: 'hsla(270, 60%, 35%, 0.60)', label: 'High (>18 visits/member)' },
};

export const OPERATIONAL_READ_COLORS: Record<string, string> = {
  'Stable': 'text-emerald-700',
  'Strained': 'text-amber-700',
  'Under-engaged': 'text-orange-700',
  'Low-access': 'text-red-700',
};

// ── Top 20 providers: utilization lookup ──
const normalizeProviderName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const utilizationByName = new Map<string, number>();
for (const p of providerUtilizationData) {
  utilizationByName.set(normalizeProviderName(p.name), p.totalVisits);
}

/**
 * Return the totalVisits for a facility name from the utilization dataset.
 * Returns 0 if no match is found.
 */
export function getProviderUtilizationScore(name: string): number {
  return utilizationByName.get(normalizeProviderName(name)) ?? 0;
}

// Keep legacy export for any other consumers
export const TOP_20_PROVIDERS = new Set(
  providerUtilizationData.slice(0, 20).map(p => normalizeProviderName(p.name))
);

export function isTopProvider(name: string): boolean {
  const normalized = normalizeProviderName(name);
  if (TOP_20_PROVIDERS.has(normalized)) return true;
  for (const top of TOP_20_PROVIDERS) {
    if (top.includes(normalized) || normalized.includes(top)) return true;
  }
  return false;
}

// ── Engagement gap counties ──
export type EngagementGapTier = 'gap' | 'watchlist' | 'early-signal';

export interface EngagementGapResult {
  county: string;
  tier: EngagementGapTier;
  /** For Washoe sub-county: only Northern Washoe qualifies */
  subZone?: 'northern-washoe';
}

/** Northern Washoe utilization computed from facilities north of the latitude split */
function getNorthernWashoeUtilization(): { avgVpm: number; hasEngagement: boolean } {
  const northFacs = defaultFacilities.filter(f => isNorthernWashoe(f));
  let totalMembers = 0;
  let totalVisits = 0;
  northFacs.forEach(f => {
    const util = getFacilityUtilization(f);
    if (util) {
      totalMembers += util.totalMembers;
      totalVisits += util.totalVisits;
    }
  });
  const avgVpm = totalMembers > 0 ? totalVisits / totalMembers : 0;
  const hasEngagement = countyHasEngagementSupport('Washoe');
  return { avgVpm, hasEngagement };
}

function classifyEngagementTier(avgVpm: number, hasEngagement: boolean): EngagementGapTier | null {
  if (hasEngagement) return null;
  if (avgVpm > 15) return 'gap';
  if (avgVpm > 10) return 'watchlist';
  if (avgVpm > 6) return 'early-signal';
  return null;
}

export function getEngagementGapCounties(): string[] {
  return getEngagementGapResults().filter(r => r.tier === 'gap').map(r => r.county);
}

export function getEngagementGapResults(): EngagementGapResult[] {
  const results: EngagementGapResult[] = [];
  const allCounties = new Set(defaultFacilities.map(f => f.county));

  for (const county of allCounties) {
    if (ENGAGEMENT_GAP_EXCLUDED_COUNTIES.has(county)) continue;

    if (county === 'Washoe') {
      const { avgVpm, hasEngagement } = getNorthernWashoeUtilization();
      const tier = classifyEngagementTier(avgVpm, hasEngagement);
      if (tier) results.push({ county: 'Washoe', tier, subZone: 'northern-washoe' });
      continue;
    }

    const util = getCountyUtilization(county);
    if (util.engagementGap) {
      results.push({ county, tier: 'gap' });
    } else if (util.engagementWatchlist) {
      results.push({ county, tier: 'watchlist' });
    } else if (util.engagementEarlySignal) {
      results.push({ county, tier: 'early-signal' });
    }
  }

  return results;
}

// ── Staff coverage type ──
export function getStaffCoverageType(county: string): 'field' | 'remote' | 'none' {
  for (const fte of fteCapacityData) {
    if (fte.counties.includes(county) && fte.hubLocation !== null) return 'field';
  }
  for (const fte of fteCapacityData) {
    if (fte.counties.includes(county) && fte.hubLocation === null) return 'remote';
  }
  return 'none';
}

// ── Composite engagement priority score ──
// score = 0.40 × unengaged_norm + 0.35 × severity_norm + 0.25 × coverage_gap
const COVERAGE_GAP_SCORE: Record<ReturnType<typeof getStaffCoverageType>, number> = {
  field: 0.0,
  remote: 0.7,
  none: 1.0,
};

let _compositeCache: Map<string, number> | null = null;

function buildCompositeScores(): Map<string, number> {
  if (_compositeCache) return _compositeCache;

  const rankings = buildCountyEngagementRankings();
  const maxUnengaged = Math.max(...rankings.map(r => r.unengagedMembers), 1);

  const scores = new Map<string, number>();
  for (const r of rankings) {
    if (r.totalMembers <= 0) { scores.set(r.county, 0); continue; }
    const unengagedNorm = r.unengagedMembers / maxUnengaged;
    const severityNorm = 1 - r.engagementRate;
    const coverageGap = COVERAGE_GAP_SCORE[getStaffCoverageType(r.county)];
    scores.set(r.county, 0.40 * unengagedNorm + 0.35 * severityNorm + 0.25 * coverageGap);
  }
  _compositeCache = scores;
  return scores;
}

/** Returns a 0–1 composite priority score for a county */
export function getCompositeEngagementPriority(county: string): number {
  return buildCompositeScores().get(county) ?? 0;
}

// ── Pin size scaling ──
export function getScaledPinSize(baseSize: number, totalVisits: number): number {
  // Scale from base to max 2x base, capped
  const maxVisits = 10000;
  const scale = 1 + Math.min(totalVisits / maxVisits, 1) * 0.8;
  return Math.round(baseSize * scale);
}
