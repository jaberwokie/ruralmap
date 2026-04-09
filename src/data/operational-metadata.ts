/**
 * Operational Metadata — Central Source
 *
 * Single source of truth for operational tagging.
 * Entity records are enriched from this dataset at load time.
 *
 * RULES:
 * - Match by entityId (stable, unique across type).
 * - Unknown must remain unknown unless explicitly verified.
 * - Do not infer participation from geography, category, or tribal linkage.
 * - Every non-unknown value requires verificationSource and verificationDate.
 *
 * EXPANSION:
 * When ready, uncomment isTribalProvider, isTriballyOperated, isCrossBorderService.
 */

export type EntityType = 'facility' | 'ruralService';

export type VerificationStatus =
  | 'needs_verification'
  | 'verified_participating'
  | 'verified_non_participating'
  | 'deferred';

export type DeferredReason =
  | 'duplicate_entity'
  | 'public_health_nonstandard'
  | 'not_a_direct_billing_site'
  | 'insufficient_source_match'
  | 'lower_priority_followup';

export type VerificationConfidence =
  | 'direct'
  | 'inferred_strong'
  | 'inferred_limited';

export interface OperationalTag {
  entityId: string;
  entityType: EntityType;

  /** true = participating, false = non-participating, null/undefined = unknown */
  isNevadaMedicaidParticipating?: boolean | null;

  /** Verification workflow state */
  verificationStatus?: VerificationStatus;

  /** Required when verificationStatus = 'deferred' */
  deferredReason?: DeferredReason;

  /** Required when verificationStatus = verified_participating or verified_non_participating */
  verificationConfidence?: VerificationConfidence;

  /** Source used to verify the participation value */
  verificationSource: string;
  /** Date of verification (YYYY-MM-DD or descriptive) */
  verificationDate: string;
  /** Optional human note (legacy alias for verificationNotes) */
  notes?: string;

  /** Structured verification notes — preferred over `notes` for new entries */
  verificationNotes?: string;

  // ── Provider identity fields (populate during verification, not before) ──

  /** NPI number — primary federal provider identifier */
  npi?: string;

  /** Legal name on enrollment record (may differ from display name) */
  organizationLegalName?: string;

  /** Address confirmed during verification (may differ from service listing) */
  serviceAddress?: string;

  /** State license or certification identifier */
  licenseIdentifier?: string;

  // ── Future fields (do not require now) ──
  // isTribalProvider?: boolean | null;
  // isTriballyOperated?: boolean | null;
  // isCrossBorderService?: boolean | null;
}

export const operationalTags: OperationalTag[] = [
  // ──────────────────────────────────────────────
  // HOSPITALS — Critical Access & Community (h1–h15)
  // ──────────────────────────────────────────────
  // Nevada rural hospitals participate in Nevada Medicaid.
  // Source: Nevada DHCFP provider enrollment, CMS cost reports.
  { entityId: 'h1',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Desert View Hospital — Pahrump' },
  { entityId: 'h2',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Banner Churchill Community Hospital — Fallon' },
  { entityId: 'h3',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Carson Tahoe Regional Medical Center' },
  { entityId: 'h4',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Northeastern Nevada Regional Hospital — Elko' },
  { entityId: 'h5',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'William Bee Ririe Hospital — Ely' },
  { entityId: 'h6',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Battle Mountain General Hospital' },
  { entityId: 'h7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'South Lyon Medical Center — Yerington' },
  { entityId: 'h8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Mount Grant General Hospital — Hawthorne' },
  { entityId: 'h9',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Humboldt General Hospital — Winnemucca' },
  { entityId: 'h10', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Grover C. Dils Medical Center — Caliente' },
  { entityId: 'h11', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Pershing General Hospital — Lovelock' },
  { entityId: 'h12', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Boulder City Hospital' },
  { entityId: 'h13', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Mesa View Regional Hospital — Mesquite' },
  { entityId: 'h14', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Carson Valley Health — Gardnerville' },
  { entityId: 'h15', entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Nevada DHCFP rural hospital enrollment', verificationDate: '2026-04', notes: 'Incline Village Community Hospital' },

  // ──────────────────────────────────────────────
  // CLINICS — FQHCs & Community Health Centers (c1–c8)
  // ──────────────────────────────────────────────
  // FQHCs are required to accept Medicaid by federal mandate.
  { entityId: 'c1',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Nevada Health Centers Pahrump' },
  { entityId: 'c2',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Nevada Health Centers Carson City' },
  { entityId: 'c3',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Nevada Health Centers Fallon' },
  { entityId: 'c4',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Nevada Health Centers Elko' },
  { entityId: 'c5',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Nevada Health Centers Ely' },
  { entityId: 'c6',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Community Health Alliance Dayton' },
  { entityId: 'c7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Community Health Alliance Carson' },
  { entityId: 'c8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'First Med Fallon' },

  // ──────────────────────────────────────────────
  // BEHAVIORAL HEALTH (t1–t15)
  // ──────────────────────────────────────────────
  // Mixed participation — tagged individually as verified.

  // t1 — Beautiful Mind of Las Vegas LLC: private practice, not confirmed in NV Medicaid
  { entityId: 't1',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Beautiful Mind of Las Vegas LLC — needs individual verification' },
  // t2 — Family Centers of Nevada LLC: community BH provider
  { entityId: 't2',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Family Centers of Nevada LLC — needs individual verification' },
  // t3 — Carson City Community Counseling Center: verified participating via NV DPBH directory
  { entityId: 't3',  entityType: 'facility', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Carson City Community Counseling Center — verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH Behavioral Health Provider Directory. Listing confirms accepts Medicaid Type 93 at matched service location.', organizationLegalName: 'Carson City Community Counseling Center', serviceAddress: '207 S Pratt St, Carson City, NV' },
  // t4 — Mindspace, LLC: private practice
  { entityId: 't4',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Mindspace, LLC — needs individual verification' },
  // t5 — Aspire Therapeutic Solutions LLC: private practice
  { entityId: 't5',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Aspire Therapeutic Solutions LLC — needs individual verification' },
  // t6 — Behavioral Health and Psychotherapy Services, LLC
  { entityId: 't6',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Behavioral Health and Psychotherapy Services, LLC — needs individual verification' },
  // t7 — Carson Tahoe Physician Clinics: part of Carson Tahoe Health system
  { entityId: 't7',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'Carson Tahoe Health system enrollment', verificationDate: '2026-04', notes: 'Carson Tahoe Physician Clinics — BH' },
  // t8 — State of Nevada: Medicaid participating by definition
  { entityId: 't8',  entityType: 'facility', isNevadaMedicaidParticipating: true,  verificationSource: 'State agency', verificationDate: '2026-04', notes: 'State of Nevada behavioral health' },
  // t9 — Always Reach Out Behavioral Health LLC
  { entityId: 't9',  entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Always Reach Out Behavioral Health LLC — needs individual verification' },
  // t10 — Janell Anderson, LCSW, PLLC: individual practitioner
  { entityId: 't10', entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Janell Anderson, LCSW, PLLC — needs individual verification' },
  // t11 — Battle Born Counseling Center: verified participating via NV DPBH directory
  { entityId: 't11', entityType: 'facility', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Battle Born Counseling Center — verified Medicaid Type 93 acceptance', verificationNotes: 'Listed on official NV DPBH BH provider directory as accepting Medicaid. Rated "Meets Above Standard". COD Capable – Adult endorsed. No org-level NPI found in NPPES; likely operates under individual provider NPI.', organizationLegalName: 'Battle Born Counseling, LLC', serviceAddress: '1802 N. Carson Street, Suite 103, Carson City, NV' },
  // t12 — Oasis in the Desert Counseling, LLC
  { entityId: 't12', entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Oasis in the Desert Counseling, LLC — needs individual verification' },
  // t13 — Dynamic Medical Group LLC
  { entityId: 't13', entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Dynamic Medical Group LLC — needs individual verification' },
  // t14 — Dr. Ronald Pak, PsyD LLC
  { entityId: 't14', entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Dr. Ronald Pak, PsyD LLC — needs individual verification' },
  // t15 — Serenity Counseling LLC
  { entityId: 't15', entityType: 'facility', isNevadaMedicaidParticipating: null,  verificationStatus: 'needs_verification', verificationSource: 'Not yet verified', verificationDate: '2026-04', notes: 'Serenity Counseling LLC — needs individual verification' },

  // ──────────────────────────────────────────────
  // RURAL SERVICES — billable_clinical (Physical Health)
  // ──────────────────────────────────────────────
  // Only billable_clinical services are actively tagged in this pass.
  // Non-clinical rural services remain untagged (unknown).

  // ── FQHC sites (federally required to accept Medicaid) ──
  { entityId: 'rs-78',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Elko Community Health Center — FQHC site' },
  { entityId: 'rs-79',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Wendover Community Health Center — FQHC site' },
  { entityId: 'rs-80',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Carlin Community Health Center — FQHC site' },
  { entityId: 'rs-81',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'FQHC federal mandate / HRSA', verificationDate: '2026-04', notes: 'Jackpot Community Health Center — FQHC site' },

  // ── Tribal health (IHS-funded) ──
  { entityId: 'rs-63',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'IHS/tribal health center enrollment', verificationDate: '2026-04', notes: 'Washoe Tribal Health Center — Gardnerville' },

  // ── Major health system (no site-level confirmation) ──
  { entityId: 'rs-144', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'Banner Health system Medicaid enrollment — system-level only', verificationDate: '2026-04', notes: 'Likely participating based on Banner Health system enrollment, but no site-specific Fernley confirmation found' },

  // ── Deferred: county public health nurses (not direct Medicaid billing entities) ──
  { entityId: 'rs-62',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'public_health_nonstandard', verificationSource: 'County public health — not a billing entity', verificationDate: '2026-04', notes: 'Douglas County Community Health Nurse' },
  { entityId: 'rs-114', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'public_health_nonstandard', verificationSource: 'County public health — not a billing entity', verificationDate: '2026-04', notes: 'Lander County Community Health Nurse' },
  { entityId: 'rs-142', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'public_health_nonstandard', verificationSource: 'County public health — not a billing entity', verificationDate: '2026-04', notes: 'Dayton Community Health Nurse' },
  { entityId: 'rs-156', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'public_health_nonstandard', verificationSource: 'County public health — not a billing entity', verificationDate: '2026-04', notes: 'Mineral County Health Nurse' },

  // ── Deferred: health districts (administrative, not billing) ──
  { entityId: 'rs-48',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'not_a_direct_billing_site', verificationSource: 'Public health district — administrative', verificationDate: '2026-04', notes: 'Central Nevada Health District — Fallon' },
  { entityId: 'rs-93',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'not_a_direct_billing_site', verificationSource: 'Public health district — administrative', verificationDate: '2026-04', notes: 'Central Nevada Health District Eureka' },

  // ── Deferred: support/resource orgs (not clinical billing) ──
  { entityId: 'rs-25',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'not_a_direct_billing_site', verificationSource: 'Resource/support org — not a billing provider', verificationDate: '2026-04', notes: 'Cancer Resource Center — Carson City' },

  // ── Deferred: duplicate with facility layer ──
  { entityId: 'rs-157', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'duplicate_entity', verificationSource: 'Duplicate — exists as facility h8', verificationDate: '2026-04', notes: 'Mt. Grant General Hospital — already tagged in facilities' },
  { entityId: 'rs-168', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'duplicate_entity', verificationSource: 'Duplicate — exists as facility h11', verificationDate: '2026-04', notes: 'Pershing General Hospital — already tagged in facilities' },

  // ── Needs verification: remaining billable_clinical ──
  // rs-26: Sierra Nevada Health Center — small independent clinic, no FQHC/system linkage found
  { entityId: 'rs-26',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No DHCFP or HRSA match found', verificationDate: '2026-04', notes: 'Sierra Nevada Health Center — Carson City; independent clinic, no enrollment confirmation available' },
  // rs-49: Fallon Family Wellness Center — independent practice, no system enrollment evidence
  { entityId: 'rs-49',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No DHCFP or HRSA match found', verificationDate: '2026-04', notes: 'Fallon Family Wellness Center — independent practice, no enrollment confirmation available' },
  // rs-92: Eureka County Medical Clinic — sole county clinic, likely county-operated
  { entityId: 'rs-92',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No direct enrollment confirmation', verificationDate: '2026-04', notes: 'Likely participating based on sole county clinic role, but no enrollment confirmation found' },
  // rs-105: Golden Valley Medical Center — Winnemucca; independent, no system match
  { entityId: 'rs-105', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No DHCFP or HRSA match found', verificationDate: '2026-04', notes: 'Golden Valley Medical Center — Winnemucca; independent clinic, no enrollment confirmation available' },
  // rs-115: Austin Medical Clinic — sole provider in remote Lander County community
  { entityId: 'rs-115', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No direct enrollment confirmation', verificationDate: '2026-04', notes: 'Likely participating based on sole provider role in isolated Austin community, but no enrollment confirmation found' },
  // rs-124: Lincoln County Medical Associates — Caliente
  { entityId: 'rs-124', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No direct enrollment confirmation', verificationDate: '2026-04', notes: 'Likely participating based on sole provider group role in Lincoln County, but no enrollment confirmation found' },
  // rs-125: Lincoln County Medical Associates — Alamo (same practice as rs-124, second site)
  { entityId: 'rs-125', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'deferred', deferredReason: 'insufficient_source_match', verificationSource: 'No direct enrollment confirmation', verificationDate: '2026-04', notes: 'Likely participating based on satellite of Lincoln County practice, but no enrollment confirmation found' },

  // ──────────────────────────────────────────────
  // RURAL SERVICES — behavioral_health_clinical (Mental Health / Substance Use)
  // ──────────────────────────────────────────────

  // ── DPBH-Rural Clinics (state-operated, Medicaid participating by definition) ──
  { entityId: 'rs-31',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Carson City' },
  { entityId: 'rs-52',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Fallon' },
  { entityId: 'rs-65',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Douglas' },
  { entityId: 'rs-85',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Elko' },
  { entityId: 'rs-108', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Winnemucca' },
  { entityId: 'rs-116', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Battle Mountain' },
  { entityId: 'rs-127', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Panaca' },
  { entityId: 'rs-147', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Dayton' },
  { entityId: 'rs-148', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Fernley' },
  { entityId: 'rs-149', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Yerington' },
  { entityId: 'rs-180', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'DPBH state agency — operates as Medicaid provider', verificationDate: '2026-04', notes: 'DPBH-Rural Clinics: Ely' },

  // ── Hospital-affiliated BH (verified via parent facility enrollment) ──
  { entityId: 'rs-64',  entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Carson Valley Health system enrollment (facility h14)', verificationDate: '2026-04', notes: 'Carson Valley Health Outpatient BH Clinic — hospital-operated outpatient program' },
  { entityId: 'rs-164', entityType: 'ruralService', isNevadaMedicaidParticipating: true,  verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Desert View Hospital system enrollment (facility h1)', verificationDate: '2026-04', notes: 'Desert View Hospital BH Services — hospital-operated BH program' },

  // ── Needs verification: independent/private BH providers ──
  { entityId: 'rs-27',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Battle Born Counseling Center — verified Medicaid participating', verificationNotes: 'Same entity as facility t11 (Battle Born Counseling, LLC). Confirmed Medicaid Type 93 acceptance via NV DPBH directory. Address matches facility record.', organizationLegalName: 'Battle Born Counseling, LLC', serviceAddress: '1802 N. Carson Street, Suite 103, Carson City, NV' },
  { entityId: 'rs-28',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Vitality Carson City (Residential) — verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Separate listing exists for Vitality Unlimited at 900 E. Long St., Carson City (Level 3.1 Clinically Managed Residential). Entity address matches directory listing exactly.', organizationLegalName: 'Vitality Unlimited', serviceAddress: '900 E. Long St. 2nd Floor, Carson City, NV' },
  { entityId: 'rs-29',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Community Counseling Center — Carson City, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Directory lists Carson City Community Counseling Center at 205 S. Pratt St., Carson City as accepting Medicaid Type 93. Address matches entity record exactly.', organizationLegalName: 'Carson City Community Counseling Center', serviceAddress: '205 S. Pratt St., Carson City, NV' },
  { entityId: 'rs-30',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'The Life Change Center — Carson City, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Listed as "The Life Change Center – Carson City" at 1201 N. Stewart St., Ste. 120. Accepts Medicaid Type 93. Opioid Treatment Services, Level 1-WM Ambulatory Withdrawal Management.', organizationLegalName: 'The Life Change Center', serviceAddress: '1201 N. Stewart St., Ste. 120, Carson City, NV' },
  { entityId: 'rs-32',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Connections Behavioral Health Center — Carson City, MH provider', verificationNotes: 'Searched Nevada DPBH BH Provider Directory on 2026-04-09. No listing found for this entity name or address.' },
  { entityId: 'rs-33',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Serenity Mental Health — Carson City, MH provider', verificationNotes: 'Searched Nevada DPBH BH Provider Directory on 2026-04-09. No listing found for this entity name or address.' },
  { entityId: 'rs-50',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'New Frontier Treatment Center — Fallon, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Listed as "New Frontier – Fallon (1490 Grimes St.)" at 1490 Grimes St., Fallon. Accepts Medicaid Type 93. Outpatient + Level 3.1 Residential.', organizationLegalName: 'New Frontier', serviceAddress: '1490 Grimes St., Fallon, NV' },
  { entityId: 'rs-51',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Fallon Family Wellness Center (MH) — Fallon, MH provider' },
  { entityId: 'rs-66',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Community Counseling Center Douglas — Gardnerville, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Directory lists Carson City Community Counseling Center – Gardnerville at 1482 US Hwy 395 S., Gardnerville as accepting Medicaid Type 93. Address matches entity record exactly.', organizationLegalName: 'Carson City Community Counseling Center', serviceAddress: '1482 US Hwy 395 S., Gardnerville, NV' },
  { entityId: 'rs-82',  entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Ruby Mountain Recovery — Elko, SU provider' },
  { entityId: 'rs-83',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Vitality Unlimited - Vitality Center — Elko, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Listed as "Vitality Unlimited – Elko (3740 Idaho St.)" at 3740 Idaho St., Elko. Accepts Medicaid Type 93. Level 3.5 Residential (Adolescent), Level 2.1 IOP + Level 3.1 Residential (Adult).', organizationLegalName: 'Vitality Unlimited', serviceAddress: '3740 Idaho St., Elko, NV' },
  { entityId: 'rs-84',  entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Vitality Integrated Programs (VIP) — Elko, verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH BH Provider Directory. Listed as "Vitality Unlimited – Elko (215 Bluffs Ave.)" at 215 Bluffs Ave., Ste. 200, Elko. Accepts Medicaid Type 93. Level 1 Outpatient + Level 1-WM Withdrawal Management.', organizationLegalName: 'Vitality Unlimited', serviceAddress: '215 Bluffs Ave., Ste. 200, Elko, NV' },
  { entityId: 'rs-106', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Silver Sage Counseling Services — Winnemucca, SU provider' },
  { entityId: 'rs-107', entityType: 'ruralService', isNevadaMedicaidParticipating: null, verificationStatus: 'needs_verification', verificationSource: 'No site-level confirmation', verificationDate: '2026-04', notes: 'Winnemucca Mental Health Center — Winnemucca, MH provider' },
  { entityId: 'rs-145', entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Rural Nevada Counseling - Dayton — verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH Behavioral Health Provider Directory. Listing confirms accepts Medicaid Type 93 at matched service location.', organizationLegalName: 'Rural Nevada Counseling', serviceAddress: '801 Overland Loop Ste 201, Dayton, NV' },
  { entityId: 'rs-146', entityType: 'ruralService', isNevadaMedicaidParticipating: true, verificationStatus: 'verified_participating', verificationConfidence: 'direct', verificationSource: 'Nevada DPBH Behavioral Health Provider Directory (behavioralhealthnv.org)', verificationDate: '2026-04-09', notes: 'Rural Nevada Counseling - Yerington — verified Medicaid participating', verificationNotes: 'Verified on 2026-04-09 via Nevada DPBH Behavioral Health Provider Directory. Listing confirms accepts Medicaid Type 93 at matched service location.', organizationLegalName: 'Rural Nevada Counseling', serviceAddress: '720 S Main St Ste C, Yerington, NV' },
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
