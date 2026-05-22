/**
 * CSV + XLSX intake utilities for Service + BH pipelines.
 *
 * For services: row mapping is driven by the resolver output
 * (`HeaderResolutionResult`) — the resolver is the single source of truth for
 * which source columns map to which canonical fields.
 *
 * BH path remains alias-driven (legacy default Services upload still works
 * because `csvToStagingService` falls back to a built-in alias map when no
 * resolver result is supplied).
 */

import * as XLSX from 'xlsx';
import type { StagingServiceRow, StagingBhRow, ValidationMessage } from '@/types/mappingPipeline';
import type { HeaderResolutionResult, CanonicalField } from './serviceHeaderResolver';
import { resolveHeaders } from './serviceHeaderResolver';
import {
  normalizeTags, normalizeCategory, controlledAppend, isNoisePhrase,
} from './serviceNormalize';
import { autoMapCategory } from './serviceCategoryMap';
import { autoMapBHCategory } from './bhCategoryMap';
import { normalizeBhAccessTags } from './bhAccessTags';
import { normalizeZip } from './zipNormalize';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

const parseCsvText = (text: string): ParsedCsv => {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1)
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
  return { headers, rows: dataRows };
};

/** Parse an .xlsx file (first sheet) into the same shape as `parseCsvText`. */
export const parseXlsxBuffer = (buffer: ArrayBuffer): ParsedCsv => {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim());
  const dataRows = aoa.slice(1)
    .filter((r) => (r as unknown[]).some((c) => String(c ?? '').trim().length > 0))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = String((r as unknown[])[idx] ?? '').trim();
      });
      return obj;
    });
  return { headers, rows: dataRows };
};

const toNum = (v: string | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toBool = (v: string | undefined): boolean | null => {
  if (v == null || v === '') return null;
  const lc = v.toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(lc)) return true;
  if (['false', 'no', 'n', '0'].includes(lc)) return false;
  return null;
};

const nullable = (v: string | undefined): string | null => {
  if (v == null) return null;
  const t = v.trim();
  if (t.length === 0 || isNoisePhrase(t)) return null;
  return t;
};

// ── service mapping (legacy default path — no resolver provided) ──────
// Used by the existing default Services CSV upload flow.
const csvToStagingServiceLegacy = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
): Partial<StagingServiceRow> => {
  const category_raw = nullable(raw.service_category ?? raw.category);
  return {
  name: raw.name ?? '',
  service_category: category_raw,
  category_raw,
  category_mapped: autoMapCategory(category_raw),
  service_subcategory: nullable(raw.service_subcategory ?? raw.subcategory),
  organization_name: nullable(raw.organization_name ?? raw.organization),
  description: nullable(raw.description),
  target_population: nullable(raw.target_population),
  eligibility_notes: nullable(raw.eligibility_notes ?? raw.eligibility),
  street_address: nullable(raw.street_address ?? raw.address),
  city: nullable(raw.city),
  state: nullable(raw.state),
  zip: nullable(raw.zip),
  county: nullable(raw.county),
  latitude: toNum(raw.latitude ?? raw.lat),
  longitude: toNum(raw.longitude ?? raw.lng ?? raw.lon),
  phone: nullable(raw.phone),
  website: nullable(raw.website),
  email: nullable(raw.email),
  referral_required: toBool(raw.referral_required),
  walk_in_allowed: toBool(raw.walk_in_allowed),
  appointment_required: toBool(raw.appointment_required),
  hours_of_operation: nullable(raw.hours_of_operation ?? raw.hours),
  languages_supported: nullable(raw.languages_supported ?? raw.languages),
  active_status: toBool(raw.active_status ?? raw.active) ?? true,
  access_notes: nullable(raw.access_notes),
  transportation_notes: nullable(raw.transportation_notes),
  medicaid_relevance: nullable(raw.medicaid_relevance ?? raw.medicaid_related),
  verification_source: nullable(raw.verification_source ?? raw.source),
  source_file_name: meta.source_file_name,
  source_row_number: meta.source_row_number,
  import_batch_id: meta.import_batch_id,
  resource_class: 'service',
  mappable: true,
  match_conflict: false,
  };
};

/**
 * Read a single canonical field from a raw row using the resolver's
 * inverse map (`primarySources`).
 */
const readField = (
  raw: Record<string, string>,
  primary: Partial<Record<CanonicalField, string>>,
  field: CanonicalField,
): string | undefined => {
  const src = primary[field];
  if (!src) return undefined;
  return raw[src];
};

/**
 * Read all source values for a canonical field — primary first, then any
 * append-only secondary sources defined in the resolver.
 */
const readFieldAll = (
  raw: Record<string, string>,
  resolver: HeaderResolutionResult,
  field: CanonicalField,
): string[] => {
  const out: string[] = [];
  const p = resolver.primarySources[field];
  if (p && raw[p] != null) out.push(raw[p]);
  const secs = resolver.duplicateAppendSources[field] ?? [];
  for (const s of secs) {
    if (raw[s] != null) out.push(raw[s]);
  }
  return out.filter((v) => v != null && String(v).trim().length > 0);
};

/**
 * Resolver-driven service row mapper (Structured Import path).
 */
const csvToStagingServiceResolved = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
  resolver: HeaderResolutionResult,
): Partial<StagingServiceRow> => {
  const primary = resolver.primarySources;

  // Identity / location / contact (single primary only)
  const name = nullable(readField(raw, primary, 'name')) ?? '';
  const street_address = nullable(readField(raw, primary, 'address'));
  const city = nullable(readField(raw, primary, 'city'));
  const state = nullable(readField(raw, primary, 'state'));
  const zip = nullable(readField(raw, primary, 'zip'));
  const county = nullable(readField(raw, primary, 'county'));
  const phone = nullable(readField(raw, primary, 'phone'));
  const email = nullable(readField(raw, primary, 'email'));
  const website = nullable(readField(raw, primary, 'website'));
  const latitude = toNum(readField(raw, primary, 'latitude'));
  const longitude = toNum(readField(raw, primary, 'longitude'));

  // Safe-duplicate fields: primary is base, secondaries are appended
  const descSources = readFieldAll(raw, resolver, 'services_offered');
  let description: string | null = nullable(descSources[0]) ?? null;
  for (let i = 1; i < descSources.length; i++) {
    description = controlledAppend(description, descSources[i]);
  }

  const notesSources = readFieldAll(raw, resolver, 'access_notes');
  let access_notes: string | null = nullable(notesSources[0]) ?? null;
  for (let i = 1; i < notesSources.length; i++) {
    access_notes = controlledAppend(access_notes, notesSources[i]);
  }

  const tagSources = readFieldAll(raw, resolver, 'service_tags');
  let service_tags: string | null = normalizeTags(tagSources[0] ?? null);
  for (let i = 1; i < tagSources.length; i++) {
    const next = normalizeTags(tagSources[i]);
    service_tags = controlledAppend(service_tags, next);
    service_tags = normalizeTags(service_tags); // re-dedupe
  }

  // Category resolution: explicit category → subcategory → tags hint
  const rawCategory =
    nullable(readField(raw, primary, 'category')) ??
    nullable(readField(raw, primary, 'subcategory'));
  let service_category = normalizeCategory(rawCategory) ?? rawCategory ?? null;

  // Resource class + government default
  const resource_class_raw = nullable(readField(raw, primary, 'resource_class'));
  const resource_class = (resource_class_raw ?? 'service').toLowerCase();
  if (resource_class === 'government') {
    if (!service_category || service_category === 'unknown' || service_category === 'other') {
      service_category = 'public_service';
      service_tags = controlledAppend(service_tags, 'public_service');
      service_tags = normalizeTags(service_tags);
    }
  }

  // Mappable flag — explicit value, default true
  const mappableRaw = readField(raw, primary, 'mappable');
  let mappable = toBool(mappableRaw) ?? true;

  // Minimum usability rule
  const validation_messages: ValidationMessage[] = [];
  const hasLocation = !!(county || city || street_address);
  const hasContact = !!(phone || website);
  if (!hasLocation && !hasContact) {
    mappable = false;
    validation_messages.push({
      severity: 'warning',
      field: 'name',
      message: 'Insufficient operational data — no usable location or contact information.',
    });
  }

  return {
    name,
    service_category,
    category_raw: rawCategory,
    category_mapped: autoMapCategory(rawCategory ?? service_category),
    service_subcategory: nullable(readField(raw, primary, 'subcategory')),
    description,
    street_address,
    city,
    state,
    zip,
    county,
    latitude,
    longitude,
    phone,
    email,
    website,
    access_notes,
    service_tags,
    resource_class,
    mappable,
    match_conflict: false,
    active_status: true,
    source_file_name: meta.source_file_name,
    source_row_number: meta.source_row_number,
    import_batch_id: meta.import_batch_id,
    // Carry per-row warnings through the validator (it merges, not replaces)
    validation_messages,
  };
};

/**
 * Public entry. If a resolver result is supplied (Structured Import path), use it;
 * otherwise fall back to the legacy alias-based mapping for the default
 * Services CSV flow.
 */
export const csvToStagingService = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
  resolver?: HeaderResolutionResult,
): Partial<StagingServiceRow> => {
  if (resolver) return csvToStagingServiceResolved(raw, meta, resolver);
  return csvToStagingServiceLegacy(raw, meta);
};

// ── behavioral health ──────────────────────────────────────────
export const csvToStagingBh = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
): Partial<StagingBhRow> => {
  const category_raw = nullable(
    raw.category_raw ?? raw.bh_category ?? raw.category ?? raw.bh_service_type,
  );
  return {
    name: raw.name ?? '',
    bh_entity_type: nullable(raw.bh_entity_type ?? raw.bh_type),
    bh_service_type: nullable(raw.bh_service_type),
    organization_name: nullable(raw.organization_name ?? raw.organization),
    facility_type: nullable(raw.facility_type),
    description: nullable(raw.description),
    npi: nullable(raw.npi),
    license_type: nullable(raw.license_type),
    specialties: nullable(raw.specialties),
    age_groups_served: nullable(raw.age_groups_served),
    populations_served: nullable(raw.populations_served),
    street_address: nullable(raw.street_address ?? raw.address),
    city: nullable(raw.city),
    state: nullable(raw.state),
    zip: normalizeZip(raw.zip),
    county: nullable(raw.county),
    latitude: toNum(raw.latitude ?? raw.lat),
    longitude: toNum(raw.longitude ?? raw.lng ?? raw.lon),
    phone: nullable(raw.phone),
    website: nullable(raw.website),
    fax: nullable(raw.fax),
    referral_required: toBool(raw.referral_required),
    walk_in_allowed: toBool(raw.walk_in_allowed),
    appointment_required: toBool(raw.appointment_required),
    accepts_new_patients: toBool(raw.accepts_new_patients),
    telehealth_available: toBool(raw.telehealth_available),
    hours_of_operation: nullable(raw.hours_of_operation ?? raw.hours),
    languages_supported: nullable(raw.languages_supported ?? raw.languages),
    medicaid_participation_status: nullable(raw.medicaid_participation_status ?? raw.medicaid_participation),
    payer_notes: nullable(raw.payer_notes),
    crisis_capable: toBool(raw.crisis_capable ?? raw.crisis_flag),
    detox_capable: toBool(raw.detox_capable),
    residential_capable: toBool(raw.residential_capable),
    outpatient_capable: toBool(raw.outpatient_capable ?? raw.outpatient_flag),
    mat_capable: toBool(raw.mat_capable),
    active_status: toBool(raw.active_status ?? raw.active) ?? true,
    access_notes: nullable(raw.access_notes),
    verification_source: nullable(raw.verification_source ?? raw.source),
    category_raw,
    category_mapped: autoMapBHCategory(category_raw),
    service_tags: normalizeBhAccessTags(
      raw.service_tags ?? raw.tags ?? raw.access_tags ?? raw.bh_tags,
    ),
    source_file_name: meta.source_file_name,
    source_row_number: meta.source_row_number,
    import_batch_id: meta.import_batch_id,
  };
};

export { parseCsvText, resolveHeaders };
