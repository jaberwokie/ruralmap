/**
 * Phase 2D.1 — ONE eligibility + protection contract for public-resource
 * geocoding. Both `geocode-bulk` (multi-record) and `geocode-address`
 * (single-record) call this, so the two paths cannot drift apart again.
 *
 * Manual / locked coordinate authority outranks cache, Census and `force`.
 */
import {
  isRecordCoordinateProtected,
  type ResourceTableContract,
} from './resourceTableContracts.ts';

export type EligibilityReason =
  | 'soft_deleted'
  | 'list_only_not_mappable'
  | 'inactive_record'
  | 'protected_manual_or_locked_coordinate'
  | 'no_street_address'
  | 'already_has_coordinates';

export interface EligibilityResult {
  eligible: boolean;
  reason?: EligibilityReason;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Which records a resource geocode run is allowed to touch, and why not.
 *
 * `force` may re-resolve a record that already has coordinates. It may NEVER
 * bypass soft-delete, inactive, non-mappable or manual/locked protection.
 */
export const evaluateResourceEligibility = (
  record: Record<string, unknown>,
  contract: ResourceTableContract,
  opts: { force?: boolean; allowExistingCoordinates?: boolean } = {},
): EligibilityResult => {
  if (contract.hasSoftDelete && record.deleted_at) {
    return { eligible: false, reason: 'soft_deleted' };
  }
  if (contract.hasMappable && record.mappable === false) {
    return { eligible: false, reason: 'list_only_not_mappable' };
  }
  if (contract.hasActiveStatus && record.active_status === false) {
    return { eligible: false, reason: 'inactive_record' };
  }
  if (isRecordCoordinateProtected(record, contract)) {
    return { eligible: false, reason: 'protected_manual_or_locked_coordinate' };
  }
  if (!record.street_address) {
    return { eligible: false, reason: 'no_street_address' };
  }
  if (!opts.force && !opts.allowExistingCoordinates) {
    const lat = record[contract.latColumn];
    const lng = record[contract.lngColumn];
    if (finite(lat) && finite(lng)) {
      return { eligible: false, reason: 'already_has_coordinates' };
    }
  }
  return { eligible: true };
};
