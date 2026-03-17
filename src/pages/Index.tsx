import { useState, useCallback, useMemo } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import DetailPanel from '@/components/map/DetailPanel';
import { Facility, defaultFacilities } from '@/data/facilities';

interface LayerState {
  counties: boolean;
  hospitals: boolean;
  clinics: boolean;
  zones: boolean;
  tier1: boolean;
}

export interface Filters {
  types: Set<string>;
  counties: Set<string>;
}

const Index = () => {
  const [facilities, setFacilities] = useState<Facility[]>(defaultFacilities);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ types: new Set(), counties: new Set() });
  const [layers, setLayers] = useState<LayerState>({
    counties: true,
    hospitals: true,
    clinics: true,
    zones: true,
    tier1: true,
  });

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (filters.types.size > 0 && !filters.types.has(f.type)) return false;
      if (filters.counties.size > 0 && !filters.counties.has(f.county)) return false;
      return true;
    });
  }, [facilities, filters]);

  const handleToggleLayer = useCallback((layer: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleFacilityClick = useCallback((facility: Facility) => {
    setSelectedFacility(facility);
  }, []);

  const handleAddFacilities = useCallback((newFacilities: Facility[]) => {
    setFacilities(prev => [...prev, ...newFacilities]);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        layers={layers}
        onToggleLayer={handleToggleLayer}
        allFacilities={facilities}
        facilities={filteredFacilities}
        onAddFacilities={handleAddFacilities}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFacilityClick={handleFacilityClick}
        filters={filters}
        onFiltersChange={setFilters}
      />
      <div className="flex-1 relative">
        <MapView
          facilities={filteredFacilities}
          layers={layers}
          onFacilityClick={handleFacilityClick}
          searchQuery={searchQuery}
        />
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
