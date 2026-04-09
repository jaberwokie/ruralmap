/**
 * Operational Service Classification — provisional triage for rural services.
 *
 * Assigns an operationalServiceClass based on category and name heuristics.
 * This is provisional and overrideable per-entity in operational-metadata.ts.
 */

import type { RuralService, RuralServiceCategory, OperationalServiceClass } from '@/data/rural-services';
import { getOperationalTagIndex, type VerificationStatus, type DeferredReason } from '@/data/operational-metadata';

// ── Category-based classification ──

const CLINICAL_CATEGORIES = new Set<RuralServiceCategory>([
  'Physical Health',
]);

const BH_CLINICAL_CATEGORIES = new Set<RuralServiceCategory>([
  'Mental Health',
  'Substance Use',
]);

const SUPPORTIVE_CATEGORIES = new Set<RuralServiceCategory>([
  'Coordinated Entry',
  'Shelter',
  'Supportive Housing',
  'Legal',
  'Housing (Low-Income)',
  'Food',
  'Family Services',
  'Senior Services',
  'Employment',
  'Disability Services',
]);

// Recovery/Boarding is ambiguous — some are clinical, some are supportive housing
const AMBIGUOUS_CATEGORIES = new Set<RuralServiceCategory>([
  'Recovery/Boarding',
]);

// ── Name-based heuristics for edge cases ──

const TRIBAL_NAME_PATTERNS = /\b(tribal|tribe|indian|native)\b/i;
const CLINICAL_NAME_PATTERNS = /\b(clinic|medical|hospital|health center|fqhc|physician|doctor|nurse|nursing)\b/i;

/**
 * Classify a rural service into an operational triage bucket.
 * Returns a provisional class — can be overridden in operational-metadata.ts.
 */
export const classifyRuralService = (service: Pick<RuralService, 'category' | 'name' | 'notes'>): OperationalServiceClass => {
  const { category, name, notes } = service;
  const combinedText = `${name} ${notes ?? ''}`;

  // Tribal clinical detection (name-based, category must be clinical or BH)
  if (TRIBAL_NAME_PATTERNS.test(combinedText)) {
    if (CLINICAL_CATEGORIES.has(category) || BH_CLINICAL_CATEGORIES.has(category)) {
      return 'tribal_clinical';
    }
  }

  // Direct category matches
  if (CLINICAL_CATEGORIES.has(category)) return 'billable_clinical';
  if (BH_CLINICAL_CATEGORIES.has(category)) return 'behavioral_health_clinical';
  if (SUPPORTIVE_CATEGORIES.has(category)) return 'supportive_nonbilling';

  // Ambiguous categories — check name for clinical signals
  if (AMBIGUOUS_CATEGORIES.has(category)) {
    if (CLINICAL_NAME_PATTERNS.test(combinedText)) return 'billable_clinical';
    return 'supportive_nonbilling';
  }

  return 'unknown';
};

/**
 * Apply provisional classification to all rural services.
 * Does NOT overwrite existing operationalServiceClass values.
 */
export const classifyAllRuralServices = (services: RuralService[]): RuralService[] => {
  return services.map((s) => {
    if (s.operationalServiceClass) return s; // already classified, don't overwrite
    return { ...s, operationalServiceClass: classifyRuralService(s) };
  });
};

// ── Audit ──

export interface ClassParticipationRow {
  class: OperationalServiceClass;
  participating: number;
  nonParticipating: number;
  unknown: number;
  total: number;
}

export interface ServiceClassAudit {
  rows: ClassParticipationRow[];
  total: number;
}

const CLASSES: OperationalServiceClass[] = [
  'billable_clinical',
  'tribal_clinical',
  'behavioral_health_clinical',
  'supportive_nonbilling',
  'unknown',
];

export const auditServiceClassification = (services: RuralService[]): ServiceClassAudit => {
  const buckets = new Map<OperationalServiceClass, { p: number; n: number; u: number }>();
  for (const cls of CLASSES) buckets.set(cls, { p: 0, n: 0, u: 0 });

  for (const s of services) {
    const cls = s.operationalServiceClass ?? 'unknown';
    const b = buckets.get(cls) ?? { p: 0, n: 0, u: 0 };
    if (s.operational?.isNevadaMedicaidParticipating === true) b.p++;
    else if (s.operational?.isNevadaMedicaidParticipating === false) b.n++;
    else b.u++;
  }

  const rows: ClassParticipationRow[] = CLASSES
    .map((cls) => {
      const b = buckets.get(cls)!;
      return { class: cls, participating: b.p, nonParticipating: b.n, unknown: b.u, total: b.p + b.n + b.u };
    })
    .filter((r) => r.total > 0);

  return { rows, total: services.length };
};

// ── Tagging Queue (dev) ──

export interface TaggingQueueEntry {
  id: string;
  name: string;
  category: string;
  county: string;
  class: OperationalServiceClass;
  verificationStatus: VerificationStatus;
}

const resolveVerificationStatus = (
  serviceId: string,
  participatingValue?: boolean | null,
): VerificationStatus => {
  const index = getOperationalTagIndex();
  const tag = index.get(serviceId);
  if (tag?.verificationStatus) return tag.verificationStatus;
  // Derive from participation value if tag exists but no explicit status
  if (participatingValue === true) return 'verified_participating';
  if (participatingValue === false) return 'verified_non_participating';
  return 'needs_verification';
};

/**
 * Generate a tagging queue for priority-class services.
 */
export const getTaggingQueue = (services: RuralService[]): TaggingQueueEntry[] => {
  const priorityClasses = new Set<OperationalServiceClass>([
    'billable_clinical',
    'behavioral_health_clinical',
    'tribal_clinical',
  ]);

  return services
    .filter((s) => priorityClasses.has(s.operationalServiceClass ?? 'unknown'))
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      county: s.county,
      class: s.operationalServiceClass ?? 'unknown',
      verificationStatus: resolveVerificationStatus(s.id, s.operational?.isNevadaMedicaidParticipating),
    }));
};

// ── Queue Summary ──

export interface QueueClassSummary {
  class: OperationalServiceClass;
  needs_verification: number;
  verified_participating: number;
  verified_non_participating: number;
  deferred: number;
  total: number;
}

export const getQueueSummary = (queue: TaggingQueueEntry[]): QueueClassSummary[] => {
  const classes: OperationalServiceClass[] = ['billable_clinical', 'behavioral_health_clinical', 'tribal_clinical'];
  const buckets = new Map<string, Record<VerificationStatus, number>>();
  for (const cls of classes) {
    buckets.set(cls, { needs_verification: 0, verified_participating: 0, verified_non_participating: 0, deferred: 0 });
  }

  for (const entry of queue) {
    const b = buckets.get(entry.class);
    if (b) b[entry.verificationStatus]++;
  }

  return classes.map((cls) => {
    const b = buckets.get(cls)!;
    return {
      class: cls,
      ...b,
      total: b.needs_verification + b.verified_participating + b.verified_non_participating + b.deferred,
    };
  }).filter((r) => r.total > 0);
};
