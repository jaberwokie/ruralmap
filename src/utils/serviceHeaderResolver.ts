/**
 * Header Resolution + Import Gate (Structured Import).
 *
 * Pre-stage gate that maps source headers (csv/xlsx) to canonical schema
 * fields. No row data is consumed here — only column headers.
 *
 * Behavior:
 *  - Identity-critical canonicals (`name`, `address`, `phone`) hard-abort
 *    on duplicate mapping.
 *  - Safe canonicals (`services_offered`, `access_notes`, `service_tags`)
 *    allow append-only secondary sources.
 *  - All other duplicate mappings hard-abort (geometry/identity risk).
 *  - Required-coverage gate enforces minimum operational data.
 */

import { normalizeHeader } from './serviceNormalize';

/** Canonical schema fields the resolver knows about. */
export type CanonicalField =
  | 'name' | 'category' | 'subcategory' | 'services_offered'
  | 'address' | 'city' | 'state' | 'zip' | 'county'
  | 'phone' | 'email' | 'website' | 'latitude' | 'longitude'
  | 'access_notes' | 'resource_class' | 'service_tags' | 'mappable';

/** Source header → canonical field. First entry is the canonical name itself. */
export const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  name:             ['name', 'provider_name', 'organization_name'],
  category:         ['category', 'service_category'],
  subcategory:      ['subcategory', 'service_subcategory', 'service_type'],
  services_offered: ['services_offered', 'description', 'service_description'],
  address:          ['address', 'address_1', 'street_address'],
  city:             ['city'],
  state:            ['state'],
  zip:              ['zip', 'zipcode', 'postal_code'],
  county:           ['county', 'county_inferred'],
  phone:            ['phone', 'phone_number'],
  email:            ['email'],
  website:          ['website', 'url'],
  latitude:         ['latitude', 'lat'],
  longitude:        ['longitude', 'lng', 'lon'],
  access_notes:     ['access_notes', 'notes', 'review_notes'],
  resource_class:   ['resource_class'],
  service_tags:     ['service_tags'],
  mappable:         ['mappable'],
};

/** Canonicals that hard-abort if two source headers map to them. */
const IDENTITY_CRITICAL: ReadonlySet<CanonicalField> =
  new Set<CanonicalField>(['name', 'address', 'phone']);

/** Canonicals that allow safe append-only duplicates. */
const SAFE_DUPLICATE: ReadonlySet<CanonicalField> =
  new Set<CanonicalField>(['services_offered', 'access_notes', 'service_tags']);

export interface DuplicateFieldMapping {
  canonical: CanonicalField;
  primary: string;
  secondaries: string[];
}

export interface BlockingConflict {
  canonical: CanonicalField;
  sources: string[];
}

export interface HeaderResolutionResult {
  status: 'allowed' | 'blocked';
  /** sourceHeader → canonical (for primary mappings only). */
  resolvedMap: Record<string, CanonicalField>;
  /** Per-canonical primary + secondary headers (for safe duplicates). */
  primarySources: Partial<Record<CanonicalField, string>>;
  duplicateAppendSources: Partial<Record<CanonicalField, string[]>>;
  matchedExact: Array<{ source: string; canonical: CanonicalField }>;
  matchedViaAlias: Array<{ source: string; canonical: CanonicalField }>;
  unmapped: string[];
  missingRequired: string[];
  blocking_conflicts: BlockingConflict[];
  non_blocking_duplicates: DuplicateFieldMapping[];
}

/** Build a lookup: normalizedHeader → canonical. */
const buildAliasIndex = (): Map<string, CanonicalField> => {
  const idx = new Map<string, CanonicalField>();
  (Object.keys(HEADER_ALIASES) as CanonicalField[]).forEach((canonical) => {
    HEADER_ALIASES[canonical].forEach((alias) => {
      idx.set(normalizeHeader(alias), canonical);
    });
  });
  return idx;
};

const ALIAS_INDEX = buildAliasIndex();

/**
 * Required-coverage gate per the v4 plan:
 *  - `name`
 *  - at least one of: category, subcategory, service_tags, services_offered
 *  - at least one of: county, city, address, phone, website
 */
const evaluateCoverage = (covered: Set<CanonicalField>): string[] => {
  const missing: string[] = [];
  if (!covered.has('name')) missing.push('name');

  const categoryGroup: CanonicalField[] = ['category', 'subcategory', 'service_tags', 'services_offered'];
  if (!categoryGroup.some((c) => covered.has(c))) {
    missing.push('one of: category, subcategory, service_tags, services_offered');
  }

  const locationGroup: CanonicalField[] = ['county', 'city', 'address', 'phone', 'website'];
  if (!locationGroup.some((c) => covered.has(c))) {
    missing.push('one of: county, city, address, phone, website');
  }

  return missing;
};

export const resolveHeaders = (rawHeaders: string[]): HeaderResolutionResult => {
  const trimmedHeaders = rawHeaders.map((h) => h.trim()).filter((h) => h.length > 0);

  // Group source headers by canonical (preserves first-encountered order).
  const groups = new Map<CanonicalField, string[]>();
  const matchedExact: HeaderResolutionResult['matchedExact'] = [];
  const matchedViaAlias: HeaderResolutionResult['matchedViaAlias'] = [];
  const unmapped: string[] = [];

  for (const src of trimmedHeaders) {
    const norm = normalizeHeader(src);
    const canonical = ALIAS_INDEX.get(norm);
    if (!canonical) {
      unmapped.push(src);
      continue;
    }
    const list = groups.get(canonical) ?? [];
    list.push(src);
    groups.set(canonical, list);

    // Classify as exact vs alias (exact = src normalizes to the canonical itself)
    if (norm === canonical) {
      matchedExact.push({ source: src, canonical });
    } else {
      matchedViaAlias.push({ source: src, canonical });
    }
  }

  // Split groups into primary, blocking conflicts, non-blocking duplicates
  const resolvedMap: Record<string, CanonicalField> = {};
  const primarySources: Partial<Record<CanonicalField, string>> = {};
  const duplicateAppendSources: Partial<Record<CanonicalField, string[]>> = {};
  const blocking_conflicts: BlockingConflict[] = [];
  const non_blocking_duplicates: DuplicateFieldMapping[] = [];

  for (const [canonical, sources] of groups) {
    if (sources.length === 1) {
      const [only] = sources;
      resolvedMap[only] = canonical;
      primarySources[canonical] = only;
      continue;
    }

    // Multiple sources resolved here.
    if (IDENTITY_CRITICAL.has(canonical)) {
      blocking_conflicts.push({ canonical, sources: [...sources] });
      // Still record the primary in resolvedMap so unmapped list isn't misleading,
      // but do NOT write secondaries (import is going to abort anyway).
      const [primary] = sources;
      resolvedMap[primary] = canonical;
      primarySources[canonical] = primary;
      continue;
    }

    if (SAFE_DUPLICATE.has(canonical)) {
      const [primary, ...secondaries] = sources;
      resolvedMap[primary] = canonical;
      primarySources[canonical] = primary;
      duplicateAppendSources[canonical] = secondaries;
      // Also map secondaries so callers can iterate raw row by source header
      secondaries.forEach((sec) => { resolvedMap[sec] = canonical; });
      non_blocking_duplicates.push({ canonical, primary, secondaries });
      continue;
    }

    // All other canonicals: identity/geometry risk → hard abort.
    blocking_conflicts.push({ canonical, sources: [...sources] });
    const [primary] = sources;
    resolvedMap[primary] = canonical;
    primarySources[canonical] = primary;
  }

  const missingRequired = evaluateCoverage(new Set(groups.keys()));
  const status: HeaderResolutionResult['status'] =
    blocking_conflicts.length > 0 || missingRequired.length > 0 ? 'blocked' : 'allowed';

  return {
    status,
    resolvedMap,
    primarySources,
    duplicateAppendSources,
    matchedExact,
    matchedViaAlias,
    unmapped,
    missingRequired,
    blocking_conflicts,
    non_blocking_duplicates,
  };
};
