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
  | 'inferred_limited'
  | 'unknown';

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

/**
 * No inherited payer enrollment or internal verification determinations ship
 * with the independent edition. Redistributable source evidence is pending.
 */
export const operationalTags: OperationalTag[] = [];

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
