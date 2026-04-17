export type EngagementGapView = 'priority' | 'boundaries';

export interface LayerState {
  counties: boolean;
  services: boolean;
  behavioralHealth: boolean;
  serviceLocations: boolean;
  operationalCoverage: boolean;
  fteCapacity: boolean;
  utilizationIntensity: boolean;
  engagementGap: boolean;
  broadbandAccess: boolean;
  cellularCoverage: boolean;
  tribalNations: boolean;
  /** Additive transport overlay — Amtrak California Zephyr rail corridor. Default OFF. */
  railCorridor: boolean;
  /** Additive access-support overlay — local public transit zones. Default OFF. */
  localTransitZones: boolean;
  // ── Demand & Utilization (additive, display-only). All default OFF. ──
  /** ZIP-level member demand visualization (choropleth or fallback list). */
  memberDemandZip: boolean;
  /** Append county-level utilization metrics block to county detail panel. */
  countyUtilization: boolean;
  /** Append per-county utilization reach block to provider/facility detail panel. */
  providerUtilizationReach: boolean;
  /** Append tribal utilization block to tribal/county detail panel (requires tribalNations on). */
  tribalUtilization: boolean;
}

export interface CoverageState {
  coverageRadius: boolean;
  coverageGaps: boolean;
  coverageRadiusKm: number;
  radiusKm: number;
}

/** Unified layer + coverage visibility */
export type FullLayerState = LayerState & CoverageState;
