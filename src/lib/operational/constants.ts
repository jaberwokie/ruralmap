/**
 * Operational constants — single import surface for shared thresholds.
 * Behavior-parity re-exports only. Do not redefine values here.
 */
export {
  ACTIVE_COVERAGE_RADIUS_KM,
  COVERAGE_TYPE_LABELS,
  COVERAGE_TYPE_DESCRIPTIONS,
  PRIMARY_RESPONSE_LABELS,
} from '@/data/operational-coverage';

export {
  MAX_SCHEDULED_DISTANCE_MI,
  MIN_SCHEDULED_AREA_PERCENT,
  MIN_COMBINED_AREA_PERCENT,
} from '@/utils/scheduledCorridorViability';

/** Member access tier upper bounds (miles, inclusive). */
export const MEMBER_TIER_LOCAL_MAX_MI = 10;
export const MEMBER_TIER_MANAGED_MAX_MI = 25;
export const MEMBER_TIER_HIGH_FRICTION_MAX_MI = 40;

/** Access gap heuristic: km radius from county center to nearest hospital/clinic. */
export const ACCESS_GAP_RADIUS_KM = 50;
