import { useState, useCallback, useEffect } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import CoverageDetailPanel from '@/components/map/CoverageDetailPanel';
import { useMapLayers } from '@/hooks/useMapLayers';
import { useMapSelection } from '@/hooks/useMapSelection';
import { useMapFilters } from '@/hooks/useMapFilters';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useMemberAccess } from '@/hooks/useMemberAccess';
import { localTransitProviders, getProviderBounds } from '@/data/local-transit-providers';
import type { MapEntity } from '@/types/entities';
import type { Facility } from '@/data/facilities';

const THUMBNAIL_PLACEHOLDER_DURATION_MS = 1600;

const Index = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [focusBounds, setFocusBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [showInitialMapCover, setShowInitialMapCover] = useState(true);
  const layers = useMapLayers();
  const selection = useMapSelection();
  const filters = useMapFilters();
  const facility = useFacilityData(filters.filters);
  const member = useMemberAccess(facility.facilities);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowInitialMapCover(false), THUMBNAIL_PLACEHOLDER_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const onEntity = useCallback((e: MapEntity | null) => selection.actions.selectEntity(e), [selection.actions]);
  const onCounty = useCallback((c: string) => { selection.actions.selectCounty(c); setMobileSidebarOpen(false); }, [selection.actions]);
  const onFacility = useCallback((f: Facility) => { selection.actions.selectEntity({ type: 'facility', facility: f }); setMobileSidebarOpen(false); }, [selection.actions]);

  const onTransitProviderClick = useCallback((providerId: string) => {
    const provider = localTransitProviders.find(p => p.id === providerId);
    if (!provider) return;
    layers.actions.setLayers(prev => prev.localTransitZones ? prev : { ...prev, localTransitZones: true });
    const bounds = getProviderBounds(provider);
    if (bounds) {
      setFocusBounds([[bounds[0][0], bounds[0][1]], [bounds[1][0], bounds[1][1]]]);
    }
    selection.actions.selectEntity({ type: 'localTransitProvider', provider });
    setMobileSidebarOpen(false);
  }, [layers.actions, selection.actions]);

  const memberAnalysisEntity = member.analysis
    ? { type: 'memberAccess' as const, analysis: member.analysis }
    : null;
  const activeEntity = (selection.lockedEntity && selection.lockedEntity.type !== 'memberAccess' as string)
    ? selection.lockedEntity
    : memberAnalysisEntity ?? selection.lockedEntity;

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
          layer={{ layers: layers.layers, onToggleLayer: layers.actions.toggleLayer, coverageRadius: layers.coverageRadius, coverageGaps: layers.coverageGaps, onCoverageRadiusChange: layers.actions.setCoverageRadius, onCoverageGapsChange: layers.actions.setCoverageGaps, radiusKm: layers.radiusKm, onRadiusChange: layers.actions.setRadiusKm, coverageRadiusKm: layers.coverageRadiusKm, onCoverageRadiusKmChange: layers.actions.setCoverageRadiusKm, engagementGapView: layers.engagementGapView, onEngagementGapViewChange: layers.actions.setEngagementGapView }}
          filter={{ searchQuery: filters.searchQuery, onSearchChange: filters.actions.setSearchQuery, filters: filters.filters, onFiltersChange: filters.actions.setFilters, topProvidersOnly: filters.topProvidersOnly, onTopProvidersOnlyChange: filters.actions.setTopProvidersOnly, engagementRateBelow20Only: filters.engagementRateBelow20Only, onEngagementRateBelow20OnlyChange: filters.actions.setEngagementRateBelow20Only }}
          facility={{ allFacilities: facility.facilities, facilities: facility.filteredFacilities, onAddFacilities: facility.addFacilities, onFacilityClick: onFacility }}
          selection={{ selectedFteId: selection.activeFteId, onFteCardClick: selection.actions.handleFteCardClick, onCountySelect: onCounty, onTransitProviderClick }}
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
          filters={filters.filters}
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
          engagementGapView={layers.engagementGapView}
          memberLocation={member.memberLocation}
          memberAnalysis={member.analysis}
          onMemberPlace={member.placeMember}
          onMemberClear={() => { member.clearMember(); selection.actions.clearSelection(); }}
          onMemberGeocode={member.geocodeAddress}
          memberIsGeocoding={member.isGeocoding}
          memberGeocodeError={member.geocodeError}
          memberManualMode={member.manualPlacementMode}
          focusBounds={focusBounds}
        />
        {showInitialMapCover && (
          <div className="pointer-events-none absolute inset-0 z-[675] flex items-center justify-center bg-background/95 backdrop-blur-[1px]">
            <div className="mx-6 flex max-w-xl flex-col items-center gap-4 text-center">
              <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground shadow-sm">
                Nevada Behavioral Health
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Rural Operations Map</h1>
                <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground md:text-base">
                  County-level operational visibility for outreach, staffing coverage, and rural care coordination.
                </p>
              </div>
            </div>
          </div>
        )}
        <CoverageDetailPanel
          entity={activeEntity}
          onClear={() => {
            if (selection.lockedEntity && member.memberLocation) {
              selection.actions.clearSelection();
              return;
            }
            if (member.memberLocation) {
              member.clearMember();
            }
            selection.actions.clearSelection();
          }}
          coverageRadiusKm={layers.coverageRadiusKm}
          memberLocation={member.memberLocation}
        />
      </div>
    </div>
  );
};

export default Index;
