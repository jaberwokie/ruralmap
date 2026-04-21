/**
 * CSV intake utilities for Service + BH pipelines.
 * Lightweight RFC-4180 parser (handles quoted cells, embedded commas, CRLF).
 */

import type { StagingServiceRow, StagingBhRow } from '@/types/mappingPipeline';

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
  return t.length === 0 ? null : t;
};

// ── service mapping ────────────────────────────────────────────
export const csvToStagingService = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
): Partial<StagingServiceRow> => ({
  name: raw.name ?? '',
  service_category: nullable(raw.service_category ?? raw.category),
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
});

// ── behavioral health ──────────────────────────────────────────
export const csvToStagingBh = (
  raw: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
): Partial<StagingBhRow> => ({
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
  zip: nullable(raw.zip),
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
  source_file_name: meta.source_file_name,
  source_row_number: meta.source_row_number,
  import_batch_id: meta.import_batch_id,
});

export { parseCsvText };
