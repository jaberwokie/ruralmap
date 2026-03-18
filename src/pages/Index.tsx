import { useState, useCallback, useMemo } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import DetailPanel from '@/components/map/DetailPanel';
import CoverageDetailPanel from '@/components/map/CoverageDetailPanel';
import { Facility, defaultFacilities } from '@/data/facilities';
import { CoverageArea } from '@/data/nevada-counties';

interface LayerState {
  counties: boolean;
  zones: boolean;
  serviceLocations: boolean;
  memberVolume: boolean;
}

export interface Filters {
  types: Set<string>;
  counties: Set<string>;
}

const Index = () => {
  const [facilities, setFacilities] = useState<Facility[]>(defaultFacilities);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(50);
  const [filters, setFilters] = useState<Filters>({ types: new Set(), counties: new Set() });
  const [coverageRadius, setCoverageRadius] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [hoveredArea, setHoveredArea] = useState<CoverageArea | null>(null);
  const [focusedArea, setFocusedArea] = useState<CoverageArea | null>(null);
  const [layers, setLayers] = useState<LayerState>({
    counties: true,
    zones: true,
    serviceLocations: true,
    memberVolume: false,
  });

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
      if (layer === 'zones') {
        setFocusedArea(null);
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

  const handleFacilityClick = useCallback((facility: Facility) => {
    setSelectedFacility(facility);
  }, []);

  const handleAddFacilities = useCallback((newFacilities: Facility[]) => {
    setFacilities(prev => [...prev, ...newFacilities]);
  }, []);

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
            handleFacilityClick(facility);
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
          focusedArea={focusedArea}
          onFocusedAreaChange={(area) => setFocusedArea(prev => prev === area ? null : area)}
        />
      </div>

      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 relative h-[calc(100vh-52px)] md:h-full`}>
        <MapView
          facilities={filteredFacilities}
          layers={layers}
          onFacilityClick={handleFacilityClick}
          onAreaHover={setHoveredArea}
          onAreaClick={(area) => setFocusedArea(prev => prev === area ? null : area)}
          focusedArea={focusedArea}
          searchQuery={searchQuery}
          radiusKm={radiusKm}
          coverageRadius={coverageRadius}
          coverageGaps={coverageGaps}
        />
        <CoverageDetailPanel hoveredArea={hoveredArea} focusedArea={focusedArea} onClearFocus={() => setFocusedArea(null)} />
        {selectedFacility && (
          <DetailPanel
            facility={selectedFacility}
            onClose={() => setSelectedFacility(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
