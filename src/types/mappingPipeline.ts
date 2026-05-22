/**
 * Shared types for the Service + Behavioral Health mapping pipelines.
 * Mirrors the Cloud tables: staging_services / verified_services /
 * staging_bh / verified_bh / mapping_audit_log.
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ValidationSeverity = 'valid' | 'warning' | 'error';
export type VerificationStatus = 'unverified' | 'needs_verification' | 'verified';

export interface ValidationMessage {
  field?: string;
  severity: ValidationSeverity;
  message: string;
}

export interface StagingServiceRow {
  id: string;
  name: string;
  service_category: string | null;
  service_subcategory: string | null;
  organization_name: string | null;
  description: string | null;
  target_population: string | null;
  eligibility_notes: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  referral_required: boolean | null;
  walk_in_allowed: boolean | null;
  appointment_required: boolean | null;
  hours_of_operation: string | null;
  languages_supported: string | null;
  active_status: boolean;
  access_notes: string | null;
  transportation_notes: string | null;
  medicaid_relevance: string | null;
  verification_status: VerificationStatus;
  verification_confidence: string | null;
  verification_source: string | null;
  verification_date: string | null;
  last_reviewed_at: string | null;
  review_status: ReviewStatus;
  validation_severity: ValidationSeverity | null;
  validation_messages: ValidationMessage[];
  source_file_name: string | null;
  source_row_number: number | null;
  import_batch_id: string | null;
  // Structured Import additions
  service_tags: string | null;
  resource_class: string;
  mappable: boolean;
  match_conflict: boolean;
  // Controlled category (additive). category_raw preserves the original
  // CSV value for audit; category_mapped must be one of the controlled
  // SERVICE_CATEGORIES values before a row may be promoted.
  category_raw: string | null;
  category_mapped: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerifiedServiceRow extends Omit<StagingServiceRow, 'review_status' | 'validation_severity' | 'validation_messages' | 'match_conflict'> {
  staging_id: string | null;
  promoted_at: string;
  promoted_by: string | null;
}

export interface StagingBhRow {
  id: string;
  name: string;
  bh_entity_type: string | null;
  bh_service_type: string | null;
  organization_name: string | null;
  facility_type: string | null;
  description: string | null;
  npi: string | null;
  license_type: string | null;
  specialties: string | null;
  age_groups_served: string | null;
  populations_served: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  fax: string | null;
  referral_required: boolean | null;
  walk_in_allowed: boolean | null;
  appointment_required: boolean | null;
  accepts_new_patients: boolean | null;
  telehealth_available: boolean | null;
  hours_of_operation: string | null;
  languages_supported: string | null;
  medicaid_participation_status: string | null;
  payer_notes: string | null;
  crisis_capable: boolean | null;
  detox_capable: boolean | null;
  residential_capable: boolean | null;
  outpatient_capable: boolean | null;
  mat_capable: boolean | null;
  active_status: boolean;
  access_notes: string | null;
  verification_status: VerificationStatus;
  verification_confidence: string | null;
  verification_source: string | null;
  verification_date: string | null;
  last_reviewed_at: string | null;
  review_status: ReviewStatus;
  validation_severity: ValidationSeverity | null;
  validation_messages: ValidationMessage[];
  source_file_name: string | null;
  source_row_number: number | null;
  import_batch_id: string | null;
  // Controlled BH category (additive). category_raw preserves the original
  // CSV value for audit; category_mapped must be one of the controlled
  // BH_CATEGORIES values before a row may be promoted.
  category_raw: string | null;
  category_mapped: string | null;
  // Optional BH access tags (telehealth, fqhc, rural_health_clinic,
  // critical_access_hospital). Comma-separated, normalized via
  // utils/bhAccessTags. Additive — does not affect category gating.
  service_tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerifiedBhRow extends Omit<StagingBhRow, 'review_status' | 'validation_severity' | 'validation_messages'> {
  staging_id: string | null;
  promoted_at: string;
  promoted_by: string | null;
}

export type AuditAction =
  | 'upload_started'
  | 'upload_completed'
  | 'validation_completed'
  | 'header_resolution'
  | 'record_promoted'
  | 'record_rejected'
  | 'record_edited'
  | 'verification_changed'
  | 'provider_created'
  | 'provider_updated'
  | 'provider_skipped_conflict';

export type PipelineKey = 'services' | 'behavioral_health' | 'provider_mapping' | 'facilities' | 'rural_services';

export interface StagingProviderRow {
  id: string;
  name: string;
  type: string | null;
  provider_name: string | null;
  npi: string | null;
  organization_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  access_notes: string | null;
  review_status: ReviewStatus;
  validation_severity: ValidationSeverity | null;
  validation_messages: ValidationMessage[];
  active_status: boolean;
  source_file_name: string | null;
  source_row_number: number | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  pipeline: string;
  action: string;
  target_table: string | null;
  target_row_id: string | null;
  import_batch_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
