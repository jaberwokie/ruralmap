/**
 * Member access — pure distance + tier helpers shared across components.
 *
 * Extracted as-is from MapView and CoverageDetailPanel inline duplicates.
 * Thresholds and labels are identical to the previous embedded logic.
 */
import {
  MEMBER_TIER_LOCAL_MAX_MI,
  MEMBER_TIER_MANAGED_MAX_MI,
  MEMBER_TIER_HIGH_FRICTION_MAX_MI,
} from './constants';

const KM_PER_MI = 0.621371;

/** Haversine distance in km. */
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const kmToMi = (km: number): number => km * KM_PER_MI;

/** Member tier label — inclusive upper bounds (10 / 25 / 40 mi). */
export const getMemberTierLabel = (mi: number): string =>
  mi <= MEMBER_TIER_LOCAL_MAX_MI ? 'Local Access'
    : mi <= MEMBER_TIER_MANAGED_MAX_MI ? 'Managed Access'
    : mi <= MEMBER_TIER_HIGH_FRICTION_MAX_MI ? 'High Friction'
    : 'Non-Viable';

export interface MemberDistanceInfo {
  memberDistanceMi: number;
  memberTierLabel: string;
}

/**
 * Compute miles + tier from a member point to a target point.
 * Distance is rounded to 1 decimal — same as previous inline behavior.
 */
export const computeMemberDistanceInfo = (
  memberLat: number,
  memberLng: number,
  targetLat: number,
  targetLng: number,
): MemberDistanceInfo => {
  const km = haversineKm(memberLat, memberLng, targetLat, targetLng);
  const mi = kmToMi(km);
  return {
    memberDistanceMi: Math.round(mi * 10) / 10,
    memberTierLabel: getMemberTierLabel(mi),
  };
};
