import { useState, useCallback, useEffect, useMemo } from 'react';
import MapView from '@/components/map/MapView';
import Sidebar from '@/components/map/Sidebar';
import CoverageDetailPanel from '@/components/map/CoverageDetailPanel';
import DecisionAssistDrawer from '@/components/map/decision-assist/DecisionAssistDrawer';
import PresentationOverlay from '@/components/map/presentation/PresentationOverlay';
import { useMapLayers } from '@/hooks/useMapLayers';
import { useMapSelection } from '@/hooks/useMapSelection';
import { useMapFilters } from '@/hooks/useMapFilters';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useMemberAccess } from '@/hooks/useMemberAccess';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useStaffingValidation } from '@/hooks/useStaffingValidation';
import { useLiveVerifiedRecords } from '@/hooks/useLiveVerifiedRecords';
import { enrichedRuralServices as _staticRuralServices } from '@/data/enriched-rural-services';
import { localTransitProviders, getProviderBounds } from '@/data/local-transit-providers';
import type { MapEntity } from '@/types/entities';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { normalizeProviderExact, normalizeProviderForMatch } from '@/utils/providerNameFormat';
import AdminVersionBadge from '@/components/AdminVersionBadge';
import PublicSafeDisclaimer from '@/components/map/PublicSafeDisclaimer';
import { DEFAULT_ZONE_FILTERS, type ZoneFilters } from '@/types/zoneFilters';
import type { ResponseCapabilityCategory } from '@/components/map/responseCapabilityVisuals';

const THUMBNAIL_PLACEHOLDER_DURATION_MS = 1600;

const Index = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Lifted Decision Assist open-state so the bottom-left Broadband/Cellular
  // legend can deterministically offset above the drawer instead of visually
  // jumping when layout flow shifts.
  const [decisionAssistOpen, setDecisionAssistOpen] = useState(false);
  const [focusBounds, setFocusBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [showInitialMapCover, setShowInitialMapCover] = useState(true);
  const layers = useMapLayers();
  const selection = useMapSelection();
  const filters = useMapFilters();
  const facility = useFacilityData(filters.filters);
  const member = useMemberAccess(facility.facilities);
  const presentation = usePresentationMode();
  // Zone overlay visibility filters — temporary UI state, not persisted.
  // Affects only zone overlay rendering; never pin/cluster/calculation logic.
  const [zoneFilters, setZoneFilters] = useState<ZoneFilters>(DEFAULT_ZONE_FILTERS);
  const toggleResponseCapabilityCategory = useCallback((category: ResponseCapabilityCategory) => {
    setZoneFilters((prev) => ({
      ...prev,
      responseCapability: {
        ...prev.responseCapability,
        [category]: !prev.responseCapability[category],
      },
    }));
  }, []);

  // Dev-only invariant + transition logging for Staffing Capacity & Load.
  // Stripped from production builds via import.meta.env.DEV check inside.
  useStaffingValidation({
    masterEnabled: layers.layers.fteCapacity,
    activeFteCoverageIds: selection.activeFteCoverageIds,
    selectedFteId: selection.activeFteId,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowInitialMapCover(false), THUMBNAIL_PLACEHOLDER_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const onEntity = useCallback((e: MapEntity | null) => selection.actions.selectEntity(e), [selection.actions]);
  /**
   * Map background tap handler. Clears every selection source so the detail
   * panel cannot resurrect from a stale fallback (notably `memberAnalysis`,
   * which would otherwise re-show the Member Access card after the user
   * dismissed a provider/service card by tapping empty map). Mobile-critical:
   * the panel covers a large share of the viewport, so any stale card reads
   * as a bug. Desktop behavior is unchanged because the same clearing path
   * runs in both layouts.
   */
  const onMapBackgroundClick = useCallback(() => {
    selection.actions.handleMapClick();
    // Member pin persists across map/sidebar/filter clicks. It is only cleared
    // by the search bar's explicit clear ("X") or by entering a new address.
  }, [selection.actions]);
  const onCounty = useCallback((c: string) => { selection.actions.selectCounty(c); setMobileSidebarOpen(false); }, [selection.actions]);
  const onFacility = useCallback((f: Facility) => { selection.actions.selectEntity({ type: 'facility', facility: f }); setMobileSidebarOpen(false); }, [selection.actions]);
  /**
   * Open a rural service detail panel from list-driven contexts (e.g. County
   * Details → Local Resource Network, Member Access list). Uses
   * `selectEntityWithBack` so the user can return to the prior county/member
   * context via the panel's back control.
   */
  const onService = useCallback((s: RuralService) => { selection.actions.selectEntityWithBack({ type: 'ruralService', service: s }); setMobileSidebarOpen(false); }, [selection.actions]);

  /** Pre-built indexes for resolving provider names → facilities. */
  const facilityIndex = useMemo(() => {
    const exact = new Map<string, Facility>();
    const alias = new Map<string, Facility>();
    for (const f of facility.facilities) {
      const k1 = normalizeProviderExact(f.name);
      if (k1 && !exact.has(k1)) exact.set(k1, f);
      const k2 = normalizeProviderForMatch(f.name);
      if (k2 && !alias.has(k2)) alias.set(k2, f);
    }
    return { exact, alias };
  }, [facility.facilities]);

  /** Navigate from utilization → provider detail by controlled name match. */
  const onProviderClickFromUtilization = useCallback((providerName: string): boolean => {
    const exactKey = normalizeProviderExact(providerName);
    if (!exactKey) return false;
    let match = facilityIndex.exact.get(exactKey);
    if (!match) {
      const aliasKey = normalizeProviderForMatch(providerName);
      if (aliasKey) match = facilityIndex.alias.get(aliasKey);
    }
    if (!match) return false;
    selection.actions.selectEntityWithBack({ type: 'facility', facility: match });
    return true;
  }, [facilityIndex, selection.actions]);

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

  /**
   * Live-merged rural services (static enriched dataset + live verified Cloud
   * rows, deduped). Mirrors MapView's merge so the County detail panel and the
   * Services pin layer always see the exact same set. Required for newly
   * imported rows (e.g. Nye) to appear in the Local Resource Network section.
   */
  const { records: liveVerifiedRecords } = useLiveVerifiedRecords();
  const mergedRuralServices = useMemo<RuralService[]>(() => {
    if (liveVerifiedRecords.length === 0) return _staticRuralServices;
    const dedupKey = (n: string, lat: number, lng: number) =>
      `${n.trim().toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    const liveKeys = new Set(liveVerifiedRecords.map((r) => dedupKey(r.name, r.lat, r.lng)));
    const baseFiltered = _staticRuralServices.filter(
      (s) => !liveKeys.has(dedupKey(s.name, s.lat, s.lng)),
    );
    return [...baseFiltered, ...liveVerifiedRecords];
  }, [liveVerifiedRecords]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background">
      {/*
        Mobile chrome header. Always rendered on <md viewports regardless of
        auth state. `relative z-50` keeps the header above the Leaflet map
        panes (which can reach z-index 700+) so the Filters/Map toggle is
        never visually buried after auth resolves and the layout reflows.
      */}
      <div className="md:hidden relative z-50 flex shrink-0 items-center justify-between p-3 bg-card border-b border-border">
        <div className="min-w-0 flex-1 pr-2">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Rural Operations Map</h1>
          <p className="text-[10px] text-muted-foreground">Nevada Behavioral Health</p>
          <AdminVersionBadge className="mt-0.5 block truncate max-w-[55vw] text-[9px]" />
        </div>
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-2 rounded-md bg-secondary text-foreground text-xs font-medium">
          {mobileSidebarOpen ? 'Map' : 'Filters'}
        </button>
      </div>

      {/*
        Sidebar + map use flex sizing instead of calc(100vh - 52px). On
        mobile Safari/Chrome, 100vh is the *largest* viewport (address bar
        collapsed), which pushes the bottom of the layout offscreen after
        an auth-driven reflow and can hide controls. Using flex-1 + min-h-0
        keeps both panels inside the actual viewport rect.
      */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 flex-1 md:flex-none min-h-0 md:h-full`}>
        <Sidebar
          layer={{ layers: layers.layers, onToggleLayer: layers.actions.toggleLayer, onSetLayers: layers.actions.setLayers, coverageRadius: layers.coverageRadius, coverageGaps: layers.coverageGaps, onCoverageRadiusChange: layers.actions.setCoverageRadius, onCoverageGapsChange: layers.actions.setCoverageGaps, radiusKm: layers.radiusKm, onRadiusChange: layers.actions.setRadiusKm, coverageRadiusKm: layers.coverageRadiusKm, onCoverageRadiusKmChange: layers.actions.setCoverageRadiusKm, engagementGapView: layers.engagementGapView, onEngagementGapViewChange: layers.actions.setEngagementGapView, zoneFilters, onToggleResponseCapabilityCategory: toggleResponseCapabilityCategory }}
          filter={{ searchQuery: filters.searchQuery, onSearchChange: filters.actions.setSearchQuery, filters: filters.filters, onFiltersChange: filters.actions.setFilters, topProvidersOnly: filters.topProvidersOnly, onTopProvidersOnlyChange: filters.actions.setTopProvidersOnly, engagementRateBelow20Only: filters.engagementRateBelow20Only, onEngagementRateBelow20OnlyChange: filters.actions.setEngagementRateBelow20Only }}
          facility={{ allFacilities: facility.facilities, facilities: facility.filteredFacilities, onAddFacilities: facility.addFacilities, onFacilityClick: onFacility }}
          selection={{
            selectedFteId: selection.activeFteId,
            activeFteCoverageIds: selection.activeFteCoverageIds,
            onFteCardClick: selection.actions.handleFteCardClick,
            onCountySelect: onCounty,
            onTransitProviderClick,
            onServiceSelect: onService,
            onFacilitySelect: onFacility,
            onTribalNationSelect: (tribe) => {
              selection.actions.selectEntity({ type: 'tribalNation', tribe });
              setFocusBounds([
                [tribe.lat - 0.5, tribe.lng - 0.5],
                [tribe.lat + 0.5, tribe.lng + 0.5],
              ]);
              setMobileSidebarOpen(false);
            },
            onFocusBounds: (b) => { setFocusBounds(b); setMobileSidebarOpen(false); },
          }}
        />
      </div>

      <div className={`${mobileSidebarOpen ? 'hidden' : 'flex'} md:flex flex-1 min-h-0 relative md:h-full`}>
        <MapView
          facilities={facility.filteredFacilities}
          allFacilities={facility.facilities}
          layers={layers.layers}
          typeFilters={filters.filters.types}
          countyFilters={filters.filters.counties}
          serviceCategoryFilters={filters.filters.serviceCategories}
          filters={filters.filters}
          onFacilityClick={(f) => onEntity({ type: 'facility', facility: f })}
          onMapClick={onMapBackgroundClick}
          searchQuery={filters.searchQuery}
          radiusKm={layers.radiusKm}
          coverageRadius={layers.coverageRadius}
          coverageGaps={layers.coverageGaps}
          onEntityClick={onEntity}
          selectedCounty={selection.selectedCounty}
          onFteHubClick={selection.actions.handleFteHubClick}
          selectedFteId={selection.activeFteId}
          selectedTransitProviderId={selection.lockedEntity?.type === 'localTransitProvider' ? selection.lockedEntity.provider.id : null}
          activeFteCoverageIds={selection.activeFteCoverageIds}
          coverageRadiusKm={layers.coverageRadiusKm}
          topProvidersOnly={filters.topProvidersOnly}
          engagementRateBelow20Only={filters.engagementRateBelow20Only}
          engagementGapView={layers.engagementGapView}
          responseCapabilityVisible={zoneFilters.responseCapability}
          memberLocation={member.memberLocation}
          memberAnalysis={member.analysis}
          onMemberPlace={member.placeMember}
          onMemberClear={() => {
            // Clearing the member address (X button) must only remove the
            // member pin/analysis. The detail-panel "Member Access" card is a
            // derived view of `member.analysis`, so it vanishes automatically
            // when analysis becomes null. We must NOT call
            // `selection.actions.clearSelection()` here because that would
            // also wipe any unrelated locked entity (county / provider /
            // service / BH / FTE) and the multi-select FTE coverage overlay
            // set the user explicitly enabled from the sidebar.
            member.clearMember();
          }}
          onMemberGeocode={member.geocodeAddress}
          memberIsGeocoding={member.isGeocoding}
          memberGeocodeError={member.geocodeError}
          memberManualMode={member.manualPlacementMode}
          focusBounds={focusBounds}
          presentationIsPresenting={presentation.isPresenting}
          decisionAssistOpen={decisionAssistOpen}
          presentationPhase={presentation.phase}
          onPresentationToggle={presentation.toggle}
          onPresentationPhaseChange={presentation.setPhase}
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
            // Closing a detail panel never clears the member pin. The pin is
            // only removed by the address search bar's clear ("X") or by
            // entering a new address.
            selection.actions.clearSelection();
          }}
          coverageRadiusKm={layers.coverageRadiusKm}
          memberLocation={member.memberLocation}
          utilizationToggles={{
            countyUtilization: layers.layers.countyUtilization,
            providerUtilizationReach: layers.layers.providerUtilizationReach,
            tribalUtilization: layers.layers.tribalUtilization,
            tribalNations: layers.layers.tribalNations,
          }}
          onProviderClick={onProviderClickFromUtilization}
          onBack={selection.actions.goBack}
          canGoBack={!!selection.previousEntity}
          previousEntity={selection.previousEntity}
          allFacilities={facility.facilities}
          onFacilitySelect={onFacility}
          onServiceSelect={onService}
          liveServices={mergedRuralServices}
        />
        {/* Decision Assist — desktop-only guided intake drawer. Additive.
            Rollback: delete src/components/map/decision-assist/ and remove
            this block plus its import at the top of the file. */}
        <DecisionAssistDrawer
          memberLocation={member.memberLocation}
          facilities={facility.facilities}
          services={mergedRuralServices}
          onFacilitySelect={onFacility}
          isPresenting={presentation.isPresenting}
          onOpenChange={setDecisionAssistOpen}
        />
        <PresentationOverlay
          isPresenting={presentation.isPresenting}
          phase={presentation.phase}
          hasDetailPanel={!!activeEntity}
        />
        <PublicSafeDisclaimer />
      </div>
    </div>
  );
};

export default Index;
