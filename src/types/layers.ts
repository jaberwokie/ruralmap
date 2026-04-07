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
}

export interface CoverageState {
  coverageRadius: boolean;
  coverageGaps: boolean;
  coverageRadiusKm: number;
  radiusKm: number;
}

/** Unified layer + coverage visibility */
export type FullLayerState = LayerState & CoverageState;
