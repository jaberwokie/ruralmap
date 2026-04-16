import { useState, useCallback, useMemo } from 'react';
import type { LayerState, CoverageState, EngagementGapView } from '@/types/layers';
import { getToggleDiagnosticConfig } from '@/data/layer-registry';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';

const DEFAULT_LAYERS: LayerState = {
  counties: true,
  services: true,
  behavioralHealth: true,
  serviceLocations: true,
  operationalCoverage: false,
  fteCapacity: false,
  utilizationIntensity: false,
  engagementGap: false,
  broadbandAccess: false,
  cellularCoverage: false,
  tribalNations: true,
  railCorridor: false,
  localTransitZones: false,
};

const DEFAULT_COVERAGE: CoverageState = {
  coverageRadius: false,
  coverageGaps: false,
  coverageRadiusKm: ACTIVE_COVERAGE_RADIUS_KM,
  radiusKm: 32,
};

const logToggleDiagnostic = (stateKey: string, visible: boolean) => {
  if (!import.meta.env.DEV) return;
  const config = getToggleDiagnosticConfig(stateKey);
  if (!config) return;
  console.info('[Map Toggle Diagnostic]', {
    toggleName: config.toggleName,
    stateKey,
    affectedLayerIds: config.layerIds,
    visibility: visible ? 'visible' : 'hidden',
  });
};

export interface MapLayerActions {
  toggleLayer: (layer: keyof LayerState) => void;
  setCoverageRadius: (checked: boolean) => void;
  setCoverageGaps: (checked: boolean) => void;
  setCoverageRadiusKm: (km: number) => void;
  setRadiusKm: (km: number) => void;
  setEngagementGapView: (view: EngagementGapView) => void;
  /** Direct setter for tutorial overrides */
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
}

export interface MapLayerState {
  layers: LayerState;
  coverageRadius: boolean;
  coverageGaps: boolean;
  coverageRadiusKm: number;
  radiusKm: number;
  engagementGapView: EngagementGapView;
}

export interface UseMapLayersReturn extends MapLayerState {
  actions: MapLayerActions;
  /** Snapshot current state for tutorial restore */
  snapshot: () => { layers: LayerState; coverageRadius: boolean; coverageGaps: boolean };
  /** Restore from snapshot */
  restore: (snap: { layers: LayerState; coverageRadius: boolean; coverageGaps: boolean }) => void;
}

export const useMapLayers = (): UseMapLayersReturn => {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [coverageRadius, setCoverageRadiusRaw] = useState(DEFAULT_COVERAGE.coverageRadius);
  const [coverageGaps, setCoverageGapsRaw] = useState(DEFAULT_COVERAGE.coverageGaps);
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(DEFAULT_COVERAGE.coverageRadiusKm);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_COVERAGE.radiusKm);
  const [engagementGapView, setEngagementGapView] = useState<EngagementGapView>('priority');

  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [layer]: !prev[layer] };
      logToggleDiagnostic(layer, next[layer]);
      return next;
    });
  }, []);

  const setCoverageRadius = useCallback((checked: boolean) => {
    setCoverageRadiusRaw(checked);
    logToggleDiagnostic('coverageRadius', checked);
  }, []);

  const setCoverageGaps = useCallback((checked: boolean) => {
    setCoverageGapsRaw(checked);
    logToggleDiagnostic('coverageGaps', checked);
  }, []);

  const snapshot = useCallback(() => ({
    layers,
    coverageRadius,
    coverageGaps,
  }), [layers, coverageRadius, coverageGaps]);

  const restore = useCallback((snap: { layers: LayerState; coverageRadius: boolean; coverageGaps: boolean }) => {
    setLayers(snap.layers);
    setCoverageRadiusRaw(snap.coverageRadius);
    setCoverageGapsRaw(snap.coverageGaps);
  }, []);

  const actions: MapLayerActions = useMemo(() => ({
    toggleLayer,
    setCoverageRadius,
    setCoverageGaps,
    setCoverageRadiusKm,
    setRadiusKm,
    setEngagementGapView,
    setLayers,
  }), [toggleLayer, setCoverageRadius, setCoverageGaps]);

  return {
    layers,
    coverageRadius,
    coverageGaps,
    coverageRadiusKm,
    radiusKm,
    engagementGapView,
    actions,
    snapshot,
    restore,
  };
};
