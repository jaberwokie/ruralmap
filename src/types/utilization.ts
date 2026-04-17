/**
 * Utilization & demand data types — STRICTLY ADDITIVE.
 *
 * These types power the Demand & Utilization sidebar section and its
 * appended detail-panel sections. They MUST NOT be referenced by:
 *   - filtering logic
 *   - map visibility/scoring
 *   - verification queue
 *   - provider ranking
 * (Display-only contract.)
 */

export interface ZipDemandRecord {
  region: string;
  /** Normalized county name */
  county: string;
  /** 5-digit ZIP code (string-preserved) */
  zip: string;
  memberCount: number;
}

export interface CountyGapSummary {
  /** Normalized county name */
  county: string;
  claimsUniqueMembers: number;
  totalClaims: number;
  totalClaimLines: number;
  uniqueClaimProviders: number;
  firstServiceDate: string | null;
  lastServiceDate: string | null;
  claimsPerMember: number;
  claimLinesPerMember: number;
  zipMemberCount: number;
  providerMemberSum: number;
  topProviderName: string;
  topProviderMembers: number;
  top2Members: number;
  memberCountGap: number;
  claimsPerZipMember: number;
  providersPer100ZipMembers: number;
  /** 0..1 share */
  topProviderSharePct: number;
  /** 0..1 share */
  top2ProviderSharePct: number;
}

export interface ProviderUtilizationRecord {
  /** Original provider name as supplied */
  providerName: string;
  /** Normalized provider key for exact-match joins */
  providerKey: string;
  /** Normalized county name */
  county: string;
  distinctMembers: number;
  providerGrandTotal: number;
}

export interface TribalUtilizationSummary {
  /** Normalized county name */
  county: string;
  tribalProviderFlag: boolean;
  uniqueMembers: number;
  totalClaims: number;
  totalClaimLines: number;
  uniqueProviders: number;
}

export interface ZipProviderRollupRecord {
  zip: string;
  /** Normalized county name */
  county: string;
  /** Original provider name as supplied (display) */
  providerName: string;
  /** Normalized provider key (matches ProviderUtilizationRecord.providerKey) */
  providerKey: string;
  totalClaims: number;
  totalClaimLines: number;
  distinctMembers: number;
}

export interface UtilizationAnalytics {
  /** ZIP -> 0..1 normalized member_count */
  demandPressure: Map<string, number>;
  /** county -> 0..1 normalized top_provider_share_pct */
  providerDependencyRisk: Map<string, number>;
  /** county -> 0..1 normalized member_count_gap */
  engagementGapRisk: Map<string, number>;
}

export interface UtilizationIndices {
  zipDemandByZip: Map<string, ZipDemandRecord>;
  zipDemandByCounty: Map<string, ZipDemandRecord[]>;
  countyGapByCounty: Map<string, CountyGapSummary>;
  providerUtilByKey: Map<string, ProviderUtilizationRecord[]>;
  tribalByCounty: Map<string, TribalUtilizationSummary>;
  /** ZIP -> rollup rows (pre-sorted by totalClaims desc) */
  zipRollupByZip: Map<string, ZipProviderRollupRecord[]>;
  /** County names that have any tribal-flag=true rollup entry; used for "tribal-provider activity" yes/no */
  zipsWithTribalActivity: Set<string>;
}
