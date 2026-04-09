/**
 * Central layer registry — single source of truth for all map layers and layer-like toggles.
 */

import type { LayerState, FullLayerState } from '@/types/layers';

export type LayerGroup = 'coreMap' | 'operations' | 'utilization' | 'access' | 'connectivity';

export interface LayerDefinition {
  id: string;
  label: string;
  group: LayerGroup;
  defaultVisible: boolean;
  /** Leaflet layer IDs for toggle diagnostics */
  diagnosticLayerIds?: string[];
  /** Other layer IDs this layer depends on */
  dependencies?: string[];
  /** Key for availability conditions (e.g., 'broadbandReady') */
  availabilityConditionKey?: string;
}

export const LAYER_REGISTRY: LayerDefinition[] = [
  // ── Core Map ──
  {
    id: 'counties',
    label: 'County Boundaries',
    group: 'coreMap',
    defaultVisible: true,
    diagnosticLayerIds: ['county-hit-areas', 'county-borders', 'county-labels'],
  },
  {
    id: 'tribalNations',
    label: 'Tribal Nations',
    group: 'coreMap',
    defaultVisible: true,
    diagnosticLayerIds: ['tribal-nation-polygons'],
  },
  {
    id: 'services',
    label: 'Services',
    group: 'coreMap',
    defaultVisible: true,
    diagnosticLayerIds: ['service-presence-halos', 'service-presence-markers'],
  },
  {
    id: 'behavioralHealth',
    label: 'Behavioral Health',
    group: 'coreMap',
    defaultVisible: true,
    diagnosticLayerIds: ['behavioral-health-halos', 'behavioral-health-markers'],
  },
  {
    id: 'serviceLocations',
    label: 'Provider Locations',
    group: 'coreMap',
    defaultVisible: true,
    diagnosticLayerIds: ['facility-markers'],
  },

  // ── Operations ──
  {
    id: 'operationalCoverage',
    label: 'Response Capability',
    group: 'operations',
    defaultVisible: false,
  },
  {
    id: 'fteCapacity',
    label: 'Staffing Capacity & Load',
    group: 'operations',
    defaultVisible: false,
  },
  {
    id: 'engagementGap',
    label: 'Engagement Gap',
    group: 'operations',
    defaultVisible: false,
  },

  // ── Utilization ──
  {
    id: 'utilizationIntensity',
    label: 'Service Utilization Intensity',
    group: 'utilization',
    defaultVisible: false,
  },

  // ── Access ──
  {
    id: 'coverageRadius',
    label: 'Provider Coverage Radius',
    group: 'access',
    defaultVisible: false,
    diagnosticLayerIds: ['drive-radius-overlay'],
  },
  {
    id: 'coverageGaps',
    label: 'Access Gaps (Outside Coverage Radius)',
    group: 'access',
    defaultVisible: false,
    diagnosticLayerIds: ['coverage-gap-overlay'],
    dependencies: ['coverageRadius'],
  },

  // ── Connectivity ──
  {
    id: 'broadbandAccess',
    label: 'Broadband Access',
    group: 'connectivity',
    defaultVisible: false,
    availabilityConditionKey: 'broadbandReady',
  },
  {
    id: 'cellularCoverage',
    label: 'Cellular Coverage',
    group: 'connectivity',
    defaultVisible: false,
  },
];

export const LAYER_BY_ID = new Map(LAYER_REGISTRY.map((l) => [l.id, l]));

export const buildDefaultLayerState = (): LayerState => {
  const state: Record<string, boolean> = {};
  for (const def of LAYER_REGISTRY) {
    if (def.id in defaultLayerKeys) {
      state[def.id] = def.defaultVisible;
    }
  }
  return state as unknown as LayerState;
};

// The keys that belong in LayerState (not coverage toggles)
const defaultLayerKeys: Record<string, true> = {
  counties: true,
  tribalNations: true,
  services: true,
  behavioralHealth: true,
  serviceLocations: true,
  operationalCoverage: true,
  fteCapacity: true,
  utilizationIntensity: true,
  engagementGap: true,
  broadbandAccess: true,
  cellularCoverage: true,
};

/** Diagnostic config for toggle logging */
export const getToggleDiagnosticConfig = (layerId: string) => {
  const def = LAYER_BY_ID.get(layerId);
  if (!def || !def.diagnosticLayerIds) return null;
  return {
    toggleName: def.label,
    layerIds: def.diagnosticLayerIds,
  };
};
