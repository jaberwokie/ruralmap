/**
 * Verification-only CSV import.
 * Parses a CSV with entityId, outreach, lastDirectlyVerified, verifiedBy columns,
 * matches by entityId to existing facilities, and applies verification updates
 * through the existing override + audit pipeline.
 */
import { defaultFacilities } from '@/data/facilities';
import { applyVerificationOverride } from '@/utils/serviceLineOverrides';
import { createAuditRecord } from '@/utils/verificationAuditLog';
import type { PsychiatricServiceFields, InpatientServiceFields } from '@/types/service-lines';

export interface VerificationImportResult {
  totalRows: number;
  updated: number;
  skipped: number;
  failed: number;
  details: ImportRowDetail[];
}

export interface ImportRowDetail {
  row: number;
  entityId: string;
  entityName: string;
  status: 'updated' | 'skipped' | 'failed';
  reason?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

export function importVerificationCsv(csvText: string): VerificationImportResult {
  const rows = parseCSV(csvText);
  const result: VerificationImportResult = {
    totalRows: rows.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  if (rows.length === 0) return result;

  // Validate required columns exist
  const first = rows[0];
  if (!('entityId' in first)) {
    // All rows fail
    for (let i = 0; i < rows.length; i++) {
      result.failed++;
      result.details.push({ row: i + 2, entityId: '', entityName: '', status: 'failed', reason: 'Missing entityId column' });
    }
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, skip header
    const entityId = row['entityId'] ?? '';
    const outreach = row['outreach'] ?? '';
    const lastVerified = row['lastDirectlyVerified'] ?? '';
    const verifiedBy = row['verifiedBy'] ?? '';

    // Skip empty entityId
    if (!entityId) {
      result.skipped++;
      result.details.push({ row: rowNum, entityId: '', entityName: '', status: 'skipped', reason: 'Missing entityId' });
      continue;
    }

    // Match facility
    const fac = defaultFacilities.find(f => f.id === entityId);
    if (!fac) {
      result.skipped++;
      result.details.push({ row: rowNum, entityId, entityName: '', status: 'skipped', reason: 'Unmatched entityId' });
      continue;
    }

    // Validate date if provided
    if (lastVerified && !DATE_RE.test(lastVerified)) {
      result.failed++;
      result.details.push({ row: rowNum, entityId, entityName: fac.name, status: 'failed', reason: `Invalid date format: ${lastVerified}` });
      continue;
    }

    // Skip rows with no actionable data
    if (!outreach && !lastVerified && !verifiedBy) {
      result.skipped++;
      result.details.push({ row: rowNum, entityId, entityName: fac.name, status: 'skipped', reason: 'No verification data provided' });
      continue;
    }

    // Determine service line from entity type
    const serviceLine: 'psychiatry' | 'inpatient' = fac.type === 'hospital' ? 'inpatient' : 'psychiatry';

    // Map outreach to verification status
    const outreachLower = outreach.toLowerCase().trim();
    let verStatus: string | null = null;
    if (outreachLower === 'confirmed') verStatus = 'directly_verified';
    else if (outreachLower === 'not offered' || outreachLower === 'not_offered') verStatus = 'not_offered';
    else if (outreachLower === 'wrong listing' || outreachLower === 'wrong_listing') verStatus = 'unable_to_confirm';

    // Build update fields
    const oldFields: Record<string, unknown> = {};
    const newFields: Record<string, unknown> = {};

    if (serviceLine === 'psychiatry') {
      const src = fac.psychiatric ?? {};
      if (verStatus) {
        oldFields['psychiatric_verification_status'] = (src as Record<string, unknown>).psychiatric_verification_status ?? null;
        newFields['psychiatric_verification_status'] = verStatus;
      }
      if (lastVerified) {
        oldFields['psychiatric_verification_date'] = (src as Record<string, unknown>).psychiatric_verification_date ?? null;
        newFields['psychiatric_verification_date'] = lastVerified;
      }
      if (verStatus) {
        oldFields['psychiatric_verification_source'] = (src as Record<string, unknown>).psychiatric_verification_source ?? null;
        newFields['psychiatric_verification_source'] = 'CSV Import';
      }
    } else {
      const src = fac.inpatient ?? {};
      if (verStatus) {
        oldFields['inpatient_verification_status'] = (src as Record<string, unknown>).inpatient_verification_status ?? null;
        newFields['inpatient_verification_status'] = verStatus;
      }
      if (lastVerified) {
        oldFields['inpatient_verification_date'] = (src as Record<string, unknown>).inpatient_verification_date ?? null;
        newFields['inpatient_verification_date'] = lastVerified;
      }
      if (verStatus) {
        oldFields['inpatient_verification_source'] = (src as Record<string, unknown>).inpatient_verification_source ?? null;
        newFields['inpatient_verification_source'] = 'CSV Import';
      }
    }

    // If nothing actually changes, skip
    if (Object.keys(newFields).length === 0) {
      result.skipped++;
      result.details.push({ row: rowNum, entityId, entityName: fac.name, status: 'skipped', reason: 'No applicable changes' });
      continue;
    }

    // Apply override through existing pipeline
    applyVerificationOverride({
      entity_id: entityId,
      service_line: serviceLine,
      fields: newFields as Partial<PsychiatricServiceFields> | Partial<InpatientServiceFields>,
      applied_at: new Date().toISOString(),
      applied_by: verifiedBy || null,
    });

    // Create audit record
    const outreachStatus: 'confirmed' | 'not_offered' | 'wrong_listing' =
      outreachLower === 'not offered' || outreachLower === 'not_offered' ? 'not_offered' :
      outreachLower === 'wrong listing' || outreachLower === 'wrong_listing' ? 'wrong_listing' :
      'confirmed';

    createAuditRecord({
      entity_id: entityId,
      entity_name: fac.name,
      entity_type: fac.type === 'hospital' ? 'hospital' : 'provider',
      service_line: serviceLine,
      applied_by: verifiedBy || null,
      outreach_status: outreachStatus,
      verification_source_applied: 'CSV Import',
      notes_snapshot: null,
      old_fields: oldFields,
      new_fields: newFields,
    });

    result.updated++;
    result.details.push({ row: rowNum, entityId, entityName: fac.name, status: 'updated' });
  }

  return result;
}
