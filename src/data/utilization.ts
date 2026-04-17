/**
 * Lazy loader + index builder for the Demand & Utilization datasets.
 * Files live under /public/data/utilization/ and are fetched on demand only.
 *
 * Display-only contract: nothing here may be imported by filtering, scoring,
 * verification, ranking, or visibility modules.
 */

import {
  CountyGapSummary,
  ProviderUtilizationRecord,
  TribalUtilizationSummary,
  UtilizationAnalytics,
  UtilizationIndices,
  ZipDemandRecord,
  ZipProviderRollupRecord,
} from '@/types/utilization';
import {
  minMaxNormalize,
  normalizeCounty,
  normalizeProviderName,
  normalizeZip,
} from '@/utils/utilizationNormalize';

const BASE = '/data/utilization';

const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const parseZipDemand = (rows: unknown[]): ZipDemandRecord[] =>
  rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const zip = normalizeZip(o['Member Zip']);
      const county = normalizeCounty(o['Member County']);
      if (!zip || !county) return null;
      return {
        region: str(o['Region']),
        county,
        zip,
        memberCount: num(o['Member Count']),
      } satisfies ZipDemandRecord;
    })
    .filter((r): r is ZipDemandRecord => r !== null);

const parseCountyGap = (rows: unknown[]): CountyGapSummary[] =>
  rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const county = normalizeCounty(o['Member County']);
      if (!county) return null;
      return {
        county,
        claimsUniqueMembers: num(o['claims_unique_members']),
        totalClaims: num(o['total_claims']),
        totalClaimLines: num(o['total_claim_lines']),
        uniqueClaimProviders: num(o['unique_claim_providers']),
        firstServiceDate: str(o['first_service_date']) || null,
        lastServiceDate: str(o['last_service_date']) || null,
        claimsPerMember: num(o['claims_per_member']),
        claimLinesPerMember: num(o['claim_lines_per_member']),
        zipMemberCount: num(o['zip_member_count']),
        providerMemberSum: num(o['provider_member_sum']),
        topProviderName: str(o['top_provider_1']),
        topProviderMembers: num(o['top_provider_1_members']),
        top2Members: num(o['top_2_members']),
        memberCountGap: num(o['member_count_gap']),
        claimsPerZipMember: num(o['claims_per_zip_member']),
        providersPer100ZipMembers: num(o['providers_per_100_zip_members']),
        topProviderSharePct: num(o['top_provider_share_pct']),
        top2ProviderSharePct: num(o['top_2_provider_share_pct']),
      } satisfies CountyGapSummary;
    })
    .filter((r): r is CountyGapSummary => r !== null);

const parseProviderUtil = (rows: unknown[]): ProviderUtilizationRecord[] =>
  rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const providerName = str(o['Billing Provider Name']);
      const providerKey = normalizeProviderName(providerName);
      const county = normalizeCounty(o['Member County']);
      if (!providerKey || !county) return null;
      return {
        providerName,
        providerKey,
        county,
        distinctMembers: num(o['Distinct Members']),
        providerGrandTotal: num(o['Provider Grand Total']),
      } satisfies ProviderUtilizationRecord;
    })
    .filter((r): r is ProviderUtilizationRecord => r !== null);

const parseTribal = (rows: unknown[]): TribalUtilizationSummary[] =>
  rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const county = normalizeCounty(o['Member County']);
      if (!county) return null;
      return {
        county,
        tribalProviderFlag: o['Tribal Provider Flag'] === true || o['Tribal Provider Flag'] === 'true',
        uniqueMembers: num(o['unique_members']),
        totalClaims: num(o['total_claims']),
        totalClaimLines: num(o['total_claim_lines']),
        uniqueProviders: num(o['unique_providers']),
      } satisfies TribalUtilizationSummary;
    })
    .filter((r): r is TribalUtilizationSummary => r !== null);

const parseZipRollup = (rows: unknown[]): ZipProviderRollupRecord[] => {
  const out = rows
    .map((r) => {
      const o = r as Record<string, unknown>;
      const zip = normalizeZip(o['Member Zip']);
      const providerName = str(o['Billing Provider Name']);
      const providerKey = normalizeProviderName(providerName);
      if (!zip || !providerKey) return null;
      return {
        zip,
        county: normalizeCounty(o['Member County']),
        providerName,
        providerKey,
        totalClaims: num(o['total_claims']),
        totalClaimLines: num(o['total_claim_lines']),
        distinctMembers: num(o['distinct_members']),
      } satisfies ZipProviderRollupRecord;
    })
    .filter((r): r is ZipProviderRollupRecord => r !== null);
  if (rows.length > 0 && out.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Utilization] zip_provider_rollup.json appears malformed — required columns missing. ' +
        'Top Providers sub-block will be hidden. Other Demand & Utilization features remain functional.',
    );
  }
  return out;
};

export interface UtilizationDataset {
  zipDemand: ZipDemandRecord[];
  countyGap: CountyGapSummary[];
  providerUtil: ProviderUtilizationRecord[];
  tribal: TribalUtilizationSummary[];
  zipRollup: ZipProviderRollupRecord[];
  indices: UtilizationIndices;
  analytics: UtilizationAnalytics;
}

const buildIndices = (
  zipDemand: ZipDemandRecord[],
  countyGap: CountyGapSummary[],
  providerUtil: ProviderUtilizationRecord[],
  tribal: TribalUtilizationSummary[],
  zipRollup: ZipProviderRollupRecord[],
): UtilizationIndices => {
  const zipDemandByZip = new Map<string, ZipDemandRecord>();
  const zipDemandByCounty = new Map<string, ZipDemandRecord[]>();
  for (const r of zipDemand) {
    zipDemandByZip.set(r.zip, r);
    const arr = zipDemandByCounty.get(r.county) ?? [];
    arr.push(r);
    zipDemandByCounty.set(r.county, arr);
  }
  for (const arr of zipDemandByCounty.values()) {
    arr.sort((a, b) => b.memberCount - a.memberCount);
  }

  const countyGapByCounty = new Map<string, CountyGapSummary>();
  for (const r of countyGap) countyGapByCounty.set(r.county, r);

  const providerUtilByKey = new Map<string, ProviderUtilizationRecord[]>();
  for (const r of providerUtil) {
    const arr = providerUtilByKey.get(r.providerKey) ?? [];
    arr.push(r);
    providerUtilByKey.set(r.providerKey, arr);
  }
  for (const arr of providerUtilByKey.values()) {
    arr.sort((a, b) => b.providerGrandTotal - a.providerGrandTotal);
  }

  // Tribal index: prefer the row where the flag is true; fall back to false-row only if no true-row exists.
  const tribalByCounty = new Map<string, TribalUtilizationSummary>();
  for (const r of tribal) {
    const existing = tribalByCounty.get(r.county);
    if (!existing || (r.tribalProviderFlag && !existing.tribalProviderFlag)) {
      tribalByCounty.set(r.county, r);
    }
  }

  const zipRollupByZip = new Map<string, ZipProviderRollupRecord[]>();
  const zipsWithTribalActivity = new Set<string>();
  // Build set of provider keys that appear in tribal-flag=true tribal rows…
  // The tribal sheet is at county granularity, so "tribal provider activity" for a ZIP
  // must be derived from the rollup by name pattern. We instead surface yes/no based on
  // whether the zip's county has any tribal-flag=true tribal claims activity (>0).
  const tribalActiveCounties = new Set<string>();
  for (const r of tribal) {
    if (r.tribalProviderFlag && r.totalClaims > 0) tribalActiveCounties.add(r.county);
  }

  for (const r of zipRollup) {
    const arr = zipRollupByZip.get(r.zip) ?? [];
    arr.push(r);
    zipRollupByZip.set(r.zip, arr);
  }
  for (const arr of zipRollupByZip.values()) {
    arr.sort((a, b) => b.totalClaims - a.totalClaims);
  }
  for (const r of zipRollup) {
    if (tribalActiveCounties.has(r.county)) zipsWithTribalActivity.add(r.zip);
  }

  return {
    zipDemandByZip,
    zipDemandByCounty,
    countyGapByCounty,
    providerUtilByKey,
    tribalByCounty,
    zipRollupByZip,
    zipsWithTribalActivity,
  };
};

const buildAnalytics = (
  zipDemand: ZipDemandRecord[],
  countyGap: CountyGapSummary[],
): UtilizationAnalytics => ({
  demandPressure: minMaxNormalize(zipDemand.map((r) => [r.zip, r.memberCount] as [string, number])),
  providerDependencyRisk: minMaxNormalize(
    countyGap.map((r) => [r.county, r.topProviderSharePct] as [string, number]),
  ),
  engagementGapRisk: minMaxNormalize(
    countyGap.map((r) => [r.county, r.memberCountGap] as [string, number]),
  ),
});

let cache: Promise<UtilizationDataset> | null = null;

export const loadUtilizationDataset = (): Promise<UtilizationDataset> => {
  if (cache) return cache;
  cache = (async () => {
    const fetchJson = async (file: string): Promise<unknown[]> => {
      const res = await fetch(`${BASE}/${file}`);
      if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    };
    const fetchJsonOptional = async (file: string): Promise<unknown[]> => {
      try {
        return await fetchJson(file);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[Utilization] optional dataset ${file} failed to load — continuing.`, err);
        return [];
      }
    };
    const [zipDemandRaw, countyGapRaw, providerUtilRaw, tribalRaw, zipRollupRaw] = await Promise.all([
      fetchJson('zip_member_demand.json'),
      fetchJson('county_gap_summary.json'),
      fetchJson('provider_util_flat.json'),
      fetchJson('tribal_provider_summary.json'),
      fetchJsonOptional('zip_provider_rollup.json'),
    ]);
    const zipDemand = parseZipDemand(zipDemandRaw);
    const countyGap = parseCountyGap(countyGapRaw);
    const providerUtil = parseProviderUtil(providerUtilRaw);
    const tribal = parseTribal(tribalRaw);
    const zipRollup = parseZipRollup(zipRollupRaw);
    return {
      zipDemand,
      countyGap,
      providerUtil,
      tribal,
      zipRollup,
      indices: buildIndices(zipDemand, countyGap, providerUtil, tribal, zipRollup),
      analytics: buildAnalytics(zipDemand, countyGap),
    };
  })().catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
};
