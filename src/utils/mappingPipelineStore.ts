/**
 * Cloud-backed store for Service + BH mapping pipelines.
 *
 * Provides upload, list, promote, reject, edit, deactivate, and audit logging
 * operations. All mutating ops broadcast `verified-records-changed` so the
 * live map refreshes without a reload.
 *
 * Nye ingestion v5: every audit entry on the services path carries
 * `details.schema_version = 'nye_ingestion_v5'` when the resolver-driven
 * upload path is used.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  StagingServiceRow, VerifiedServiceRow, StagingBhRow, VerifiedBhRow,
  AuditLogRow, AuditAction, PipelineKey, ValidationMessage,
} from '@/types/mappingPipeline';
import { summarizeSeverity, validateServiceRow, validateBhRow } from './mappingPipelineValidation';
import { notifyVerifiedRecordsChanged } from '@/utils/verifiedRecordsBus';
import type { HeaderResolutionResult } from './serviceHeaderResolver';
import { decideUpsert, type UpsertCandidate } from './serviceUpsertMatch';
import { controlledAppend, normalizeTags } from './serviceNormalize';

type Json = Record<string, unknown>;

const NYE_SCHEMA_VERSION = 'nye_ingestion_v5';

const auditTable = () => supabase.from('mapping_audit_log' as never) as never;

export const writeAudit = async (input: {
  pipeline: PipelineKey;
  action: AuditAction;
  target_table?: string;
  target_row_id?: string;
  import_batch_id?: string;
  details?: Json;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  await (auditTable() as { insert: (row: unknown) => Promise<unknown> }).insert({
    pipeline: input.pipeline,
    action: input.action,
    target_table: input.target_table ?? null,
    target_row_id: input.target_row_id ?? null,
    import_batch_id: input.import_batch_id ?? null,
    actor_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    details: input.details ?? {},
  });
};

export const listAudit = async (pipeline?: PipelineKey, limit = 200): Promise<AuditLogRow[]> => {
  let q = (supabase.from('mapping_audit_log' as never) as never as {
    select: (s: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: AuditLogRow[] | null }> } };
  }).select('*');
  if (pipeline) {
    q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq('pipeline', pipeline);
  }
  const res = await (q as unknown as { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: AuditLogRow[] | null }> } })
    .order('created_at', { ascending: false }).limit(limit);
  return res.data ?? [];
};

// ── services ──────────────────────────────────────────────────────────
export const insertStagingServices = async (
  rows: Partial<StagingServiceRow>[],
  meta: {
    fileName: string;
    importBatchId: string;
    /** When provided, the audit entries are tagged with the Nye v5 schema version. */
    nyeMode?: boolean;
  },
): Promise<{ inserted: number; errors: number; warnings: number }> => {
  const versionTag = meta.nyeMode ? { schema_version: NYE_SCHEMA_VERSION } : {};

  await writeAudit({
    pipeline: 'services',
    action: 'upload_started',
    import_batch_id: meta.importBatchId,
    details: { ...versionTag, file: meta.fileName, rows: rows.length },
  });

  let errors = 0;
  let warnings = 0;
  const prepared = rows.map((r) => {
    const messages = validateServiceRow(r);
    const sev = summarizeSeverity(messages);
    if (sev === 'error') errors++;
    else if (sev === 'warning') warnings++;
    return {
      ...r,
      validation_messages: messages as unknown as Json[],
      validation_severity: sev,
      review_status: 'pending',
    };
  });

  const { data, error } = await (supabase.from('staging_services' as never) as never as {
    insert: (rows: unknown[]) => { select: (s: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> };
  }).insert(prepared).select('id');

  if (error) {
    await writeAudit({
      pipeline: 'services',
      action: 'upload_completed',
      import_batch_id: meta.importBatchId,
      details: { ...versionTag, error: error.message, rows: rows.length },
    });
    throw new Error(error.message);
  }

  await writeAudit({
    pipeline: 'services',
    action: 'upload_completed',
    import_batch_id: meta.importBatchId,
    details: { ...versionTag, inserted: data?.length ?? 0 },
  });
  await writeAudit({
    pipeline: 'services',
    action: 'validation_completed',
    import_batch_id: meta.importBatchId,
    details: { ...versionTag, errors, warnings, valid: (data?.length ?? 0) - errors - warnings },
  });

  return { inserted: data?.length ?? 0, errors, warnings };
};

/**
 * Write a `header_resolution` audit entry. Called by the Nye-mode upload
 * flow before any staging insert (success OR block). Always carries the
 * v5 schema_version tag.
 */
export const writeHeaderResolutionAudit = async (
  importBatchId: string,
  fileName: string,
  resolver: HeaderResolutionResult,
  duplicateFieldSources?: Array<{ canonical: string; primary: string; secondaries: string[] }>,
) => {
  await writeAudit({
    pipeline: 'services',
    action: 'header_resolution',
    import_batch_id: importBatchId,
    details: {
      schema_version: NYE_SCHEMA_VERSION,
      source_file_name: fileName,
      status: resolver.status,
      resolved_mappings: resolver.resolvedMap,
      matched_via_alias: resolver.matchedViaAlias,
      unmapped_headers: resolver.unmapped,
      missing_required: resolver.missingRequired,
      blocking_conflicts: resolver.blocking_conflicts,
      duplicate_field_sources: duplicateFieldSources ?? resolver.non_blocking_duplicates,
    },
  });
};

export const listStagingServices = async (): Promise<StagingServiceRow[]> => {
  const res = await (supabase.from('staging_services' as never) as never as {
    select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: StagingServiceRow[] | null }> };
  }).select('*').order('created_at', { ascending: false });
  return (res.data ?? []).map((r) => ({
    ...r,
    validation_messages: (r.validation_messages ?? []) as ValidationMessage[],
  }));
};

export const listVerifiedServices = async (): Promise<VerifiedServiceRow[]> => {
  const res = await (supabase.from('verified_services' as never) as never as {
    select: (s: string) => { eq: (c: string, v: boolean) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: VerifiedServiceRow[] | null }> } };
  }).select('*').eq('active_status', true).order('promoted_at', { ascending: false });
  return res.data ?? [];
};

export const promoteStagingService = async (id: string): Promise<void> => {
  const { data: stg, error: e1 } = await (supabase.from('staging_services' as never) as never as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: StagingServiceRow | null; error: { message: string } | null }> } };
  }).select('*').eq('id', id).single();
  if (e1 || !stg) throw new Error(e1?.message ?? 'Staging row not found');
  if (stg.validation_severity === 'error') throw new Error('Cannot promote a record with validation errors. Fix the source row and re-upload.');

  const { data: { user } } = await supabase.auth.getUser();
  const {
    id: _id, review_status: _rs, validation_severity: _vs, validation_messages: _vm,
    created_at: _ca, updated_at: _ua, match_conflict: _mc, ...rest
  } = stg;
  void _id; void _rs; void _vs; void _vm; void _ca; void _ua; void _mc;

  const { data: ins, error: e2 } = await (supabase.from('verified_services' as never) as never as {
    insert: (rows: unknown[]) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } };
  }).insert([{ ...rest, staging_id: stg.id, promoted_by: user?.id ?? null, verification_status: 'verified' }])
    .select('id').single();
  if (e2 || !ins) throw new Error(e2?.message ?? 'Promotion failed');

  await (supabase.from('staging_services' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'approved', last_reviewed_at: new Date().toISOString() }).eq('id', id);

  await writeAudit({
    pipeline: 'services', action: 'record_promoted',
    target_table: 'verified_services', target_row_id: ins.id,
    details: { name: stg.name, source_row_number: stg.source_row_number },
  });
  notifyVerifiedRecordsChanged();
};

/**
 * Bulk-promote multiple staging services. Skips rows with validation errors.
 * Returns per-row outcomes so the UI can surface a summary.
 */
export const promoteStagingServicesBulk = async (
  ids: string[],
): Promise<{ promoted: number; skipped: number; failed: number; failures: Array<{ id: string; reason: string }> }> => {
  let promoted = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const id of ids) {
    try {
      await promoteStagingService(id);
      promoted += 1;
    } catch (e) {
      const msg = (e as Error)?.message ?? 'unknown';
      if (/validation errors/i.test(msg)) {
        skipped += 1;
      } else {
        failed += 1;
        failures.push({ id, reason: msg });
      }
    }
  }
  // Single broadcast at the end (each promote already broadcasts; this is belt-and-suspenders)
  notifyVerifiedRecordsChanged();
  return { promoted, skipped, failed, failures };
};

export const rejectStagingService = async (id: string, reason?: string): Promise<void> => {
  const { data: stg } = await (supabase.from('staging_services' as never) as never as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: StagingServiceRow | null }> } };
  }).select('name,source_row_number').eq('id', id).single();
  await (supabase.from('staging_services' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'rejected', last_reviewed_at: new Date().toISOString() }).eq('id', id);
  await writeAudit({
    pipeline: 'services', action: 'record_rejected',
    target_table: 'staging_services', target_row_id: id,
    details: { name: stg?.name ?? null, reason: reason ?? null },
  });
};

export const deactivateVerifiedService = async (id: string): Promise<void> => {
  await (supabase.from('verified_services' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ active_status: false }).eq('id', id);
  await writeAudit({
    pipeline: 'services', action: 'verification_changed',
    target_table: 'verified_services', target_row_id: id,
    details: { active_status: false },
  });
  notifyVerifiedRecordsChanged();
};

export const editServiceRecord = async (
  scope: 'staging_services' | 'verified_services',
  id: string,
  changes: Partial<StagingServiceRow & VerifiedServiceRow>,
): Promise<void> => {
  if (Object.keys(changes).length === 0) return;
  const { error } = await (supabase.from(scope as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  }).update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);

  await writeAudit({
    pipeline: 'services', action: 'record_edited',
    target_table: scope, target_row_id: id,
    details: { changed_fields: Object.keys(changes), changes },
  });
  if (scope === 'verified_services') notifyVerifiedRecordsChanged();
};

/**
 * Controlled upsert (Nye ingestion v5). Routes each incoming row through
 * the match resolver, then either:
 *   - inserts a new staging row,
 *   - controlled-merges into the single matching staging/verified record,
 *   - inserts a new staging row flagged `match_conflict = true`.
 *
 * Returns counters for the UI banner.
 */
export const upsertStagingServicesControlled = async (
  rows: Partial<StagingServiceRow>[],
  meta: { fileName: string; importBatchId: string },
): Promise<{
  inserted: number;
  merged: number;
  conflicts: number;
  errors: number;
  warnings: number;
}> => {
  // Pull current universe (staging + verified) once. RLS filters server-side.
  const [existingStaging, existingVerified] = await Promise.all([
    listStagingServices(),
    listVerifiedServices(),
  ]);
  const universe: UpsertCandidate[] = [...existingStaging, ...existingVerified];

  let inserted = 0;
  let merged = 0;
  let conflicts = 0;
  let errors = 0;
  let warnings = 0;

  for (const row of rows) {
    const decision = decideUpsert(row, universe);

    if (decision.kind === 'merge') {
      // Controlled append into the matched record.
      const cand = decision.candidate;
      const isVerified = 'promoted_at' in cand;
      const scope: 'staging_services' | 'verified_services' =
        isVerified ? 'verified_services' : 'staging_services';

      // Build a controlled-update payload. Only fill missing fields and
      // append-merge text fields; never overwrite populated values.
      const updates: Partial<StagingServiceRow & VerifiedServiceRow> = {};
      const candAsRec = cand as unknown as Record<string, unknown>;
      const fillIfEmpty = <K extends keyof typeof updates>(key: K, value: unknown) => {
        if (value == null || value === '') return;
        if (candAsRec[key as string] == null || candAsRec[key as string] === '') {
          (updates as Record<string, unknown>)[key as string] = value;
        }
      };
      fillIfEmpty('street_address', row.street_address);
      fillIfEmpty('city', row.city);
      fillIfEmpty('state', row.state);
      fillIfEmpty('zip', row.zip);
      fillIfEmpty('county', row.county);
      fillIfEmpty('phone', row.phone);
      fillIfEmpty('email', row.email);
      fillIfEmpty('website', row.website);
      fillIfEmpty('latitude', row.latitude);
      fillIfEmpty('longitude', row.longitude);
      fillIfEmpty('service_category', row.service_category);
      fillIfEmpty('service_subcategory', row.service_subcategory);
      fillIfEmpty('organization_name', row.organization_name);

      const mergedDesc = controlledAppend(cand.description, row.description);
      if (mergedDesc !== cand.description) updates.description = mergedDesc;

      const mergedNotes = controlledAppend(cand.access_notes, row.access_notes);
      if (mergedNotes !== cand.access_notes) updates.access_notes = mergedNotes;

      let mergedTags = controlledAppend(cand.service_tags, row.service_tags);
      mergedTags = normalizeTags(mergedTags);
      if (mergedTags !== cand.service_tags) updates.service_tags = mergedTags;

      if (Object.keys(updates).length > 0) {
        await editServiceRecord(scope, cand.id, updates);
        await writeAudit({
          pipeline: 'services',
          action: 'record_edited',
          target_table: scope,
          target_row_id: cand.id,
          import_batch_id: meta.importBatchId,
          details: {
            schema_version: NYE_SCHEMA_VERSION,
            controlled_merge: true,
            match_tier: decision.tier,
            source_file_name: meta.fileName,
            source_row_number: row.source_row_number,
            changed_fields: Object.keys(updates),
          },
        });
      }
      merged += 1;
      continue;
    }

    if (decision.kind === 'conflict') {
      // Insert as new staging row, flagged for manual review.
      const conflictRow: Partial<StagingServiceRow> = {
        ...row,
        match_conflict: true,
        verification_status: 'needs_verification',
        validation_messages: [
          ...(row.validation_messages ?? []),
          {
            severity: 'warning' as const,
            field: 'name',
            message: `Multiple potential matches found (${decision.candidates.length}) — manual review required.`,
          },
        ],
      };
      const res = await insertStagingServices([conflictRow], {
        fileName: meta.fileName,
        importBatchId: meta.importBatchId,
        nyeMode: true,
      });
      inserted += res.inserted;
      errors += res.errors;
      warnings += res.warnings;
      conflicts += 1;

      await writeAudit({
        pipeline: 'services',
        action: 'record_edited',
        target_table: 'staging_services',
        import_batch_id: meta.importBatchId,
        details: {
          schema_version: NYE_SCHEMA_VERSION,
          match_conflict: true,
          match_tier: decision.tier,
          candidate_ids: decision.candidates.map((c) => c.id),
          source_file_name: meta.fileName,
          source_row_number: row.source_row_number,
        },
      });
      continue;
    }

    // No match → straight insert.
    const res = await insertStagingServices([row], {
      fileName: meta.fileName,
      importBatchId: meta.importBatchId,
      nyeMode: true,
    });
    inserted += res.inserted;
    errors += res.errors;
    warnings += res.warnings;
  }

  return { inserted, merged, conflicts, errors, warnings };
};

// ── behavioral health ─────────────────────────────────────────────────
export const insertStagingBh = async (
  rows: Partial<StagingBhRow>[],
  meta: { fileName: string; importBatchId: string },
): Promise<{ inserted: number; errors: number; warnings: number }> => {
  await writeAudit({
    pipeline: 'behavioral_health', action: 'upload_started',
    import_batch_id: meta.importBatchId,
    details: { file: meta.fileName, rows: rows.length },
  });

  let errors = 0;
  let warnings = 0;
  const prepared = rows.map((r) => {
    const messages = validateBhRow(r);
    const sev = summarizeSeverity(messages);
    if (sev === 'error') errors++;
    else if (sev === 'warning') warnings++;
    return {
      ...r,
      validation_messages: messages as unknown as Json[],
      validation_severity: sev,
      review_status: 'pending',
    };
  });

  const { data, error } = await (supabase.from('staging_bh' as never) as never as {
    insert: (rows: unknown[]) => { select: (s: string) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> };
  }).insert(prepared).select('id');
  if (error) {
    await writeAudit({
      pipeline: 'behavioral_health', action: 'upload_completed',
      import_batch_id: meta.importBatchId, details: { error: error.message },
    });
    throw new Error(error.message);
  }

  await writeAudit({
    pipeline: 'behavioral_health', action: 'upload_completed',
    import_batch_id: meta.importBatchId,
    details: { inserted: data?.length ?? 0 },
  });
  await writeAudit({
    pipeline: 'behavioral_health', action: 'validation_completed',
    import_batch_id: meta.importBatchId,
    details: { errors, warnings, valid: (data?.length ?? 0) - errors - warnings },
  });

  return { inserted: data?.length ?? 0, errors, warnings };
};

export const listStagingBh = async (): Promise<StagingBhRow[]> => {
  const res = await (supabase.from('staging_bh' as never) as never as {
    select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: StagingBhRow[] | null }> };
  }).select('*').order('created_at', { ascending: false });
  return (res.data ?? []).map((r) => ({
    ...r,
    validation_messages: (r.validation_messages ?? []) as ValidationMessage[],
  }));
};

export const listVerifiedBh = async (): Promise<VerifiedBhRow[]> => {
  const res = await (supabase.from('verified_bh' as never) as never as {
    select: (s: string) => { eq: (c: string, v: boolean) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: VerifiedBhRow[] | null }> } };
  }).select('*').eq('active_status', true).order('promoted_at', { ascending: false });
  return res.data ?? [];
};

export const promoteStagingBh = async (id: string): Promise<void> => {
  const { data: stg, error: e1 } = await (supabase.from('staging_bh' as never) as never as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: StagingBhRow | null; error: { message: string } | null }> } };
  }).select('*').eq('id', id).single();
  if (e1 || !stg) throw new Error(e1?.message ?? 'Staging row not found');
  if (stg.validation_severity === 'error') throw new Error('Cannot promote a record with validation errors. Fix the source row and re-upload.');

  const { data: { user } } = await supabase.auth.getUser();
  const { id: _id, review_status: _rs, validation_severity: _vs, validation_messages: _vm, created_at: _ca, updated_at: _ua, ...rest } = stg;
  void _id; void _rs; void _vs; void _vm; void _ca; void _ua;

  const { data: ins, error: e2 } = await (supabase.from('verified_bh' as never) as never as {
    insert: (rows: unknown[]) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } };
  }).insert([{ ...rest, staging_id: stg.id, promoted_by: user?.id ?? null, verification_status: 'verified' }])
    .select('id').single();
  if (e2 || !ins) throw new Error(e2?.message ?? 'Promotion failed');

  await (supabase.from('staging_bh' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'approved', last_reviewed_at: new Date().toISOString() }).eq('id', id);

  await writeAudit({
    pipeline: 'behavioral_health', action: 'record_promoted',
    target_table: 'verified_bh', target_row_id: ins.id,
    details: { name: stg.name, source_row_number: stg.source_row_number },
  });
  notifyVerifiedRecordsChanged();
};

export const rejectStagingBh = async (id: string, reason?: string): Promise<void> => {
  const { data: stg } = await (supabase.from('staging_bh' as never) as never as {
    select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: StagingBhRow | null }> } };
  }).select('name,source_row_number').eq('id', id).single();
  await (supabase.from('staging_bh' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ review_status: 'rejected', last_reviewed_at: new Date().toISOString() }).eq('id', id);
  await writeAudit({
    pipeline: 'behavioral_health', action: 'record_rejected',
    target_table: 'staging_bh', target_row_id: id,
    details: { name: stg?.name ?? null, reason: reason ?? null },
  });
};

export const deactivateVerifiedBh = async (id: string): Promise<void> => {
  await (supabase.from('verified_bh' as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> };
  }).update({ active_status: false }).eq('id', id);
  await writeAudit({
    pipeline: 'behavioral_health', action: 'verification_changed',
    target_table: 'verified_bh', target_row_id: id,
    details: { active_status: false },
  });
  notifyVerifiedRecordsChanged();
};

export const editBhRecord = async (
  scope: 'staging_bh' | 'verified_bh',
  id: string,
  changes: Partial<StagingBhRow & VerifiedBhRow>,
): Promise<void> => {
  if (Object.keys(changes).length === 0) return;
  const { error } = await (supabase.from(scope as never) as never as {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  }).update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);

  await writeAudit({
    pipeline: 'behavioral_health', action: 'record_edited',
    target_table: scope, target_row_id: id,
    details: { changed_fields: Object.keys(changes), changes },
  });
  if (scope === 'verified_bh') notifyVerifiedRecordsChanged();
};
