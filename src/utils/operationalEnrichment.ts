/**
 * Operational Enrichment — merge operational metadata tags into entity records.
 *
 * Called at load time to enrich Facility and RuralService arrays
 * with verified operational metadata from the central source.
 */

import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import type { ServiceOperationalMeta } from '@/types/medicaid';
import { getOperationalTagIndex, operationalTags, type OperationalTag } from '@/data/operational-metadata';

// ── Enrichment ──

const tagToPartialMeta = (tag: OperationalTag): Partial<ServiceOperationalMeta> => {
  const meta: Partial<ServiceOperationalMeta> = {};

  if (tag.isNevadaMedicaidParticipating === true) {
    meta.isNevadaMedicaidParticipating = true;
    meta.medicaidParticipationStatus = 'participating';
  } else if (tag.isNevadaMedicaidParticipating === false) {
    meta.isNevadaMedicaidParticipating = false;
    meta.medicaidParticipationStatus = 'non_participating';
  }
  // null/undefined → leave fields absent so defaults apply (unknown)

  return meta;
};

/**
 * Enrich a single entity's operational field from the tag index.
 * Existing operational data on the entity takes precedence (no overwrite).
 */
const mergeTag = (
  existing: Partial<ServiceOperationalMeta> | undefined,
  tag: OperationalTag | undefined,
): Partial<ServiceOperationalMeta> | undefined => {
  if (!tag) return existing;
  const fromTag = tagToPartialMeta(tag);
  if (!existing) return fromTag;
  return { ...fromTag, ...existing };
};

export const enrichFacilities = (facilities: Facility[]): Facility[] => {
  const index = getOperationalTagIndex();

  const enriched = facilities.map((f) => {
    const tag = index.get(f.id);
    if (tag) {
      return { ...f, operational: mergeTag(f.operational, tag) };
    }
    return f;
  });

  if (import.meta.env.DEV) {
    runEnrichmentVerification(facilities, 'facility');
  }

  return enriched;
};

export const enrichRuralServices = (services: RuralService[]): RuralService[] => {
  const index = getOperationalTagIndex();

  const enriched = services.map((s) => {
    const tag = index.get(s.id);
    if (tag) {
      return { ...s, operational: mergeTag(s.operational, tag) };
    }
    return s;
  });

  if (import.meta.env.DEV) {
    runEnrichmentVerification(services, 'ruralService');
  }

  return enriched;
};

// ── Verification Pass (dev only) ──

interface VerificationRow {
  tagId: string;
  matched: boolean;
  entityName?: string;
  entityType: string;
  participationValue: string;
  verificationSource: string;
}

const runEnrichmentVerification = (
  entities: Array<{ id: string; name: string }>,
  entityType: 'facility' | 'ruralService',
) => {
  const index = getOperationalTagIndex();
  const entityMap = new Map(entities.map((e) => [e.id, e.name]));
  const rows: VerificationRow[] = [];
  const unmatched: { tagId: string; source: string; notes?: string }[] = [];

  for (const [tagId, tag] of index) {
    if (tag.entityType !== entityType) continue;

    const entityName = entityMap.get(tagId);
    if (entityName) {
      rows.push({
        tagId,
        matched: true,
        entityName,
        entityType,
        participationValue:
          tag.isNevadaMedicaidParticipating === true ? 'Yes' :
          tag.isNevadaMedicaidParticipating === false ? 'No' : 'Unknown',
        verificationSource: tag.verificationSource,
      });
    } else {
      unmatched.push({ tagId, source: tag.verificationSource, notes: tag.notes });
    }
  }

  if (rows.length > 0) {
    console.info(
      `[Operational Verification] ${entityType}: ${rows.length} matched tags`,
    );
    console.table(rows);
  }

  if (unmatched.length > 0) {
    console.warn(
      `[Operational Verification] ${entityType}: ${unmatched.length} UNMATCHED tags`,
    );
    console.table(unmatched);
  }
};

// ── Dev Audit Summary (grouped by category) ──

export interface OperationalAuditSummary {
  totalEntities: number;
  facilities: { participating: number; nonParticipating: number; unknown: number };
  ruralServices: { participating: number; nonParticipating: number; unknown: number };
}

const countParticipation = (ops: Array<Partial<ServiceOperationalMeta> | undefined>) => {
  let participating = 0;
  let nonParticipating = 0;
  let unknown = 0;
  for (const op of ops) {
    if (op?.isNevadaMedicaidParticipating === true) participating++;
    else if (op?.isNevadaMedicaidParticipating === false) nonParticipating++;
    else unknown++;
  }
  return { participating, nonParticipating, unknown };
};

export const auditOperationalCoverage = (
  facilities: Facility[],
  services: RuralService[],
): OperationalAuditSummary => {
  return {
    totalEntities: facilities.length + services.length,
    facilities: countParticipation(facilities.map((f) => f.operational)),
    ruralServices: countParticipation(services.map((s) => s.operational)),
  };
};

// ── Global Verified Access Summary (dev only) ──

export const logVerifiedAccessSummary = () => {
  if (!import.meta.env.DEV) return;

  let directVerified = 0;
  let inferredStrong = 0;
  let needsVerification = 0;
  let deferred = 0;
  let other = 0;

  for (const tag of operationalTags) {
    const status = tag.verificationStatus;
    if (status === 'verified_participating' || status === 'verified_non_participating') {
      if (tag.verificationConfidence === 'direct') directVerified++;
      else if (tag.verificationConfidence === 'inferred_strong') inferredStrong++;
      else directVerified++; // facility tags without explicit confidence are direct
    } else if (status === 'needs_verification') {
      needsVerification++;
    } else if (status === 'deferred') {
      deferred++;
    } else {
      // Tags without verificationStatus (legacy facility tags)
      if (tag.isNevadaMedicaidParticipating === true) directVerified++;
      else if (tag.isNevadaMedicaidParticipating === false) other++;
      else needsVerification++;
    }
  }

  console.info(
    `[Verified Access Summary] direct: ${directVerified} | inferred_strong: ${inferredStrong} | needs_verification: ${needsVerification} | deferred: ${deferred} | other: ${other} | total tags: ${operationalTags.length}`,
  );
};
