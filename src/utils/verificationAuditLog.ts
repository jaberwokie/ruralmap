/**
 * Verification audit log — additive traceability layer for Apply Verification.
 * Persisted in localStorage alongside (but separate from) override data.
 */
import type { PsychiatricServiceFields, InpatientServiceFields } from '@/types/service-lines';

const STORAGE_KEY = 'nbh_verification_audit_log';

export interface AuditChangedField {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

export interface VerificationAuditRecord {
  audit_id: string;
  entity_id: string;
  entity_name: string;
  entity_type: 'provider' | 'hospital';
  service_line: 'psychiatry' | 'inpatient';
  applied_by: string | null;
  applied_date: string;
  outreach_status: 'confirmed' | 'not_offered' | 'wrong_listing';
  verification_source_applied: string | null;
  changed_fields: AuditChangedField[];
  notes_snapshot: string | null;
}

// ── Persistence ──

function loadAuditLog(): VerificationAuditRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAuditLog(log: VerificationAuditRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export function getAuditLog(): VerificationAuditRecord[] {
  return loadAuditLog();
}

export function getEntityAuditLog(entityId: string, serviceLine?: 'psychiatry' | 'inpatient'): VerificationAuditRecord[] {
  const log = loadAuditLog();
  return log
    .filter(r => r.entity_id === entityId && (!serviceLine || r.service_line === serviceLine))
    .sort((a, b) => b.applied_date.localeCompare(a.applied_date));
}

// ── Diff + Record Creation ──

function diffFields(
  oldFields: Record<string, unknown>,
  newFields: Record<string, unknown>,
): AuditChangedField[] {
  const changed: AuditChangedField[] = [];
  for (const key of Object.keys(newFields)) {
    const ov = oldFields[key] ?? null;
    const nv = newFields[key] ?? null;
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      changed.push({ field: key, old_value: ov, new_value: nv });
    }
  }
  return changed;
}

function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create and persist an audit record.
 * Returns the record if at least one field changed, null otherwise (no-op save).
 */
export function createAuditRecord(params: {
  entity_id: string;
  entity_name: string;
  entity_type: 'provider' | 'hospital';
  service_line: 'psychiatry' | 'inpatient';
  applied_by: string | null;
  outreach_status: 'confirmed' | 'not_offered' | 'wrong_listing';
  verification_source_applied: string | null;
  notes_snapshot: string | null;
  old_fields: Record<string, unknown>;
  new_fields: Record<string, unknown>;
}): VerificationAuditRecord | null {
  const changed = diffFields(params.old_fields, params.new_fields);
  if (changed.length === 0) return null;

  const record: VerificationAuditRecord = {
    audit_id: generateId(),
    entity_id: params.entity_id,
    entity_name: params.entity_name,
    entity_type: params.entity_type,
    service_line: params.service_line,
    applied_by: params.applied_by,
    applied_date: new Date().toISOString(),
    outreach_status: params.outreach_status,
    verification_source_applied: params.verification_source_applied,
    changed_fields: changed,
    notes_snapshot: params.notes_snapshot,
  };

  const log = loadAuditLog();
  log.unshift(record);
  saveAuditLog(log);
  return record;
}

// ── Last Directly Verified Derivation ──

export interface LastDirectlyVerified {
  date: string | null;
  by: string | null;
}

export function deriveLastDirectlyVerified(
  entityId: string,
  serviceLine: 'psychiatry' | 'inpatient',
  currentVerificationStatus: string | null | undefined,
): LastDirectlyVerified {
  if (currentVerificationStatus !== 'directly_verified') {
    return { date: null, by: null };
  }
  const records = getEntityAuditLog(entityId, serviceLine);
  const match = records.find(r => r.outreach_status === 'confirmed');
  if (!match) return { date: null, by: null };
  return {
    date: match.applied_date.slice(0, 10),
    by: match.applied_by,
  };
}
