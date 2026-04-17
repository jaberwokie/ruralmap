/**
 * Unmapped Top Utilized Providers — admin-only review analyzer.
 *
 * Read-only diff: compares billing-provider names from the utilization dataset
 * against names already present in the mapped facility + rural-services
 * datasets, and returns providers that have NO confident match.
 *
 * NON-NEGOTIABLES (do not relax):
 *   - No pins are created here. No coordinates are invented.
 *   - No scoring / queue / verification logic is touched.
 *   - Output is advisory only and intended for an admin review surface.
 */

import { defaultFacilities } from '@/data/facilities';
import { ruralServices } from '@/data/rural-services';
import type { ProviderUtilizationRecord } from '@/types/utilization';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

export interface UnmappedProviderRow {
  providerName: string;
  providerKey: string;
  providerGrandTotal: number;
  totalDistinctMembers: number;
  countyCount: number;
  counties: string[];
  topCounty: string | null;
  topCountyMembers: number;
  /** Best candidate from mapped data (if any partial signal exists). */
  candidateMatch: string | null;
  matchConfidence: MatchConfidence;
  /** Heuristic exclusion category when the entity is clearly non-site
   *  (e.g. statewide labs, transport billers). Listed for transparency,
   *  not used to suppress display. */
  excludedReason: string | null;
}

/** Lightweight, conservative non-site / billing-only patterns.
 *  Anything matching these is unlikely to have a single mappable rural site
 *  and would risk producing a misleading pin if auto-geocoded. We surface
 *  them in the report but flag them so reviewers can ignore quickly. */
const NON_SITE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bLABORATORY CORPORATION\b|\bQUEST DIAGNOSTICS\b|\bSIERRA PATHOLOGY\b|\bLABORATORY MEDICINE\b/i, reason: 'Lab / pathology biller' },
  { pattern: /\bRADIOLOGY\b|\bRADIOLOGICAL\b|\bIMAGING\b/i, reason: 'Radiology / imaging biller' },
  { pattern: /\bMEDICAL TRANSPORTATION\b|\bAMBULANCE\b|\bAEMS\b/i, reason: 'Transport / EMS biller' },
  { pattern: /\bSCHOOL DISTRICT\b/i, reason: 'School district biller' },
  { pattern: /\bHOMETOWN HEALTH\b|\bMANAGEMENT COMPANY\b/i, reason: 'Plan / management entity' },
  { pattern: /\bDHHS IHS\b|\bPHOENIX AREA\b/i, reason: 'Federal area office' },
  { pattern: /\bOPTICAL\b|\bEYECARE\b/i, reason: 'Optical biller (often multi-site)' },
];

const AGGREGATE_LABELS = new Set(['GRAND TOTAL', 'TOTAL', 'ALL PROVIDERS']);

const STOP_TOKENS = new Set([
  'LLC', 'LLP', 'LTD', 'INC', 'PC', 'CHTD', 'PA', 'FQHC',
  'CORPORATION', 'CORP', 'CO', 'COMPANY', 'NEVADA', 'NONPROFIT',
  'A', 'OF', 'AND', 'THE', 'PROFESSIONAL',
]);

const normalize = (s: string): string => {
  return s
    .toUpperCase()
    .replace(/[,.\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (s: string): Set<string> => {
  const out = new Set<string>();
  for (const t of normalize(s).split(' ')) {
    if (t.length >= 3 && !STOP_TOKENS.has(t)) out.add(t);
  }
  return out;
};

interface MappedEntry {
  rawName: string;
  norm: string;
  tokens: Set<string>;
}

const buildMappedIndex = (): MappedEntry[] => {
  const out: MappedEntry[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const n = normalize(name);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ rawName: name, norm: n, tokens: tokenize(name) });
  };
  for (const f of defaultFacilities) add(f.name);
  for (const s of ruralServices) add(s.name);
  return out;
};

const matchAgainstMapped = (
  providerName: string,
  index: MappedEntry[],
): { candidate: string | null; confidence: MatchConfidence } => {
  const n = normalize(providerName);
  if (!n) return { candidate: null, confidence: 'none' };

  // 1. Exact normalized name match → high
  for (const m of index) {
    if (m.norm === n) return { candidate: m.rawName, confidence: 'high' };
  }

  // 2. Strong substring containment (≥14 chars overlap of one inside the other)
  for (const m of index) {
    if (m.norm.length >= 14 && n.includes(m.norm)) {
      return { candidate: m.rawName, confidence: 'high' };
    }
    if (n.length >= 14 && m.norm.includes(n)) {
      return { candidate: m.rawName, confidence: 'high' };
    }
  }

  // 3. Token-overlap candidate → medium (best Jaccard) only if ≥2 shared meaningful tokens
  const provTokens = tokenize(providerName);
  let best: { name: string; jaccard: number; shared: number } | null = null;
  for (const m of index) {
    if (m.tokens.size === 0) continue;
    let shared = 0;
    for (const t of provTokens) if (m.tokens.has(t)) shared++;
    if (shared < 2) continue;
    const union = new Set<string>([...provTokens, ...m.tokens]).size || 1;
    const jaccard = shared / union;
    if (!best || jaccard > best.jaccard) {
      best = { name: m.rawName, jaccard, shared };
    }
  }
  if (best && best.jaccard >= 0.45) {
    return { candidate: best.name, confidence: 'medium' };
  }
  if (best) {
    return { candidate: best.name, confidence: 'low' };
  }
  return { candidate: null, confidence: 'none' };
};

const detectNonSite = (name: string): string | null => {
  for (const { pattern, reason } of NON_SITE_PATTERNS) {
    if (pattern.test(name)) return reason;
  }
  return null;
};

export interface AnalyzeOptions {
  /** Only consider providers with provider_grand_total >= this value. Default 20. */
  minGrandTotal?: number;
  /** Cap the result list. Default 200 (more than enough for the long tail). */
  limit?: number;
}

export interface UnmappedAnalysisResult {
  rows: UnmappedProviderRow[];
  totals: {
    providersChecked: number;
    alreadyMapped: number;
    unmapped: number;
    nonSiteCandidates: number;
  };
}

export const analyzeUnmappedProviders = (
  providerUtil: ProviderUtilizationRecord[],
  opts: AnalyzeOptions = {},
): UnmappedAnalysisResult => {
  const minGrandTotal = opts.minGrandTotal ?? 20;
  const limit = opts.limit ?? 200;

  // Aggregate utilization rows by provider name.
  type Agg = {
    providerName: string;
    providerKey: string;
    providerGrandTotal: number;
    totalDistinctMembers: number;
    perCounty: Map<string, number>;
  };
  const byProvider = new Map<string, Agg>();
  for (const r of providerUtil) {
    if (!r.providerName) continue;
    const upper = r.providerName.toUpperCase().trim();
    if (AGGREGATE_LABELS.has(upper)) continue;
    const existing = byProvider.get(r.providerKey) ?? {
      providerName: r.providerName,
      providerKey: r.providerKey,
      providerGrandTotal: 0,
      totalDistinctMembers: 0,
      perCounty: new Map<string, number>(),
    };
    // Provider Grand Total is a provider-wide value repeated on each county
    // row → take the max, never the sum.
    if (r.providerGrandTotal > existing.providerGrandTotal) {
      existing.providerGrandTotal = r.providerGrandTotal;
    }
    existing.totalDistinctMembers += r.distinctMembers;
    if (r.county) {
      existing.perCounty.set(
        r.county,
        (existing.perCounty.get(r.county) ?? 0) + r.distinctMembers,
      );
    }
    byProvider.set(r.providerKey, existing);
  }

  const all = Array.from(byProvider.values())
    .filter((p) => p.providerGrandTotal >= minGrandTotal)
    .sort((a, b) => b.providerGrandTotal - a.providerGrandTotal);

  const index = buildMappedIndex();

  let alreadyMapped = 0;
  let nonSiteCandidates = 0;
  const unmappedRows: UnmappedProviderRow[] = [];

  for (const p of all) {
    const { candidate, confidence } = matchAgainstMapped(p.providerName, index);
    if (confidence === 'high') {
      alreadyMapped++;
      continue;
    }
    const nonSite = detectNonSite(p.providerName);
    if (nonSite) nonSiteCandidates++;

    const counties = Array.from(p.perCounty.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
    const topEntry = Array.from(p.perCounty.entries()).sort((a, b) => b[1] - a[1])[0];

    unmappedRows.push({
      providerName: p.providerName,
      providerKey: p.providerKey,
      providerGrandTotal: p.providerGrandTotal,
      totalDistinctMembers: p.totalDistinctMembers,
      countyCount: p.perCounty.size,
      counties,
      topCounty: topEntry?.[0] ?? null,
      topCountyMembers: topEntry?.[1] ?? 0,
      candidateMatch: candidate,
      matchConfidence: confidence,
      excludedReason: nonSite,
    });
  }

  return {
    rows: unmappedRows.slice(0, limit),
    totals: {
      providersChecked: all.length,
      alreadyMapped,
      unmapped: unmappedRows.length,
      nonSiteCandidates,
    },
  };
};
