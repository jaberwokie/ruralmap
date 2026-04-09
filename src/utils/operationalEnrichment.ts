/**
 * Operational Enrichment — merge operational metadata tags into entity records.
 *
 * Called at load time to enrich Facility and RuralService arrays
 * with verified operational metadata from the central source.
 */

import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import type { ServiceOperationalMeta } from '@/types/medicaid';
import { getOperationalTagIndex, type OperationalTag } from '@/data/operational-metadata';

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
  // Existing data wins — tag fills gaps only
  return { ...fromTag, ...existing };
};

export const enrichFacilities = (facilities: Facility[]): Facility[] => {
  const index = getOperationalTagIndex();
  let matched = 0;
  let unmatched = 0;

  const enriched = facilities.map((f) => {
    const tag = index.get(f.id);
    if (tag) {
      matched++;
      return { ...f, operational: mergeTag(f.operational, tag) };
    }
    return f;
  });

  // Dev audit: count tags that didn't match any entity
  if (import.meta.env.DEV) {
    const facilityIds = new Set(facilities.map((f) => f.id));
    for (const [tagId, tag] of index) {
      if (tag.entityType === 'facility' && !facilityIds.has(tagId)) {
        unmatched++;
        console.warn(`[Operational Enrichment] Unmatched facility tag: ${tagId}`);
      }
    }
    console.info(`[Operational Enrichment] Facilities: ${matched} matched, ${unmatched} unmatched tags`);
  }

  return enriched;
};

export const enrichRuralServices = (services: RuralService[]): RuralService[] => {
  const index = getOperationalTagIndex();
  let matched = 0;
  let unmatched = 0;

  const enriched = services.map((s) => {
    const tag = index.get(s.id);
    if (tag) {
      matched++;
      return { ...s, operational: mergeTag(s.operational, tag) };
    }
    return s;
  });

  if (import.meta.env.DEV) {
    const serviceIds = new Set(services.map((s) => s.id));
    for (const [tagId, tag] of index) {
      if (tag.entityType === 'ruralService' && !serviceIds.has(tagId)) {
        unmatched++;
        console.warn(`[Operational Enrichment] Unmatched service tag: ${tagId}`);
      }
    }
    console.info(`[Operational Enrichment] Services: ${matched} matched, ${unmatched} unmatched tags`);
  }

  return enriched;
};

// ── Dev Audit Summary ──

export interface OperationalAuditSummary {
  totalEntities: number;
  participating: number;
  nonParticipating: number;
  unknown: number;
}

export const auditOperationalCoverage = (
  facilities: Facility[],
  services: RuralService[],
): OperationalAuditSummary => {
  const all = [
    ...facilities.map((f) => f.operational),
    ...services.map((s) => s.operational),
  ];

  let participating = 0;
  let nonParticipating = 0;
  let unknown = 0;

  for (const op of all) {
    if (op?.isNevadaMedicaidParticipating === true) participating++;
    else if (op?.isNevadaMedicaidParticipating === false) nonParticipating++;
    else unknown++;
  }

  return {
    totalEntities: all.length,
    participating,
    nonParticipating,
    unknown,
  };
};
