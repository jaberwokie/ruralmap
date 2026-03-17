import { useState, useCallback } from 'react';
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

const Index = () => {
  const [facilities, setFacilities] = useState<Facility[]>(defaultFacilities);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layers, setLayers] = useState<LayerState>({
    counties: true,
    hospitals: true,
    clinics: true,
    zones: true,
    tier1: true,
  });

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
        facilities={facilities}
        onAddFacilities={handleAddFacilities}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFacilityClick={handleFacilityClick}
      />
      <div className="flex-1 relative">
        <MapView
          facilities={facilities}
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
