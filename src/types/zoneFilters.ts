/**
 * Zone overlay visibility filters.
 *
 * Additive, ephemeral UI state that controls which zone categories render.
 * Does NOT affect: pin counts, cluster counts, Access Gap calculations,
 * Response Capability classification, FTE hub data, provider/BH/service logic.
 *
 * Reset on page reload by design (not persisted).
 */

import type { ResponseCapabilityCategory } from '@/components/map/responseCapabilityVisuals';

export interface ZoneFilters {
  /** Which Response Capability marker categories are visible. Default: all on. */
  responseCapability: Record<ResponseCapabilityCategory, boolean>;
}

export const DEFAULT_ZONE_FILTERS: ZoneFilters = {
  responseCapability: {
    active: true,
    scheduled: true,
    remote: true,
  },
};
