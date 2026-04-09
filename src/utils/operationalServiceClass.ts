/**
 * Operational Service Classification — provisional triage for rural services.
 *
 * Assigns an operationalServiceClass based on category and name heuristics.
 * This is provisional and overrideable per-entity in operational-metadata.ts.
 */

import type { RuralService, RuralServiceCategory, OperationalServiceClass } from '@/data/rural-services';

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

export interface ServiceClassAudit {
  billable_clinical: number;
  tribal_clinical: number;
  behavioral_health_clinical: number;
  supportive_nonbilling: number;
  unknown: number;
  total: number;
}

export const auditServiceClassification = (services: RuralService[]): ServiceClassAudit => {
  const counts: ServiceClassAudit = {
    billable_clinical: 0,
    tribal_clinical: 0,
    behavioral_health_clinical: 0,
    supportive_nonbilling: 0,
    unknown: 0,
    total: services.length,
  };

  for (const s of services) {
    const cls = s.operationalServiceClass ?? 'unknown';
    counts[cls]++;
  }

  return counts;
};
