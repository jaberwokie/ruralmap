import { useState, useCallback, useMemo, useRef } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import CoverageDetailPanel, { MapEntity } from '@/components/map/CoverageDetailPanel';
import { Facility, defaultFacilities } from '@/data/facilities';
import { COUNTY_FTE_MAP } from '@/data/fte-capacity';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';

interface LayerState {
  counties: boolean;
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
  const [radiusKm, setRadiusKm] = useState(50);
  const [filters, setFilters] = useState<Filters>({ types: new Set(), counties: new Set(), serviceCategories: new Set() });
  const [coverageRadius, setCoverageRadius] = useState(false);
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(ACTIVE_COVERAGE_RADIUS_KM);
  const [coverageGaps, setCoverageGaps] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [topProvidersOnly, setTopProvidersOnly] = useState(false);
  const [engagementRateBelow20Only, setEngagementRateBelow20Only] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    counties: true,
    serviceLocations: true,
    operationalCoverage: false,
    fteCapacity: false,
    utilizationIntensity: false,
    engagementGap: false,
  });

  // ── Unified detail panel state ──
  const [lockedEntity, setLockedEntity] = useState<MapEntity | null>(null);
  const [hoverEntity, setHoverEntity] = useState<MapEntity | null>(null);

  // ── Contextual help tooltip state ──
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const helpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHelpEnter = useCallback((key: string) => {
    if (helpTimeoutRef.current) clearTimeout(helpTimeoutRef.current);
    setActiveHelp(key);
  }, []);
  const handleHelpLeave = useCallback(() => {
    helpTimeoutRef.current = setTimeout(() => setActiveHelp(null), 120);
  }, []);
  const [selectedFteId, setSelectedFteId] = useState<string | null>(null);

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
        if (filters.types.size > 0 && !filters.types.has(f.type)) return false;
        if (filters.counties.size > 0 && !filters.counties.has(f.county)) return false;
        return true;
      });
  }, [facilities, filters]);


  const handleToggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => {
      const next = { ...prev, [layer]: !prev[layer] };
      if (layer === 'serviceLocations' && !next.serviceLocations) {
        setCoverageRadius(false);
      }
      return next;
    });
  }, []);

  const handleCoverageRadiusChange = useCallback((checked: boolean) => {
    setCoverageRadius(checked);
  }, []);

  const handleCoverageGapsChange = useCallback((checked: boolean) => {
    setCoverageGaps(checked);
    if (checked) {
      setLayers(prev => ({ ...prev, serviceLocations: true }));
      setCoverageRadius(true);
    }
  }, []);

  const handleAddFacilities = useCallback((newFacilities: Facility[]) => {
    setFacilities(prev => [...prev, ...newFacilities]);
  }, []);

  // ── Unified entity selection handlers ──
  const handleEntityClick = useCallback((entity: MapEntity | null) => {
    setLockedEntity(entity);
  }, []);

  const handleEntityHover = useCallback((entity: MapEntity | null) => {
    setHoverEntity(entity);
  }, []);

  const handleClearEntity = useCallback(() => {
    setLockedEntity(null);
  }, []);

  const handleMapClick = useCallback(() => {
    setLockedEntity(null);
    setSelectedFteId(null);
  }, []);

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
          onTopProvidersOnlyChange={setTopProvidersOnly}
          engagementRateBelow20Only={engagementRateBelow20Only}
          onEngagementRateBelow20OnlyChange={setEngagementRateBelow20Only}
          onHelpEnter={handleHelpEnter}
          onHelpLeave={handleHelpLeave}
        />
      </div>

      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 relative h-[calc(100vh-52px)] md:h-full`}>
        <MapView
          facilities={filteredFacilities}
          layers={layers}
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
        />
        <CoverageDetailPanel
          entity={lockedEntity}
          hoverEntity={hoverEntity}
          onClear={handleClearEntity}
          coverageRadiusKm={coverageRadiusKm}
          memberVolumeLayerOn={true}
          activeHelp={activeHelp}
        />
      </div>
    </div>
  );
};

export default Index;
