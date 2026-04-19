/**
 * Provider Metadata Enrichment — CSV parser + deterministic matcher.
 *
 * Hard rules:
 *   - Never creates new providers / pins.
 *   - Never auto-applies ambiguous matches.
 *   - No fuzzy matching.
 *   - Match priority (first hit wins):
 *       1. Exact NPI match (when NPI present in row AND in any candidate)
 *       2. Exact normalized name + county
 *       3. Exact normalized name + city
 *       4. Exact normalized name only, when exactly one candidate exists
 */

import type { Facility } from '@/data/facilities';
import { parseCSVLine } from '@/utils/csvImport';
import type { ProviderEnrichmentRecord } from '@/utils/providerEnrichmentStore';

// ── Schema ─────────────────────────────────────────────────
export const ENRICHMENT_OPTIONAL_FIELDS = [
  'phone',
  'website',
  'npi',
  'subtype',
  'source',
  'medicaid_participation',
  'psychiatric_flag',
  'inpatient_flag',
  'state',
  'zip',
  'notes',
] as const;

export type EnrichmentOptionalField = typeof ENRICHMENT_OPTIONAL_FIELDS[number];

const HEADER_ALIASES: Record<string, string> = {
  provider_name: 'name',
  provider_npi: 'npi',
  provider_phone: 'phone',
  url: 'website',
  medicaid: 'medicaid_participation',
  psychiatric: 'psychiatric_flag',
  inpatient: 'inpatient_flag',
};

const normalizeHeader = (h: string): string => {
  const cleaned = String(h).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return HEADER_ALIASES[cleaned] ?? cleaned;
};

const stripLineQuotes = (line: string): string => {
  const t = line.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
};

// ── Normalization (matching only) ──────────────────────────
const normalizeForMatch = (s: string | undefined | null): string =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,'"`’]/g, '')
    .replace(/\s+/g, ' ');

const normalizeNpi = (s: string | undefined | null): string =>
  String(s ?? '').replace(/\D/g, '');

// ── Parsed row ─────────────────────────────────────────────
export interface EnrichmentParsedRow {
  rowIndex: number; // 1-based source row (excluding header)
  source_name: string;
  source_county?: string;
  source_city?: string;
  source_npi?: string;
  enrichment: Partial<Record<EnrichmentOptionalField, string>>;
}

export interface EnrichmentParseResult {
  rows: EnrichmentParsedRow[];
  invalid: { rowIndex: number; reason: string }[];
  totalRows: number;
  headerErrors: string[];
}

export const parseEnrichmentCsv = (text: string): EnrichmentParseResult => {
  let cleaned = text;
  if (cleaned.startsWith('\uFEFF')) cleaned = cleaned.substring(1);
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], invalid: [], totalRows: 0, headerErrors: ['CSV has no data rows.'] };
  }
  const headers = parseCSVLine(stripLineQuotes(lines[0])).map(normalizeHeader);

  const idx = (key: string) => headers.indexOf(key);
  const nameIdx = idx('name');
  const countyIdx = idx('county');
  const cityIdx = idx('city');
  const npiIdx = idx('npi');

  if (nameIdx === -1) {
    return { rows: [], invalid: [], totalRows: lines.length - 1, headerErrors: ['Missing required column: name (or alias provider_name).'] };
  }
  if (countyIdx === -1 && cityIdx === -1 && npiIdx === -1) {
    return { rows: [], invalid: [], totalRows: lines.length - 1, headerErrors: ['At least one of county, city, or npi is required.'] };
  }

  const optionalIdx: Partial<Record<EnrichmentOptionalField, number>> = {};
  for (const f of ENRICHMENT_OPTIONAL_FIELDS) {
    const i = idx(f);
    if (i !== -1) optionalIdx[f] = i;
  }

  const rows: EnrichmentParsedRow[] = [];
  const invalid: { rowIndex: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(stripLineQuotes(lines[i]));
    const name = (cols[nameIdx] ?? '').trim();
    if (!name) {
      invalid.push({ rowIndex: i, reason: 'missing name' });
      continue;
    }
    const county = countyIdx !== -1 ? (cols[countyIdx] ?? '').trim() : '';
    const city = cityIdx !== -1 ? (cols[cityIdx] ?? '').trim() : '';
    const npi = npiIdx !== -1 ? (cols[npiIdx] ?? '').trim() : '';
    if (!county && !city && !npi) {
      invalid.push({ rowIndex: i, reason: 'must include county, city, or npi for matching' });
      continue;
    }

    const enrichment: Partial<Record<EnrichmentOptionalField, string>> = {};
    for (const f of ENRICHMENT_OPTIONAL_FIELDS) {
      const ci = optionalIdx[f];
      if (ci !== undefined) {
        const v = (cols[ci] ?? '').trim();
        if (v) enrichment[f] = v;
      }
    }

    rows.push({
      rowIndex: i,
      source_name: name,
      source_county: county || undefined,
      source_city: city || undefined,
      source_npi: npi || undefined,
      enrichment,
    });
  }

  return { rows, invalid, totalRows: lines.length - 1, headerErrors: [] };
};

// ── Matching ───────────────────────────────────────────────
export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface EnrichmentMatchResult {
  row: EnrichmentParsedRow;
  status: MatchStatus;
  matched?: Facility;
  candidates?: Facility[]; // when ambiguous
  matchedBy?: 'npi' | 'name+county' | 'name+city' | 'unique-name';
}

interface ProviderIndex {
  byNpiNorm: Map<string, Facility[]>;
  byNameNorm: Map<string, Facility[]>;
}

const buildProviderIndex = (providers: Facility[]): ProviderIndex => {
  const byNpiNorm = new Map<string, Facility[]>();
  const byNameNorm = new Map<string, Facility[]>();
  for (const p of providers) {
    const npiCandidate = (p as Facility & { npi?: string }).npi;
    const npiNorm = normalizeNpi(npiCandidate);
    if (npiNorm.length >= 10) {
      const list = byNpiNorm.get(npiNorm) ?? [];
      list.push(p);
      byNpiNorm.set(npiNorm, list);
    }
    const nameNorm = normalizeForMatch(p.name);
    if (nameNorm) {
      const list = byNameNorm.get(nameNorm) ?? [];
      list.push(p);
      byNameNorm.set(nameNorm, list);
    }
  }
  return { byNpiNorm, byNameNorm };
};

export const matchEnrichmentRow = (
  row: EnrichmentParsedRow,
  index: ProviderIndex,
): EnrichmentMatchResult => {
  // 1. NPI exact
  const npiNorm = normalizeNpi(row.source_npi);
  if (npiNorm.length >= 10) {
    const hits = index.byNpiNorm.get(npiNorm) ?? [];
    if (hits.length === 1) return { row, status: 'matched', matched: hits[0], matchedBy: 'npi' };
    if (hits.length > 1) return { row, status: 'ambiguous', candidates: hits, matchedBy: 'npi' };
  }

  const nameNorm = normalizeForMatch(row.source_name);
  if (!nameNorm) return { row, status: 'unmatched' };
  const nameHits = index.byNameNorm.get(nameNorm) ?? [];

  if (nameHits.length === 0) return { row, status: 'unmatched' };

  // 2. name + county
  if (row.source_county) {
    const countyNorm = normalizeForMatch(row.source_county);
    const filtered = nameHits.filter((p) => normalizeForMatch(p.county) === countyNorm);
    if (filtered.length === 1) return { row, status: 'matched', matched: filtered[0], matchedBy: 'name+county' };
    if (filtered.length > 1) return { row, status: 'ambiguous', candidates: filtered, matchedBy: 'name+county' };
  }

  // 3. name + city
  if (row.source_city) {
    const cityNorm = normalizeForMatch(row.source_city);
    const filtered = nameHits.filter((p) => normalizeForMatch(p.city) === cityNorm);
    if (filtered.length === 1) return { row, status: 'matched', matched: filtered[0], matchedBy: 'name+city' };
    if (filtered.length > 1) return { row, status: 'ambiguous', candidates: filtered, matchedBy: 'name+city' };
  }

  // 4. unique name
  if (nameHits.length === 1) return { row, status: 'matched', matched: nameHits[0], matchedBy: 'unique-name' };
  return { row, status: 'ambiguous', candidates: nameHits };
};

export const matchEnrichmentRows = (
  rows: EnrichmentParsedRow[],
  providers: Facility[],
): EnrichmentMatchResult[] => {
  const index = buildProviderIndex(providers);
  return rows.map((r) => matchEnrichmentRow(r, index));
};

// ── Build records ──────────────────────────────────────────
export const buildEnrichmentRecord = (
  match: EnrichmentMatchResult,
  meta: { sourceFileName: string; importedBy?: string },
): ProviderEnrichmentRecord | null => {
  if (match.status !== 'matched' || !match.matched) return null;
  const e = match.row.enrichment;
  return {
    provider_id: match.matched.id,
    matched_provider_name: match.matched.name,
    imported_npi: e.npi,
    imported_phone: e.phone,
    imported_website: e.website,
    imported_subtype: e.subtype,
    imported_source: e.source,
    imported_medicaid_participation: e.medicaid_participation,
    imported_psychiatric_flag: e.psychiatric_flag,
    imported_inpatient_flag: e.inpatient_flag,
    imported_state: e.state,
    imported_zip: e.zip,
    imported_notes: e.notes,
    enrichment_source_file_name: meta.sourceFileName,
    enrichment_imported_at: new Date().toISOString(),
    enrichment_imported_by: meta.importedBy,
    enrichment_status: 'imported_unverified',
  };
};
