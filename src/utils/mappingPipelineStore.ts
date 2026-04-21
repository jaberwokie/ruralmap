/**
 * Cloud-backed store for Service + BH mapping pipelines.
 * Provides upload, list, promote, reject, edit, deactivate, and audit logging
 * operations. All mutating ops broadcast `verified-records-changed` so the
 * live map refreshes without a reload.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  StagingServiceRow, VerifiedServiceRow, StagingBhRow, VerifiedBhRow,
  AuditLogRow, AuditAction, PipelineKey, ValidationMessage,
} from '@/types/mappingPipeline';
import { summarizeSeverity, validateServiceRow, validateBhRow } from './mappingPipelineValidation';
import { notifyVerifiedRecordsChanged } from '@/hooks/useLiveVerifiedRecords';

type Json = Record<string, unknown>;

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
  meta: { fileName: string; importBatchId: string },
): Promise<{ inserted: number; errors: number; warnings: number }> => {
  await writeAudit({
    pipeline: 'services',
    action: 'upload_started',
    import_batch_id: meta.importBatchId,
    details: { file: meta.fileName, rows: rows.length },
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
      details: { error: error.message, rows: rows.length },
    });
    throw new Error(error.message);
  }

  await writeAudit({
    pipeline: 'services',
    action: 'upload_completed',
    import_batch_id: meta.importBatchId,
    details: { inserted: data?.length ?? 0 },
  });
  await writeAudit({
    pipeline: 'services',
    action: 'validation_completed',
    import_batch_id: meta.importBatchId,
    details: { errors, warnings, valid: (data?.length ?? 0) - errors - warnings },
  });

  return { inserted: data?.length ?? 0, errors, warnings };
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
  const { id: _id, review_status: _rs, validation_severity: _vs, validation_messages: _vm, created_at: _ca, updated_at: _ua, ...rest } = stg;
  void _id; void _rs; void _vs; void _vm; void _ca; void _ua;

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

/**
 * Update an arbitrary set of fields on a staging or verified Services row.
 * Writes a `record_edited` audit entry with the changed field names + new
 * values (truncated to keep the log compact).
 */
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

/**
 * Update an arbitrary set of fields on a staging or verified BH row.
 * Writes a `record_edited` audit entry with the changed field names + new
 * values.
 */
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
