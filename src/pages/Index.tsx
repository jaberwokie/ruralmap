import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import CoverageDetailPanel, { MapEntity } from '@/components/map/CoverageDetailPanel';
import MapTutorialOverlay from '@/components/map/MapTutorialOverlay';
import { auditFacilityClassifications, auditFacilityConfidence, Facility, defaultFacilities } from '@/data/facilities';
import { buildFacilityValidationIndex } from '@/utils/facilityValidation';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { COUNTY_FTE_MAP } from '@/data/fte-capacity';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';
import {
  isMapTutorialCompleted,
  MAP_TUTORIAL_COMPLETION_VALUE,
  MAP_TUTORIAL_STORAGE_KEY,
  MAP_TUTORIAL_STEPS,
  MapTutorialStepKey,
} from '@/data/map-tutorial';

const TOGGLE_DIAGNOSTICS = {
  counties: {
    toggleName: 'County Boundaries',
    layerIds: ['county-hit-areas', 'county-borders', 'county-labels'],
  },
  services: {
    toggleName: 'Service',
    layerIds: ['service-presence-halos', 'service-presence-markers'],
  },
  behavioralHealth: {
    toggleName: 'Behavioral Health',
    layerIds: ['behavioral-health-halos', 'behavioral-health-markers'],
  },
  serviceLocations: {
    toggleName: 'Provider Locations',
    layerIds: ['facility-markers'],
  },
  coverageRadius: {
    toggleName: 'Provider Coverage Radius',
    layerIds: ['drive-radius-overlay'],
  },
  coverageGaps: {
    toggleName: 'Access Gaps (Outside Coverage Radius)',
    layerIds: ['coverage-gap-overlay'],
  },
} as const;

const TOP20_CONFLICTING_LAYERS: (keyof LayerState)[] = [
  'services', 'behavioralHealth', 'operationalCoverage',
  'fteCapacity', 'utilizationIntensity', 'engagementGap',
];

interface LayerState {
  counties: boolean;
  services: boolean;
  behavioralHealth: boolean;
  serviceLocations: boolean;
  operationalCoverage: boolean;
  fteCapacity: boolean;
  utilizationIntensity: boolean;
  engagementGap: boolean;
}

export interface Filters {
  types: Set<string>;
  counties: Set<string>;
  serviceCategories: Set<string>;
}

const Index = () => {
  const [facilities, setFacilities] = useState<Facility[]>(defaultFacilities);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(32);
  const [filters, setFilters] = useState<Filters>({ types: new Set(), counties: new Set(), serviceCategories: new Set() });
  const [coverageRadius, setCoverageRadius] = useState(false);
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(ACTIVE_COVERAGE_RADIUS_KM);
  const [coverageGaps, setCoverageGaps] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [topProvidersOnly, setTopProvidersOnly] = useState(false);
  const [engagementRateBelow20Only, setEngagementRateBelow20Only] = useState(false);
  const topProvidersSnapshotRef = useRef<{
    layers: LayerState;
    filters: Filters;
    coverageRadius: boolean;
    coverageGaps: boolean;
  } | null>(null);
  const [layers, setLayers] = useState<LayerState>({
    counties: true,
    services: true,
    behavioralHealth: true,
    serviceLocations: true,
    operationalCoverage: false,
    fteCapacity: false,
    utilizationIntensity: false,
    engagementGap: false,
  });

  // ── Unified detail panel state ──
  const [lockedEntity, setLockedEntity] = useState<MapEntity | null>(null);
  const [hoverEntity, setHoverEntity] = useState<MapEntity | null>(null);

  const [selectedFteId, setSelectedFteId] = useState<string | null>(null);
  const [tutorialIntroOpen, setTutorialIntroOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const tutorialSnapshotRef = useRef<{
    layers: LayerState;
    coverageRadius: boolean;
    coverageGaps: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const completed = isMapTutorialCompleted(localStorage.getItem(MAP_TUTORIAL_STORAGE_KEY));
      if (!completed) setTutorialIntroOpen(true);
    } catch {
      setTutorialIntroOpen(true);
    }
  }, []);

  // Derive selected county from locked entity for map highlight
  const selectedCounty = useMemo(() => {
    if (!lockedEntity) return null;
    if (lockedEntity.type === 'ruralServiceGroup' || lockedEntity.type === 'county' || lockedEntity.type === 'memberVolume') {
      return lockedEntity.county;
    }
    return null;
  }, [lockedEntity]);

  // Derive active FTE from county selection OR direct hub click
  const activeFteId = useMemo(() => {
    if (selectedFteId) return selectedFteId;
    if (selectedCounty) {
      const fte = COUNTY_FTE_MAP.get(selectedCounty);
      return fte?.id ?? null;
    }
    return null;
  }, [selectedFteId, selectedCounty]);

  const filteredFacilities = useMemo(() => {
    return facilities
      .filter(f => {
        if (!f.lat || !f.lng || isNaN(f.lat) || isNaN(f.lng)) return false;
        if (filters.types.size > 0) {
          const matchesPrimaryType = filters.types.has(f.type);
          const matchesBehavioralHealth = filters.types.has('behavioralHealth') && facilityOffersBehavioralHealth(f);

          if (!matchesPrimaryType && !matchesBehavioralHealth) return false;
        }
        if (filters.counties.size > 0 && !filters.counties.has(f.county)) return false;
        return true;
      });
  }, [facilities, filters]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    buildFacilityValidationIndex(facilities);
    console.info('[Facility Classification Audit]', auditFacilityClassifications(facilities));
    console.info('[Facility Confidence Audit]', auditFacilityConfidence(facilities));
  }, [facilities]);

  const logToggleDiagnostic = useCallback((stateKey: keyof typeof TOGGLE_DIAGNOSTICS, visible: boolean) => {
    if (!import.meta.env.DEV) return;
    const config = TOGGLE_DIAGNOSTICS[stateKey];
    console.info('[Map Toggle Diagnostic]', {
      toggleName: config.toggleName,
      stateKey,
      affectedLayerIds: config.layerIds,
      visibility: visible ? 'visible' : 'hidden',
    });
  }, []);

  const handleToggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [layer]: !prev[layer] };
      if (layer in TOGGLE_DIAGNOSTICS) {
        logToggleDiagnostic(layer as keyof typeof TOGGLE_DIAGNOSTICS, next[layer as keyof LayerState]);
      }
      return next;
    });
  }, [logToggleDiagnostic]);

  const handleCoverageRadiusChange = useCallback((checked: boolean) => {
    setCoverageRadius(checked);
    logToggleDiagnostic('coverageRadius', checked);
  }, [logToggleDiagnostic]);

  const handleCoverageGapsChange = useCallback((checked: boolean) => {
    setCoverageGaps(checked);
    logToggleDiagnostic('coverageGaps', checked);
  }, [logToggleDiagnostic]);

  const handleTopProvidersOnlyChange = useCallback((checked: boolean) => {
    if (checked) {
      // Snapshot current state before entering focus mode
      if (!topProvidersSnapshotRef.current) {
        topProvidersSnapshotRef.current = {
          layers: { ...layers },
          filters: { types: new Set(filters.types), counties: new Set(filters.counties), serviceCategories: new Set(filters.serviceCategories) },
          coverageRadius,
          coverageGaps,
        };
      }
      // Suppress all visual layers except serviceLocations
      setLayers({
        counties: false,
        services: false,
        behavioralHealth: false,
        serviceLocations: true,
        operationalCoverage: false,
        fteCapacity: false,
        utilizationIntensity: false,
        engagementGap: false,
      });
      setFilters({ types: new Set(), counties: new Set(), serviceCategories: new Set() });
      setCoverageRadius(false);
      setCoverageGaps(false);
    } else {
      // Restore previous state
      const snapshot = topProvidersSnapshotRef.current;
      if (snapshot) {
        setLayers(snapshot.layers);
        setFilters(snapshot.filters);
        setCoverageRadius(snapshot.coverageRadius);
        setCoverageGaps(snapshot.coverageGaps);
        topProvidersSnapshotRef.current = null;
      }
    }
    setTopProvidersOnly(checked);
  }, [layers, filters, coverageRadius, coverageGaps]);

  const handleAddFacilities = useCallback((newFacilities: Facility[]) => {
    setFacilities(prev => [...prev, ...newFacilities]);
  }, []);

  // ── Unified entity selection handlers ──
  const handleEntityClick = useCallback((entity: MapEntity | null) => {
    setLockedEntity(entity);
  }, []);

  const handleCountySelect = useCallback((county: string) => {
    setSelectedFteId(null);
    setLockedEntity({ type: 'county', county });
    setMobileSidebarOpen(false);
  }, []);

  const handleEntityHover = useCallback((entity: MapEntity | null) => {
    setHoverEntity(entity);
  }, []);

  const handleClearEntity = useCallback(() => {
    setLockedEntity(null);
    setHoverEntity(null);
    setSelectedFteId(null);
  }, []);

  const handleMapClick = useCallback(() => {
    setLockedEntity(null);
    setSelectedFteId(null);
  }, []);

  const tutorialStepKey = tutorialOpen ? MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key ?? null : null;

  const markTutorialComplete = useCallback(() => {
    try {
      localStorage.setItem(MAP_TUTORIAL_STORAGE_KEY, MAP_TUTORIAL_COMPLETION_VALUE);
    } catch {}
  }, []);

  const restoreTutorialSnapshot = useCallback(() => {
    const snapshot = tutorialSnapshotRef.current;
    if (!snapshot) return;
    setLayers(snapshot.layers);
    setCoverageRadius(snapshot.coverageRadius);
    setCoverageGaps(snapshot.coverageGaps);
    tutorialSnapshotRef.current = null;
  }, []);

  const startTutorial = useCallback(() => {
    tutorialSnapshotRef.current = {
      layers,
      coverageRadius,
      coverageGaps,
    };
    setTutorialIntroOpen(false);
    setMobileSidebarOpen(false);
    setLockedEntity(null);
    setHoverEntity(null);
    setSelectedFteId(null);
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  }, [coverageGaps, coverageRadius, layers]);

  const closeTutorial = useCallback((markComplete = false) => {
    setTutorialIntroOpen(false);
    setTutorialOpen(false);
    setTutorialStepIndex(0);
    setHoverEntity(null);
    restoreTutorialSnapshot();
    if (markComplete) markTutorialComplete();
  }, [markTutorialComplete, restoreTutorialSnapshot]);

  const replayTutorial = useCallback(() => {
    const nextSnapshot = tutorialSnapshotRef.current ?? {
      layers,
      coverageRadius,
      coverageGaps,
    };
    restoreTutorialSnapshot();
    tutorialSnapshotRef.current = nextSnapshot;
    setTutorialIntroOpen(false);
    setMobileSidebarOpen(false);
    setLockedEntity(null);
    setHoverEntity(null);
    setSelectedFteId(null);
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  }, [coverageGaps, coverageRadius, layers, restoreTutorialSnapshot]);

  const goToNextTutorialStep = useCallback(() => {
    setTutorialStepIndex((current) => {
      if (current >= MAP_TUTORIAL_STEPS.length - 1) {
        window.setTimeout(() => closeTutorial(true), 0);
        return current;
      }
      return current + 1;
    });
  }, [closeTutorial]);

  const goToPreviousTutorialStep = useCallback(() => {
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (!tutorialOpen) return;

    const stepKey = MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key as MapTutorialStepKey | undefined;
    if (!stepKey) return;

    if (stepKey === 'coreMap' || stepKey === 'providerLocations') {
      setLayers((current) => ({ ...current, services: true, behavioralHealth: true }));
    }
  }, [tutorialOpen, tutorialStepIndex]);

  useEffect(() => {
    if (!tutorialOpen || window.innerWidth >= 768) return;

    const stepKey = MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key as MapTutorialStepKey | undefined;
    if (!stepKey) return;

    const sidebarSteps = new Set<MapTutorialStepKey>(['search', 'facilityFilters', 'coreMap', 'providerLocations']);
    setMobileSidebarOpen(sidebarSteps.has(stepKey));
  }, [tutorialOpen, tutorialStepIndex]);

  const handleFteHubClick = useCallback((fteId: string) => {
    const isAlready = selectedFteId === fteId;
    setSelectedFteId(isAlready ? null : fteId);
    setLockedEntity(isAlready ? null : { type: 'fteDetail', fteId });
  }, [selectedFteId]);

  const handleFteCardClick = useCallback((fteId: string) => {
    const isAlready = selectedFteId === fteId;
    setSelectedFteId(isAlready ? null : fteId);
    setLockedEntity(isAlready ? null : { type: 'fteDetail', fteId });
  }, [selectedFteId]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-card border-b border-border">
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Rural Operations Map</h1>
          <p className="text-[10px] text-muted-foreground">Nevada Behavioral Health</p>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 rounded-md bg-secondary text-foreground text-xs font-medium"
        >
          {mobileSidebarOpen ? 'Map' : 'Filters'}
        </button>
      </div>

      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 h-[calc(100vh-52px)] md:h-full`}>
        <Sidebar
          layers={layers}
          onToggleLayer={handleToggleLayer}
          allFacilities={facilities}
          facilities={filteredFacilities}
          onAddFacilities={handleAddFacilities}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFacilityClick={(facility) => {
            handleEntityClick({ type: 'facility', facility });
            setMobileSidebarOpen(false);
          }}
          filters={filters}
          onFiltersChange={setFilters}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          coverageRadius={coverageRadius}
          coverageGaps={coverageGaps}
          onCoverageRadiusChange={handleCoverageRadiusChange}
          onCoverageGapsChange={handleCoverageGapsChange}
          selectedFteId={activeFteId}
          onFteCardClick={handleFteCardClick}
          coverageRadiusKm={coverageRadiusKm}
          onCoverageRadiusKmChange={setCoverageRadiusKm}
          topProvidersOnly={topProvidersOnly}
          onTopProvidersOnlyChange={handleTopProvidersOnlyChange}
          engagementRateBelow20Only={engagementRateBelow20Only}
          onEngagementRateBelow20OnlyChange={setEngagementRateBelow20Only}
          onCountySelect={handleCountySelect}
          onReplayTutorial={replayTutorial}
          tutorialStepKey={tutorialStepKey}
        />
      </div>

      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 relative h-[calc(100vh-52px)] md:h-full`}>
        <MapView
          facilities={filteredFacilities}
          allFacilities={facilities}
          layers={layers}
          typeFilters={filters.types}
          countyFilters={filters.counties}
          serviceCategoryFilters={filters.serviceCategories}
          onFacilityClick={(facility) => handleEntityClick({ type: 'facility', facility })}
          onMapClick={handleMapClick}
          searchQuery={searchQuery}
          radiusKm={radiusKm}
          coverageRadius={coverageRadius}
          coverageGaps={coverageGaps}
          onEntityClick={handleEntityClick}
          onEntityHover={handleEntityHover}
          selectedCounty={selectedCounty}
          onFteHubClick={handleFteHubClick}
          selectedFteId={activeFteId}
          coverageRadiusKm={coverageRadiusKm}
          topProvidersOnly={topProvidersOnly}
          engagementRateBelow20Only={engagementRateBelow20Only}
          tutorialStepKey={tutorialStepKey}
        />
        <CoverageDetailPanel
          entity={lockedEntity}
          hoverEntity={hoverEntity}
          onClear={handleClearEntity}
          coverageRadiusKm={coverageRadiusKm}
          memberVolumeLayerOn={true}
        />
        <MapTutorialOverlay
          introOpen={tutorialIntroOpen}
          walkthroughOpen={tutorialOpen}
          stepIndex={tutorialStepIndex}
          onStart={startTutorial}
            onSkip={() => closeTutorial(false)}
          onNext={goToNextTutorialStep}
          onBack={goToPreviousTutorialStep}
        />
      </div>
    </div>
  );
};

export default Index;
