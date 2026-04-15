/**
 * Service-line verification types for psychiatric (provider) and inpatient (hospital) services.
 * These are independent from organization-level verification.
 */

// ── Shared verification status ──
export type ServiceLineVerificationStatus =
  | 'directly_verified'
  | 'verified_via_directory'
  | 'reported_unverified'
  | 'not_offered'
  | 'unable_to_confirm';

export type YesNoUnknown = 'yes' | 'no' | 'unknown';
export type MedicaidStatus = 'participating' | 'non_participating' | 'unknown';

// ── Psychiatric (provider entities) ──

export type PsychiatricPopulationFocus = 'adult' | 'youth' | 'both' | 'unknown';

export interface PsychiatricServiceFields {
  psychiatric_services_offered: boolean | null;
  psychiatric_service_types: string[];
  psychiatric_verification_status: ServiceLineVerificationStatus | null;
  psychiatric_verification_source: string | null;
  psychiatric_verification_date: string | null;
  psychiatric_accepting_new_patients: YesNoUnknown | null;
  psychiatric_medicaid_status: MedicaidStatus | null;
  psychiatric_referral_required: YesNoUnknown | null;
  psychiatric_wait_time_days: number | null;
  psychiatric_population_focus: PsychiatricPopulationFocus | null;
  psychiatric_access_notes: string | null;
  psychiatric_telepsychiatry_available: YesNoUnknown | null;
}

// ── Inpatient (hospital entities) ──

export type InpatientAdmissionStatus = 'yes' | 'no' | 'limited' | 'unknown';
export type InpatientReferralPathway = 'direct_admit_allowed' | 'ED_required' | 'transfer_only' | 'unknown';
export type InpatientBedAvailabilityModel = 'real_time_known' | 'daily_call_required' | 'unknown';
export type InpatientPopulationFocus = 'adult' | 'youth' | 'both' | 'specialized' | 'unknown';

export interface InpatientServiceFields {
  inpatient_services_offered: boolean | null;
  inpatient_service_types: string[];
  inpatient_verification_status: ServiceLineVerificationStatus | null;
  inpatient_verification_source: string | null;
  inpatient_verification_date: string | null;
  inpatient_accepting_admissions: InpatientAdmissionStatus | null;
  inpatient_medicaid_status: MedicaidStatus | null;
  inpatient_referral_pathway: InpatientReferralPathway | null;
  inpatient_bed_availability_model: InpatientBedAvailabilityModel | null;
  inpatient_capacity_notes: string | null;
  inpatient_population_focus: InpatientPopulationFocus | null;
  inpatient_access_notes: string | null;
}

// ── Badge interpretation ──

export type PsychiatryBadgeState = 'Verified Psychiatry' | 'Unverified Psychiatry' | 'No Psychiatry' | 'Psychiatry Unknown';
export type InpatientBadgeState = 'Inpatient Verified' | 'Inpatient Unverified' | 'No Inpatient' | 'Inpatient Unknown';

export const resolvePsychiatryBadge = (fields?: Partial<PsychiatricServiceFields> | null): PsychiatryBadgeState => {
  if (!fields) return 'Psychiatry Unknown';

  const { psychiatric_services_offered, psychiatric_verification_status } = fields;

  if (psychiatric_verification_status === 'not_offered' || psychiatric_services_offered === false) {
    return 'No Psychiatry';
  }
  if (psychiatric_verification_status === 'directly_verified' || psychiatric_verification_status === 'verified_via_directory') {
    return 'Verified Psychiatry';
  }
  if (psychiatric_services_offered === true && (psychiatric_verification_status === 'reported_unverified' || psychiatric_verification_status === 'unable_to_confirm')) {
    return 'Unverified Psychiatry';
  }
  return 'Psychiatry Unknown';
};

export const resolveInpatientBadge = (fields?: Partial<InpatientServiceFields> | null): InpatientBadgeState => {
  if (!fields) return 'Inpatient Unknown';

  const { inpatient_services_offered, inpatient_verification_status } = fields;

  if (inpatient_verification_status === 'not_offered' || inpatient_services_offered === false) {
    return 'No Inpatient';
  }
  if (inpatient_verification_status === 'directly_verified' || inpatient_verification_status === 'verified_via_directory') {
    return 'Inpatient Verified';
  }
  if (inpatient_services_offered === true && (inpatient_verification_status === 'reported_unverified' || inpatient_verification_status === 'unable_to_confirm')) {
    return 'Inpatient Unverified';
  }
  return 'Inpatient Unknown';
};

export const PSYCHIATRY_BADGE_COLORS: Record<PsychiatryBadgeState, { text: string; bg: string; dot: string }> = {
  'Verified Psychiatry': { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  'Unverified Psychiatry': { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  'No Psychiatry': { text: 'text-muted-foreground', bg: 'bg-secondary border-border', dot: 'bg-muted-foreground' },
  'Psychiatry Unknown': { text: 'text-muted-foreground', bg: 'bg-secondary border-border', dot: 'bg-muted-foreground/50' },
};

export const INPATIENT_BADGE_COLORS: Record<InpatientBadgeState, { text: string; bg: string; dot: string }> = {
  'Inpatient Verified': { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  'Inpatient Unverified': { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  'No Inpatient': { text: 'text-muted-foreground', bg: 'bg-secondary border-border', dot: 'bg-muted-foreground' },
  'Inpatient Unknown': { text: 'text-muted-foreground', bg: 'bg-secondary border-border', dot: 'bg-muted-foreground/50' },
};

// ── Field label maps ──

export const REFERRAL_PATHWAY_LABELS: Record<InpatientReferralPathway, string> = {
  direct_admit_allowed: 'Direct Admit Allowed',
  ED_required: 'ED Required',
  transfer_only: 'Transfer Only',
  unknown: 'Unknown',
};

export const BED_AVAILABILITY_LABELS: Record<InpatientBedAvailabilityModel, string> = {
  real_time_known: 'Real-Time Known',
  daily_call_required: 'Daily Call Required',
  unknown: 'Unknown',
};

// ── Helpers for checking if any service-line data exists ──

export const hasPsychiatricData = (fields?: Partial<PsychiatricServiceFields> | null): boolean => {
  if (!fields) return false;
  return (
    fields.psychiatric_services_offered != null ||
    fields.psychiatric_verification_status != null ||
    (fields.psychiatric_service_types?.length ?? 0) > 0
  );
};

export const hasInpatientData = (fields?: Partial<InpatientServiceFields> | null): boolean => {
  if (!fields) return false;
  return (
    fields.inpatient_services_offered != null ||
    fields.inpatient_verification_status != null ||
    (fields.inpatient_service_types?.length ?? 0) > 0
  );
};

// ── Filter predicates ──

const VERIFIED_STATUSES: ServiceLineVerificationStatus[] = ['directly_verified', 'verified_via_directory'];
const ACTIVE_STATUSES: ServiceLineVerificationStatus[] = ['directly_verified', 'verified_via_directory', 'reported_unverified', 'unable_to_confirm'];

export const matchesPsychiatryFilter = (f?: Partial<PsychiatricServiceFields> | null): boolean =>
  f?.psychiatric_services_offered === true || (f?.psychiatric_verification_status != null && ACTIVE_STATUSES.includes(f.psychiatric_verification_status));

export const matchesVerifiedPsychiatry = (f?: Partial<PsychiatricServiceFields> | null): boolean =>
  f?.psychiatric_verification_status != null && VERIFIED_STATUSES.includes(f.psychiatric_verification_status);

export const matchesAcceptingPsych = (f?: Partial<PsychiatricServiceFields> | null): boolean =>
  f?.psychiatric_accepting_new_patients === 'yes';

export const matchesTelepsychiatry = (f?: Partial<PsychiatricServiceFields> | null): boolean =>
  f?.psychiatric_telepsychiatry_available === 'yes' || (f?.psychiatric_service_types?.some(t => t.toLowerCase().includes('telepsychiatry')) ?? false);

export const matchesInpatientFilter = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_services_offered === true || (f?.inpatient_verification_status != null && ACTIVE_STATUSES.includes(f.inpatient_verification_status));

export const matchesVerifiedInpatient = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_verification_status != null && VERIFIED_STATUSES.includes(f.inpatient_verification_status);

export const matchesPsychiatricInpatient = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_service_types?.some(t => t.toLowerCase().includes('psychiatric inpatient')) ?? false;

export const matchesDetoxInpatient = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_service_types?.some(t => t.toLowerCase().includes('detox') || t.toLowerCase().includes('withdrawal')) ?? false;

export const matchesAcceptingAdmissions = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_accepting_admissions === 'yes' || f?.inpatient_accepting_admissions === 'limited';

export const matchesMedicaidInpatient = (f?: Partial<InpatientServiceFields> | null): boolean =>
  f?.inpatient_medicaid_status === 'participating';

// ── County summary metric calculators ──

export interface PsychiatricCountySummary {
  totalOffering: number;
  verified: number;
  verifiedMedicaid: number;
  needsVerification: number;
}

export interface InpatientCountySummary {
  totalInpatient: number;
  verified: number;
  verifiedPsychiatric: number;
  medicaidParticipating: number;
  needsVerification: number;
  referralPathway: { directAdmit: number; edRequired: number; transferOnly: number };
}
