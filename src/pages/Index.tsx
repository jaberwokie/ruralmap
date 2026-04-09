import { useState, useCallback } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import CoverageDetailPanel from '@/components/map/CoverageDetailPanel';
import MapTutorialOverlay from '@/components/map/MapTutorialOverlay';
import { useMapLayers } from '@/hooks/useMapLayers';
import { useMapSelection } from '@/hooks/useMapSelection';
import { useMapFilters } from '@/hooks/useMapFilters';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useTutorialState } from '@/hooks/useTutorialState';
import type { MapEntity } from '@/types/entities';
import type { Facility } from '@/data/facilities';

const Index = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const layers = useMapLayers();
  const selection = useMapSelection();
  const filters = useMapFilters();
  const facility = useFacilityData(filters.filters);
  const tutorial = useTutorialState({
    getSnapshot: layers.snapshot,
    restoreSnapshot: layers.restore,
    setLayers: layers.actions.setLayers,
    setMobileSidebarOpen,
    clearSelection: selection.actions.clearSelection,
  });

  const onEntity = useCallback((e: MapEntity | null) => selection.actions.selectEntity(e), [selection.actions]);
  const onCounty = useCallback((c: string) => { selection.actions.selectCounty(c); setMobileSidebarOpen(false); }, [selection.actions]);
  const onFacility = useCallback((f: Facility) => { selection.actions.selectEntity({ type: 'facility', facility: f }); setMobileSidebarOpen(false); }, [selection.actions]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background">
      <div className="md:hidden flex items-center justify-between p-3 bg-card border-b border-border">
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Rural Operations Map</h1>
          <p className="text-[10px] text-muted-foreground">Nevada Behavioral Health</p>
        </div>
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-2 rounded-md bg-secondary text-foreground text-xs font-medium">
          {mobileSidebarOpen ? 'Map' : 'Filters'}
        </button>
      </div>

      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 h-[calc(100vh-52px)] md:h-full`}>
        <Sidebar
          layer={{ layers: layers.layers, onToggleLayer: layers.actions.toggleLayer, coverageRadius: layers.coverageRadius, coverageGaps: layers.coverageGaps, onCoverageRadiusChange: layers.actions.setCoverageRadius, onCoverageGapsChange: layers.actions.setCoverageGaps, radiusKm: layers.radiusKm, onRadiusChange: layers.actions.setRadiusKm, coverageRadiusKm: layers.coverageRadiusKm, onCoverageRadiusKmChange: layers.actions.setCoverageRadiusKm }}
          filter={{ searchQuery: filters.searchQuery, onSearchChange: filters.actions.setSearchQuery, filters: filters.filters, onFiltersChange: filters.actions.setFilters, topProvidersOnly: filters.topProvidersOnly, onTopProvidersOnlyChange: filters.actions.setTopProvidersOnly, engagementRateBelow20Only: filters.engagementRateBelow20Only, onEngagementRateBelow20OnlyChange: filters.actions.setEngagementRateBelow20Only }}
          facility={{ allFacilities: facility.facilities, facilities: facility.filteredFacilities, onAddFacilities: facility.addFacilities, onFacilityClick: onFacility }}
          selection={{ selectedFteId: selection.activeFteId, onFteCardClick: selection.actions.handleFteCardClick, onCountySelect: onCounty }}
          onReplayTutorial={tutorial.replayTutorial}
          tutorialStepKey={tutorial.tutorialStepKey}
        />
      </div>

      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 relative h-[calc(100vh-52px)] md:h-full`}>
        <MapView
          facilities={facility.filteredFacilities}
          allFacilities={facility.facilities}
          layers={layers.layers}
          typeFilters={filters.filters.types}
          countyFilters={filters.filters.counties}
          serviceCategoryFilters={filters.filters.serviceCategories}
          onFacilityClick={(f) => onEntity({ type: 'facility', facility: f })}
          onMapClick={selection.actions.handleMapClick}
          searchQuery={filters.searchQuery}
          radiusKm={layers.radiusKm}
          coverageRadius={layers.coverageRadius}
          coverageGaps={layers.coverageGaps}
          onEntityClick={onEntity}
          
          selectedCounty={selection.selectedCounty}
          onFteHubClick={selection.actions.handleFteHubClick}
          selectedFteId={selection.activeFteId}
          coverageRadiusKm={layers.coverageRadiusKm}
          topProvidersOnly={filters.topProvidersOnly}
          engagementRateBelow20Only={filters.engagementRateBelow20Only}
          tutorialStepKey={tutorial.tutorialStepKey}
        />
        <CoverageDetailPanel
          entity={selection.lockedEntity}
          onClear={selection.actions.clearSelection}
          coverageRadiusKm={layers.coverageRadiusKm}
        />
        <MapTutorialOverlay
          introOpen={tutorial.tutorialIntroOpen}
          walkthroughOpen={tutorial.tutorialOpen}
          stepIndex={tutorial.tutorialStepIndex}
          onStart={tutorial.startTutorial}
          onSkip={() => tutorial.closeTutorial(false)}
          onNext={tutorial.goToNextTutorialStep}
          onBack={tutorial.goToPreviousTutorialStep}
        />
      </div>
    </div>
  );
};

export default Index;
