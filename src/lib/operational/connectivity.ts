/**
 * Connectivity (broadband + cellular) — stable re-export surface.
 * Logic remains in src/utils/broadbandFeasibility.ts and cellularFeasibility.ts.
 */
export {
  getCountyRemoteFeasibility,
  getBroadbandOperationalNote,
  getRemoteFeasibility,
  FEASIBILITY_COLORS,
  FEASIBILITY_SHORT_LABELS,
  READINESS_COLORS,
} from '@/utils/broadbandFeasibility';
export type { RemoteFeasibility } from '@/utils/broadbandFeasibility';

export {
  getCountyMobileFeasibility,
  getMobileFeasibility,
  getCellularOperationalNote,
  getOperationalConnectivityProfile,
  RELIABILITY_COLORS,
  RELIABILITY_SHORT_LABELS,
} from '@/utils/cellularFeasibility';
export type {
  MobileFeasibility,
  OperationalConnectivityProfile,
} from '@/utils/cellularFeasibility';
