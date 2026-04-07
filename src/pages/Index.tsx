import { useState, useCallback, useMemo } from 'react';
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

const Index = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Domain hooks ──
  const layerState = useMapLayers();
  const selection = useMapSelection();
  const filterState = useMapFilters();
  
  const facilityData = useFacilityData(filterState.filters);

  const tutorial = useTutorialState({
    getSnapshot: layerState.snapshot,
    restoreSnapshot: layerState.restore,
    setLayers: layerState.actions.setLayers,
    setMobileSidebarOpen,
    clearSelection: selection.actions.clearSelection,
  });

  // ── Event handlers that bridge hook domains ──
  const handleEntityClick = useCallback((entity: MapEntity | null) => {
    selection.actions.selectEntity(entity);
  }, [selection.actions]);

  const handleCountySelect = useCallback((county: string) => {
    selection.actions.selectCounty(county);
    setMobileSidebarOpen(false);
  }, [selection.actions]);

  const handleFacilityClickFromSidebar = useCallback((facility: import('@/data/facilities').Facility) => {
    handleEntityClick({ type: 'facility', facility });
    setMobileSidebarOpen(false);
  }, [handleEntityClick]);

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

      {/* Sidebar */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 h-[calc(100vh-52px)] md:h-full`}>
        <Sidebar
          layers={layerState.layers}
          onToggleLayer={layerState.actions.toggleLayer}
          allFacilities={facilityData.facilities}
          facilities={facilityData.filteredFacilities}
          onAddFacilities={facilityData.addFacilities}
          searchQuery={filterState.searchQuery}
          onSearchChange={filterState.actions.setSearchQuery}
          onFacilityClick={handleFacilityClickFromSidebar}
          filters={filterState.filters}
          onFiltersChange={filterState.actions.setFilters}
          radiusKm={layerState.radiusKm}
          onRadiusChange={layerState.actions.setRadiusKm}
          coverageRadius={layerState.coverageRadius}
          coverageGaps={layerState.coverageGaps}
          onCoverageRadiusChange={layerState.actions.setCoverageRadius}
          onCoverageGapsChange={layerState.actions.setCoverageGaps}
          selectedFteId={selection.activeFteId}
          onFteCardClick={selection.actions.handleFteCardClick}
          coverageRadiusKm={layerState.coverageRadiusKm}
          onCoverageRadiusKmChange={layerState.actions.setCoverageRadiusKm}
          topProvidersOnly={filterState.topProvidersOnly}
          onTopProvidersOnlyChange={filterState.actions.setTopProvidersOnly}
          engagementRateBelow20Only={filterState.engagementRateBelow20Only}
          onEngagementRateBelow20OnlyChange={filterState.actions.setEngagementRateBelow20Only}
          onCountySelect={handleCountySelect}
          onReplayTutorial={tutorial.replayTutorial}
          tutorialStepKey={tutorial.tutorialStepKey}
        />
      </div>

      {/* Map + Detail Panel + Tutorial */}
      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 relative h-[calc(100vh-52px)] md:h-full`}>
        <MapView
          facilities={facilityData.filteredFacilities}
          allFacilities={facilityData.facilities}
          layers={layerState.layers}
          typeFilters={filterState.filters.types}
          countyFilters={filterState.filters.counties}
          serviceCategoryFilters={filterState.filters.serviceCategories}
          onFacilityClick={(facility) => handleEntityClick({ type: 'facility', facility })}
          onMapClick={selection.actions.handleMapClick}
          searchQuery={filterState.searchQuery}
          radiusKm={layerState.radiusKm}
          coverageRadius={layerState.coverageRadius}
          coverageGaps={layerState.coverageGaps}
          onEntityClick={handleEntityClick}
          onEntityHover={selection.actions.setHoverEntity}
          selectedCounty={selection.selectedCounty}
          onFteHubClick={selection.actions.handleFteHubClick}
          selectedFteId={selection.activeFteId}
          coverageRadiusKm={layerState.coverageRadiusKm}
          topProvidersOnly={filterState.topProvidersOnly}
          engagementRateBelow20Only={filterState.engagementRateBelow20Only}
          
          tutorialStepKey={tutorial.tutorialStepKey}
        />
        <CoverageDetailPanel
          entity={selection.lockedEntity}
          onClear={selection.actions.clearSelection}
          coverageRadiusKm={layerState.coverageRadiusKm}
          memberVolumeLayerOn={true}
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
