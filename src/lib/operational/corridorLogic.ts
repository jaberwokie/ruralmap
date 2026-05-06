/**
 * Corridor / drive burden classification — stable re-export surface.
 * All geometry and thresholds remain in their existing modules.
 */
export {
  hasViableScheduledCorridor,
  distanceMi,
  MAX_SCHEDULED_DISTANCE_MI,
  MIN_SCHEDULED_AREA_PERCENT,
  MIN_COMBINED_AREA_PERCENT,
} from '@/utils/scheduledCorridorViability';

export { checkHighwayAccess } from '@/utils/highwayProximity';
