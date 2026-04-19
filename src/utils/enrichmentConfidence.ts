/**
 * Derived, deterministic confidence score for imported/unverified metadata.
 * Never user-settable. Not equivalent to verification — purely an interpretive
 * cue for staff judging whether imported metadata is usable enough to try.
 */

import type { ProviderEnrichmentRecord } from '@/utils/providerEnrichmentStore';
import type { Facility } from '@/data/facilities';

export type EnrichmentConfidence = 'low' | 'medium' | 'high';

export const ENRICHMENT_CONFIDENCE_LABELS: Record<EnrichmentConfidence, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const nonEmpty = (v?: string) => typeof v === 'string' && v.trim() !== '';

export const deriveEnrichmentConfidence = (record: ProviderEnrichmentRecord): EnrichmentConfidence => {
  const hasNpi = nonEmpty(record.imported_npi);
  const hasPhone = nonEmpty(record.imported_phone);
  const hasWebsite = nonEmpty(record.imported_website);
  const hasContact = hasPhone || hasWebsite;

  if (hasNpi && hasContact) return 'high';
  if (hasPhone && hasWebsite) return 'medium';

  // Count usable supporting fields
  const supporting = [
    hasNpi, hasPhone, hasWebsite,
    nonEmpty(record.imported_subtype),
    nonEmpty(record.imported_medicaid_participation),
    nonEmpty(record.imported_state),
    nonEmpty(record.imported_zip),
  ].filter(Boolean).length;

  if (supporting >= 3) return 'medium';
  return 'low';
};

// ── Conflict detection ─────────────────────────────────────
export type EnrichmentConflictField = 'phone' | 'website' | 'medicaid';

export interface EnrichmentConflict {
  field: EnrichmentConflictField;
  imported: string;
  verified: string;
}

const normalizePhone = (v?: string) => (v ?? '').replace(/\D/g, '');
const normalizeUrl = (v?: string) => {
  if (!v) return '';
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return v.trim().toLowerCase();
  }
};

export const detectEnrichmentConflicts = (
  facility: Facility,
  record: ProviderEnrichmentRecord,
): EnrichmentConflict[] => {
  const conflicts: EnrichmentConflict[] = [];

  if (nonEmpty(facility.phone) && nonEmpty(record.imported_phone)) {
    if (normalizePhone(facility.phone) !== normalizePhone(record.imported_phone)) {
      conflicts.push({ field: 'phone', imported: record.imported_phone!, verified: facility.phone! });
    }
  }

  if (nonEmpty(facility.website) && nonEmpty(record.imported_website)) {
    if (normalizeUrl(facility.website) !== normalizeUrl(record.imported_website)) {
      conflicts.push({ field: 'website', imported: record.imported_website!, verified: facility.website! });
    }
  }

  const verifiedMedicaid = facility.operational?.isNevadaMedicaidParticipating;
  if (verifiedMedicaid != null && nonEmpty(record.imported_medicaid_participation)) {
    const importedRaw = record.imported_medicaid_participation!.trim().toLowerCase();
    const importedBool = ['yes', 'y', 'true', 'participating', '1'].includes(importedRaw)
      ? true
      : ['no', 'n', 'false', 'non-participating', 'not participating', '0'].includes(importedRaw)
        ? false
        : null;
    if (importedBool != null && importedBool !== verifiedMedicaid) {
      conflicts.push({
        field: 'medicaid',
        imported: record.imported_medicaid_participation!,
        verified: verifiedMedicaid ? 'Participating' : 'Non-participating',
      });
    }
  }

  return conflicts;
};
