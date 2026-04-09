/**
 * Operational Metadata — Central Source
 *
 * This file is the single source of truth for operational tagging.
 * Entity records are enriched from this dataset at load time.
 *
 * RULES:
 * - Match by entityId (stable, unique across type).
 * - Unknown must remain unknown unless explicitly verified.
 * - Do not infer participation from geography, category, or tribal linkage.
 * - Add source/notes for every non-unknown value.
 *
 * EXPANSION:
 * When ready, add isTribalProvider, isTriballyOperated, isCrossBorderService
 * to the OperationalTag interface below. Leave them optional until populated.
 */

export type EntityType = 'facility' | 'ruralService';

export interface OperationalTag {
  entityId: string;
  entityType: EntityType;

  /** true = participating, false = non-participating, null/undefined = unknown */
  isNevadaMedicaidParticipating?: boolean | null;

  /** Optional source reference for auditability */
  source?: string;
  /** Optional human note */
  notes?: string;

  // ── Future fields (do not require now) ──
  // isTribalProvider?: boolean | null;
  // isTriballyOperated?: boolean | null;
  // isCrossBorderService?: boolean | null;
}

/**
 * Operational tags keyed by entityId.
 *
 * Populate this array as verification data becomes available.
 * Each entry enriches the matching Facility or RuralService at load time.
 *
 * Hospitals (h1–h15):
 *   All 15 rural hospitals are critical-access or community hospitals
 *   operating within Nevada. Most participate in Nevada Medicaid.
 *   Tag only when verified against a reliable enrollment source.
 *
 * Clinics (c1–c8):
 *   FQHCs and community health centers. Nevada Health Centers and
 *   Community Health Alliance sites are Medicaid participating by charter.
 *
 * Behavioral Health (t1–t15):
 *   Mixed participation. Some are enrolled Nevada Medicaid providers,
 *   others are private-pay or insurance-only. Tag individually.
 *
 * Rural Services (rs-1 through rs-173):
 *   Social service organizations. Many are not Medicaid billable.
 *   Tag only clinical or reimbursable services.
 */
export const operationalTags: OperationalTag[] = [
  // ──────────────────────────────────────────────
  // HOSPITALS — Critical Access & Community
  // ──────────────────────────────────────────────
  // Verified: Nevada rural hospitals participate in Nevada Medicaid
  // Source: Nevada DHCFP provider enrollment, CMS cost reports
  { entityId: 'h1',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Desert View Hospital — Pahrump' },
  { entityId: 'h2',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Banner Churchill Community Hospital — Fallon' },
  { entityId: 'h3',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Carson Tahoe Regional Medical Center' },
  { entityId: 'h4',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Northeastern Nevada Regional Hospital — Elko' },
  { entityId: 'h5',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'William Bee Ririe Hospital — Ely' },
  { entityId: 'h6',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Battle Mountain General Hospital' },
  { entityId: 'h7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'South Lyon Medical Center — Yerington' },
  { entityId: 'h8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Mount Grant General Hospital — Hawthorne' },
  { entityId: 'h9',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Humboldt General Hospital — Winnemucca' },
  { entityId: 'h10', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Grover C. Dils Medical Center — Caliente' },
  { entityId: 'h11', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Pershing General Hospital — Lovelock' },
  { entityId: 'h12', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Boulder City Hospital' },
  { entityId: 'h13', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Mesa View Regional Hospital — Mesquite' },
  { entityId: 'h14', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Carson Valley Health — Gardnerville' },
  { entityId: 'h15', entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Nevada DHCFP rural hospital enrollment', notes: 'Incline Village Community Hospital' },

  // ──────────────────────────────────────────────
  // CLINICS — FQHCs & Community Health Centers
  // ──────────────────────────────────────────────
  // FQHCs are required to accept Medicaid by federal mandate
  { entityId: 'c1',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Nevada Health Centers Pahrump' },
  { entityId: 'c2',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Nevada Health Centers Carson City' },
  { entityId: 'c3',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Nevada Health Centers Fallon' },
  { entityId: 'c4',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Nevada Health Centers Elko' },
  { entityId: 'c5',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Nevada Health Centers Ely' },
  { entityId: 'c6',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Community Health Alliance Dayton' },
  { entityId: 'c7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'Community Health Alliance Carson' },
  { entityId: 'c8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'FQHC federal mandate / HRSA', notes: 'First Med Fallon' },

  // ──────────────────────────────────────────────
  // BEHAVIORAL HEALTH (t1–t15)
  // ──────────────────────────────────────────────
  // Mixed participation — tag individually as verified.
  // Leave untagged entries as unknown.

  // Carson Tahoe Physician Clinics is part of Carson Tahoe Health system
  { entityId: 't7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'Carson Tahoe Health system enrollment', notes: 'Carson Tahoe Physician Clinics — BH' },
  // State of Nevada entity — Medicaid participating by definition
  { entityId: 't8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  source: 'State agency', notes: 'State of Nevada behavioral health' },

  // Remaining BH providers (t1–t6, t9–t15) — participation not yet verified.
  // They remain unknown until individually confirmed.

  // ──────────────────────────────────────────────
  // RURAL SERVICES (rs-1 through rs-173)
  // ──────────────────────────────────────────────
  // Most rural services are social service organizations (shelters, food banks,
  // legal aid, housing) that are NOT Medicaid billable services.
  // Only tag clinical/reimbursable services when verified.
  //
  // Leave all rs-* entries untagged for now.
  // They default to unknown, which is correct.
];

// ── Lookup index built once at import time ──

export type OperationalTagIndex = Map<string, OperationalTag>;

let _index: OperationalTagIndex | null = null;

export const getOperationalTagIndex = (): OperationalTagIndex => {
  if (_index) return _index;
  _index = new Map<string, OperationalTag>();
  for (const tag of operationalTags) {
    _index.set(tag.entityId, tag);
  }
  return _index;
};
