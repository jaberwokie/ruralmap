/**
 * Cloud-backed staging store for the Provider Mapping pipeline.
 *
 * Mirrors the Service / BH staging stores but is intentionally narrower:
 *   - inserts CSV rows into `staging_providers`
 *   - validates required fields + coordinate ranges
 *   - bulk-geocodes mappable rows missing coords (Nominatim, reused util)
 *   - on promote, writes the row into the existing imported facilities
 *     store (`appendImportedFacilities`) so it appears as a pin on the map
 *     immediately, exactly like the legacy import path
 *
 * NOTE: There is no `verified_providers` table; promotion is recorded in
 * the audit log and persisted client-side via the existing facility store.
 * Map rendering, clustering, Access Gaps, and Response Capability are not
 * touched by this module.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  StagingProviderRow, ValidationMessage, ValidationSeverity, AuditLogRow,
} from '@/types/mappingPipeline';
import { writeAudit, listAudit } from '@/utils/mappingPipelineStore';
import {
  appendImportedFacilities, getImportedFacilities, upsertImportedFacility,
} from '@/utils/importedFacilitiesStore';
import { findProviderMatch } from '@/utils/providerMatchKey';
import {
  geocodeMany, summarizeGeocodeRun, stampGeocodeTag, spotCheckCoordinate,
  type GeocodeOutcome, type GeocodeRunSummary,
} from '@/utils/serviceGeocode';
import type { Facility, FacilityType } from '@/data/facilities';

type Json = Record<string, unknown>;

const isFiniteLat = (v: number | null) => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isFiniteLng = (v: number | null) => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

const summarize = (m: ValidationMessage[]): ValidationSeverity => {
  if (m.some((x) => x.severity === 'error')) return 'error';
  if (m.some((x) => x.severity === 'warning')) return 'warning';
  return 'valid';
};

export const validateProviderRow = (row: Partial<StagingProviderRow>): ValidationMessage[] => {
  const out: ValidationMessage[] = [];
  if (!row.name || row.name.trim().length === 0) {
    out.push({ field: 'name', severity: 'error', message: 'Name is required.' });
  }
  const hasLat = row.latitude != null;
  const hasLng = row.longitude != null;
  if (hasLat !== hasLng) {
    out.push({ field: 'latitude/longitude', severity: 'error', message: 'Latitude and longitude must be provided together.' });
  }
  if (hasLat && !isFiniteLat(row.latitude ?? null)) {
    out.push({ field: 'latitude', severity: 'error', message: 'Latitude must be between -90 and 90.' });
  }
  if (hasLng && !isFiniteLng(row.longitude ?? null)) {
    out.push({ field: 'longitude', severity: 'error', message: 'Longitude must be between -180 and 180.' });
  }
  if (!hasLat && !hasLng && !row.street_address) {
    out.push({
      field: 'address',
      severity: 'warning',
      message: 'No coordinates and no street address — record cannot be geocoded or promoted.',
    });
  }
  if (row.npi && !/^\d{10}$/.test(row.npi)) {
    out.push({ field: 'npi', severity: 'warning', message: 'NPI should be 10 digits.' });
  }
  if (row.zip && !/^\d{5}(-\d{4})?$/.test(row.zip)) {
    out.push({ field: 'zip', severity: 'warning', message: 'ZIP should be 5 digits or ZIP+4.' });
  }
  return out;
};

// ───── CSV mapping ─────
const HEADER_ALIASES: Record<keyof Pick<StagingProviderRow,
  'name'|'type'|'provider_name'|'npi'|'organization_name'|'street_address'|
  'city'|'state'|'zip'|'county'|'latitude'|'longitude'|'phone'|'website'|'notes'>, string[]> = {
  name: ['name', 'verified_name', 'provider_name', 'facility_name'],
  type: ['type', 'facility_type'],
  provider_name: ['provider_name'],
  npi: ['npi', 'verified_npi'],
  organization_name: ['organization', 'organization_name', 'org'],
  street_address: ['street_address', 'address', 'verified_address', 'street'],
  city: ['city', 'verified_city'],
  state: ['state', 'verified_state'],
  zip: ['zip', 'verified_zip', 'postal', 'postal_code'],
  county: ['county', 'verified_county'],
  latitude: ['latitude', 'lat', 'verified_lat'],
  longitude: ['longitude', 'lng', 'lon', 'verified_lng', 'verified_lon'],
  phone: ['phone', 'telephone'],
  website: ['website', 'url'],
  notes: ['notes', 'note'],
};

const norm = (s: string) => s.trim().toLowerCase();
const pick = (row: Record<string, string>, aliases: string[]): string => {
  const keys = Object.keys(row).map((k) => [norm(k), k] as const);
  for (const a of aliases) {
    const hit = keys.find(([n]) => n === a);
    if (hit) return (row[hit[1]] ?? '').trim();
  }
  return '';
};
const numOrNull = (s: string): number | null => {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (s: string): string | null => (s && s.trim() !== '' ? s.trim() : null);

export const csvToStagingProvider = (
  row: Record<string, string>,
  meta: { source_file_name: string; source_row_number: number; import_batch_id: string },
): Partial<StagingProviderRow> => {
  const get = (k: keyof typeof HEADER_ALIASES) => pick(row, HEADER_ALIASES[k]);
  const rawType = get('type').toLowerCase();
  const normalizedType = rawType.includes('hospital') ? 'hospital' : rawType ? 'clinic' : null;
  return {
    name: get('name'),
    type: normalizedType,
    provider_name: strOrNull(get('provider_name')),
    npi: strOrNull(get('npi')),
    organization_name: strOrNull(get('organization_name')),
    street_address: strOrNull(get('street_address')),
    city: strOrNull(get('city')),
    state: strOrNull(get('state')),
    zip: strOrNull(get('zip')),
    county: strOrNull(get('county')),
    latitude: numOrNull(get('latitude')),
    longitude: numOrNull(get('longitude')),
    phone: strOrNull(get('phone')),
    website: strOrNull(get('website')),
    notes: strOrNull(get('notes')),
    source_file_name: meta.source_file_name,
    source_row_number: meta.source_row_number,
    import_batch_id: meta.import_batch_id,
  };
};

// ───── DB operations ─────
const tbl = () => (supabase.from('staging_providers' as never) as never);

export const insertStagingProviders = async (
  rows: Partial<StagingProviderRow>[],
  meta: { fileName: string; importBatchId: string },
): Promise<{ inserted: number; errors: number; warnings: number }> => {
  await writeAudit({
    pipeline: 'provider_mapping',
    action: 'upload_started',
    import_batch_id: meta.importBatchId,
    details: { file: meta.fileName, rows: rows.length },
  });

  let errors = 0;
  let warnings = 0;
  const prepared = rows.map((r) => {
    const messages = validateProviderRow(r);
    const sev = summarize(messages);
    if (sev === 'error') errors++;
    else if (sev === 'warning') warnings++;
    return {
      ...r,
      validation_messages: messages as unknown as Json[],
      validation_severity: sev,
      review_status: 'pending',
    };
  });

  const { data, error } = await (tbl() as unknown as {
    insert: (rows: unknown[]) => { select: (s: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> };
  }).insert(prepared).select('id');

  if (error) {
    await writeAudit({
      pipeline: 'provider_mapping', action: 'upload_completed',
      import_batch_id: meta.importBatchId,
      details: { error: error.message, rows: rows.length },
    });
    throw new Error(error.message);
  }

  await writeAudit({
    pipeline: 'provider_mapping', action: 'upload_completed',
    import_batch_id: meta.importBatchId,
    details: { inserted: data?.length ?? 0 },
  });
  await writeAudit({
    pipeline: 'provider_mapping', action: 'validation_completed',
    import_batch_id: meta.importBatchId,
    details: { errors, warnings, valid: (data?.length ?? 0) - errors - warnings },
  });

  return { inserted: data?.length ?? 0, errors, warnings };
};

export const listStagingProviders = async (): Promise<StagingProviderRow[]> => {
  const res = await (tbl() as unknown as {
    select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: StagingProviderRow[] | null }> };
  }).select('*').order('created_at', { ascending: false });
  return (res.data ?? []).map((r) => ({
    ...r,
    validation_messages: (r.validation_messages ?? []) as ValidationMessage[],
  }));
};

export const editProviderStaging = async (
  id: string,
  changes: Partial<StagingProviderRow>,
): Promise<void> => {
  if (Object.keys(changes).length === 0) return;
  const { error } = await (tbl() as unknown as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  }).update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await writeAudit({
    pipeline: 'provider_mapping', action: 'record_edited',
    target_table: 'staging_providers', target_row_id: id,
    details: { changed_fields: Object.keys(changes) },
  });
};

export const rejectStagingProvider = async (id: string): Promise<void> => {
  const { data: stg } = await (tbl() as unknown as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: { name: string } | null }> } };
  }).select('name').eq('id', id).single();
  await (tbl() as unknown as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'rejected', last_reviewed_at: new Date().toISOString() }).eq('id', id);
  await writeAudit({
    pipeline: 'provider_mapping', action: 'record_rejected',
    target_table: 'staging_providers', target_row_id: id,
    details: { name: stg?.name ?? null },
  });
};

const toFacility = (r: StagingProviderRow, id?: string): Facility => {
  const type: FacilityType = r.type === 'hospital' ? 'hospital' : 'clinic';
  const f: Facility & { npi?: string | null } = {
    id: id ?? `staging-${r.id}`,
    name: r.name,
    type,
    city: r.city ?? '',
    county: r.county ?? '',
    address: r.street_address ?? undefined,
    phone: r.phone ?? undefined,
    website: r.website ?? undefined,
    lat: r.latitude as number,
    lng: r.longitude as number,
    notes: r.notes ?? undefined,
    dataConfidence: 'Unverified',
  };
  if (r.npi) (f as { npi?: string | null }).npi = r.npi;
  return f;
};

export type PromoteOutcome = 'created' | 'updated' | 'conflict';

export const promoteStagingProvider = async (
  id: string,
  options?: { resolveConflict?: 'force_update' | 'force_create' },
): Promise<PromoteOutcome> => {
  const { data: stg, error: e1 } = await (tbl() as unknown as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: StagingProviderRow | null; error: { message: string } | null }> } };
  }).select('*').eq('id', id).single();
  if (e1 || !stg) throw new Error(e1?.message ?? 'Staging row not found');
  if (stg.validation_severity === 'error') throw new Error('Cannot promote a record with validation errors.');
  if (stg.latitude == null || stg.longitude == null) {
    throw new Error('Cannot promote without latitude and longitude. Geocode first.');
  }

  const existing = getImportedFacilities();
  const match = findProviderMatch(
    {
      name: stg.name, npi: stg.npi, city: stg.city, county: stg.county,
      phone: stg.phone, street_address: stg.street_address,
    },
    existing,
  );

  let outcome: PromoteOutcome;
  let action: 'provider_created' | 'provider_updated' | 'provider_skipped_conflict';

  if (match.outcome === 'conflict' && !options?.resolveConflict) {
    // Leave staging pending; do not auto-merge.
    await writeAudit({
      pipeline: 'provider_mapping', action: 'provider_skipped_conflict',
      target_table: 'staging_providers', target_row_id: id,
      details: {
        name: stg.name,
        candidate_ids: (match.candidates ?? []).map((c) => c.id),
      },
    });
    return 'conflict';
  }

  if (match.outcome === 'match' || (match.outcome === 'conflict' && options?.resolveConflict === 'force_update')) {
    const target = match.matched ?? match.candidates?.[0];
    if (target && options?.resolveConflict !== 'force_create') {
      upsertImportedFacility(toFacility(stg, target.id), target.id);
      outcome = 'updated';
      action = 'provider_updated';
    } else {
      appendImportedFacilities([toFacility(stg)]);
      outcome = 'created';
      action = 'provider_created';
    }
  } else {
    appendImportedFacilities([toFacility(stg)]);
    outcome = 'created';
    action = 'provider_created';
  }

  await (tbl() as unknown as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'approved', last_reviewed_at: new Date().toISOString() }).eq('id', id);

  await writeAudit({
    pipeline: 'provider_mapping', action,
    target_table: 'staging_providers', target_row_id: id,
    details: {
      name: stg.name,
      source_row_number: stg.source_row_number,
      target: 'imported_facilities_store',
      strategy: match.strategy ?? null,
      matched_id: match.matched?.id ?? null,
    },
  });
  return outcome;
};

export const promoteStagingProvidersBulk = async (
  ids: string[],
): Promise<{ promoted: number; created: number; updated: number; conflict: number; skipped: number; failed: number; failures: Array<{ id: string; reason: string }> }> => {
  let created = 0, updated = 0, conflict = 0, skipped = 0, failed = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const id of ids) {
    try {
      const out = await promoteStagingProvider(id);
      if (out === 'created') created += 1;
      else if (out === 'updated') updated += 1;
      else if (out === 'conflict') conflict += 1;
    } catch (e) {
      const msg = (e as Error)?.message ?? 'unknown';
      if (/validation errors/i.test(msg) || /latitude/i.test(msg)) {
        skipped += 1; failures.push({ id, reason: msg });
      } else {
        failed += 1; failures.push({ id, reason: msg });
      }
    }
  }
  return { promoted: created + updated, created, updated, conflict, skipped, failed, failures };
};

export const geocodeStagingProvidersBulk = async (
  ids: string[],
  options?: { onProgress?: (done: number, total: number, last: GeocodeOutcome) => void },
): Promise<GeocodeRunSummary> => {
  const all = await listStagingProviders();
  const byId = new Map(all.map((r) => [r.id, r] as const));
  const targets = ids.map((id) => byId.get(id)).filter((r): r is StagingProviderRow => !!r);

  // Adapt rows to the GeocodeCandidate shape; provider rows always treated as mappable.
  const candidates = targets.map((r) => ({
    id: r.id,
    mappable: true as const,
    latitude: r.latitude,
    longitude: r.longitude,
    street_address: r.street_address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    county: r.county,
    access_notes: r.access_notes,
  }));

  const outcomes = await geocodeMany(candidates, options?.onProgress);
  for (let i = 0; i < outcomes.length; i++) {
    const oc = outcomes[i];
    const row = targets[i];
    if (!row) continue;
    if (oc.status === 'geocoded' && oc.latitude != null && oc.longitude != null) {
      const publicConfidence: 'high' | 'low' =
        oc.strategy === 'address_full' ? 'high' : 'low';
      const stampedNotes = stampGeocodeTag(row.access_notes, oc.strategy!, publicConfidence);
      await editProviderStaging(row.id, {
        latitude: oc.latitude,
        longitude: oc.longitude,
        access_notes: stampedNotes,
      });

      // Reverse geocode spot-check
      const spotCheck = await spotCheckCoordinate(
        oc.latitude,
        oc.longitude,
        row.zip,
        row.street_address,
      );
      if (!spotCheck.passed && publicConfidence === 'high') {
        const downgradedNotes = stampGeocodeTag(row.access_notes, oc.strategy!, 'low');
        await editProviderStaging(row.id, {
          access_notes: downgradedNotes,
        });
      }

      await writeAudit({
        pipeline: 'provider_mapping',
        action: 'record_edited',
        target_table: 'staging_providers',
        target_row_id: row.id,
        details: {
          geocode: true,
          strategy: oc.strategy,
          confidence: publicConfidence,
          latitude: oc.latitude,
          longitude: oc.longitude,
          spotCheck,
        },
      });
    } else if (oc.status === 'failed' || (oc.status === 'skipped' && oc.reason !== 'list-only (mappable=false)')) {
      const stampedNotes = stampGeocodeTag(row.access_notes, 'failed', 'low');
      await editProviderStaging(row.id, {
        access_notes: stampedNotes,
      });
      await writeAudit({
        pipeline: 'provider_mapping',
        action: 'record_edited',
        target_table: 'staging_providers',
        target_row_id: row.id,
        details: { geocode: true, status: 'none', reason: oc.reason },
      });
    }
  }
  return summarizeGeocodeRun(outcomes);
};

export const listProviderAudit = (limit = 200): Promise<AuditLogRow[]> =>
  listAudit('provider_mapping', limit);
