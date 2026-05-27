/**
 * MobileEntry — input-first mobile (<768px) surface.
 *
 * Scope (responsive layout only):
 * - Replaces the legacy mobile sidebar/map split with a single-column,
 *   input-first view: address field, county fallback dropdown, CTA.
 * - After submission, renders the existing Decision Assist intake + result
 *   inline (reuses DecisionAssistIntake + DecisionAssistResultView and
 *   deriveDecisionAssist — derivation logic UNCHANGED).
 * - Below the result, a "View Coverage Map" toggle mounts the existing
 *   MapView + CoverageDetailPanel inline at ~50vh.
 *
 * Boundaries:
 * - No changes to data, coverage tier classification, geocoding, metrics,
 *   or selection logic. All hooks/data come in via props from Index.tsx.
 * - Desktop/laptop layout in Index.tsx is untouched.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import MapView from '@/components/map/MapView';
import DecisionAssistIntake from '@/components/map/decision-assist/DecisionAssistIntake';
import DecisionAssistResultView from '@/components/map/decision-assist/DecisionAssistResult';
import { deriveDecisionAssist } from '@/components/map/decision-assist/deriveDecisionAssist';
import { DOMAIN_LABELS, findNeed } from '@/components/map/decision-assist/decisionAssistTaxonomy';
import type { Domain, Need } from '@/components/map/decision-assist/decisionAssistTypes';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { nevadaCounties } from '@/data/nevada-counties';
import { isPublicSafeModeActive } from '@/hooks/usePublicSafeMode';
import { getCountyForLocation } from '@/utils/countyLookup';
import novumHealthLogo from '@/assets/novumhealth-logo.svg';

interface MobileEntryProps {
  // Member access
  memberLocation: { lat: number; lng: number; address?: string } | null;
  memberIsGeocoding: boolean;
  memberGeocodeError: string | null;
  onMemberGeocode: (address: string) => Promise<void>;
  onMemberClear: () => void;
  memberAnalysis: unknown;
  // Selection
  selectedCounty: string | null;
  onCountySelect: (county: string) => void;
  onClearSelection: () => void;
  // Data + map props (forwarded to MapView as-is)
  facilities: Facility[];
  allFacilities: Facility[];
  services: RuralService[];
  // Pass-throughs (kept minimal — only what MapView needs on mobile)
  mapViewProps: Record<string, unknown>;
  onFacilitySelect: (f: Facility) => void;
}

const MobileEntry = ({
  memberLocation,
  memberIsGeocoding,
  memberGeocodeError,
  onMemberGeocode,
  onMemberClear,
  selectedCounty,
  onCountySelect,
  onClearSelection,
  facilities,
  services,
  mapViewProps,
  onFacilitySelect,
}: MobileEntryProps) => {
  const [address, setAddress] = useState('');
  const [countyChoice, setCountyChoice] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);

  const hasContext = !!memberLocation || !!selectedCounty;

  // Reset Decision Assist intake when context changes (new address/county).
  useEffect(() => {
    setSelectedDomain(null);
    setSelectedNeed(null);
  }, [memberLocation?.lat, memberLocation?.lng, selectedCounty]);

  const handleSubmit = () => {
    const trimmed = address.trim();
    if (trimmed) {
      void onMemberGeocode(trimmed);
    } else if (countyChoice) {
      onCountySelect(countyChoice);
    }
  };

  const handleStartOver = () => {
    setAddress('');
    setCountyChoice('');
    setMapOpen(false);
    setSelectedDomain(null);
    setSelectedNeed(null);
    onMemberClear();
    onClearSelection();
  };

  const sortedCounties = useMemo(
    () => [...nevadaCounties].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const decisionResult = useMemo(() => {
    if (!memberLocation || !selectedDomain || !selectedNeed) return null;
    return deriveDecisionAssist(
      { member: memberLocation, facilities, services },
      selectedDomain,
      selectedNeed,
    );
  }, [memberLocation, facilities, services, selectedDomain, selectedNeed]);

  // After map opens, ask Leaflet to recompute its container size so tiles
  // and county fill render correctly (avoids the 0-height-init blank map).
  useEffect(() => {
    if (!mapOpen) return;
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    return () => window.clearTimeout(t);
  }, [mapOpen]);

  return (
    <div className="flex flex-col w-full min-h-screen bg-background safe-area-top">
      {/* Minimal header — NovumHealth brand lead, with operational subtitle. */}
      <header className="px-4 pt-2 pb-2 bg-card">
        <img
          src={novumHealthLogo}
          alt="NovumHealth"
          className="h-6 w-auto"
        />
        <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
          Nevada Rural Access Operations
        </p>
        {isPublicSafeModeActive() && (
          <span className="mt-1 inline-block rounded-sm border border-border/40 bg-background/60 px-1.5 py-px text-[9px] text-muted-foreground/80">
            Publication-safe operational view
          </span>
        )}
      </header>


      {/* Input column — sits on the same chrome band as the header to mirror
          the desktop sidebar surface (bg-card with a single closing border). */}
      <section className="px-4 pt-3 pb-3 space-y-3 bg-card border-b border-border">
        <div>
          <label htmlFor="member-address" className="block text-[12px] font-medium text-foreground mb-1.5">
            Enter member address to begin
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              id="member-address"
              type="text"
              inputMode="text"
              autoComplete="off"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="123 Main St, Fallon, NV"
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none min-w-0"
              disabled={memberIsGeocoding}
            />
            {memberIsGeocoding && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {memberGeocodeError && (
            <p className="mt-1.5 text-[11px] text-destructive">{memberGeocodeError}</p>
          )}
        </div>

        <div>
          <label htmlFor="county-fallback" className="block text-[12px] font-medium text-foreground mb-1.5">
            Or select a county
          </label>
          <div className="relative">
            <select
              id="county-fallback"
              value={countyChoice}
              onChange={(e) => setCountyChoice(e.target.value)}
              className="w-full appearance-none rounded-md border border-border bg-card px-3 py-2 pr-8 text-[14px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select county</option>
              {sortedCounties.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={memberIsGeocoding || (!address.trim() && !countyChoice)}
          className="w-full rounded-md bg-[hsl(206,62%,47%)] px-3 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50 active:opacity-90"
        >
          {memberIsGeocoding ? 'Locating…' : 'Get Access Pathway'}
        </button>

        {hasContext && (
          <button
            type="button"
            onClick={handleStartOver}
            className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Start over
          </button>
        )}
      </section>

      {/* Context banner */}
      {hasContext && (
        <div className="mx-4 mt-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-[11px] text-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              {memberLocation ? (
                <>
                  <p className="font-medium leading-tight">Member location set</p>
                  {memberLocation.address && (
                    <p className="text-muted-foreground truncate">{memberLocation.address}</p>
                  )}
                </>
              ) : (
                <p className="font-medium leading-tight">County: {selectedCounty}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Assist — only meaningful with a member location */}
      {memberLocation && (
        <section className="mt-3 mx-2 rounded-md border border-border bg-card overflow-hidden">
          <div className="px-3 pt-2.5 pb-1 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Decision Assist</p>
            <p className="text-[11px] text-foreground/80 mt-0.5">Structured intake — no freeform input</p>
          </div>
          <DecisionAssistIntake
            selectedDomain={selectedDomain}
            selectedNeed={selectedNeed}
            onDomainChange={setSelectedDomain}
            onNeedChange={setSelectedNeed}
          />
          {decisionResult && selectedDomain && selectedNeed && (
            <DecisionAssistResultView
              result={decisionResult}
              domainLabel={DOMAIN_LABELS[selectedDomain]}
              needLabel={findNeed(selectedNeed)?.label ?? selectedNeed}
              onFacilitySelect={onFacilitySelect}
            />
          )}
        </section>
      )}

      {/* Collapsible map */}
      {hasContext && (
        <section className="mt-3 mx-2 mb-4 rounded-md border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setMapOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-secondary/50 transition-colors"
            aria-expanded={mapOpen}
          >
            <span className="text-[12px] font-medium text-foreground">View Coverage Map</span>
            {mapOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {mapOpen && (
            <div className="relative w-full" style={{ height: '50vh' }}>
              {/* Mobile curated operational layer set — automatic, opinionated.
                  Overrides whatever desktop default layer state is in the
                  shared store so mobile users get immediate operational
                  readability without a toggle drawer. Embedded map search
                  is suppressed; the entry point lives above the map. */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(() => {
                const base = mapViewProps as any;
                const mobileLayers = {
                  ...(base.layers ?? {}),
                  counties: true,
                  serviceLocations: true,
                  behavioralHealth: true,
                  operationalCoverage: true,
                  services: false,
                  tier1Highlight: false,
                  broadbandAccess: false,
                  cellularCoverage: false,
                  railCorridor: false,
                  localTransitZones: false,
                  tribalNations: false,
                  sshpCatchments: false,
                  utilizationIntensity: false,
                  engagementGap: false,
                  fteCapacity: false,
                };
                const mobileProps = {
                  ...base,
                  layers: mobileLayers,
                  coverageRadius: true,
                  hideEmbeddedSearch: true,
                };
                return <MapView {...mobileProps} />;
              })()}
            </div>
          )}

        </section>
      )}
    </div>
  );
};

export default MobileEntry;
