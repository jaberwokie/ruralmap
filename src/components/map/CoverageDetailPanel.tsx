import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, MapPin, Building2, Stethoscope, Shield, Map as MapIcon, AlertTriangle, Users, Radio, Route, ArrowRight, Navigation, Headphones, ExternalLink, ChevronDown, Copy, Check, Wifi, Signal, Landmark, Brain, TrainFront } from 'lucide-react';
import { ContactPhoneAction, formatPhone } from '@/components/ContactPhoneAction';
import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { Facility, defaultFacilities, getFacilityClassification, getFacilityDataConfidence, getFacilityTypeLabel, isCriticalAccessHospital, isNRHPMember, countyHasHospital } from '@/data/facilities';
import { RuralService } from '@/data/rural-services';
import { enrichedRuralServices as ruralServices } from '@/data/enriched-rural-services';
import { type TribalNation, getSubEntities, getParentTribe } from '@/data/tribal-nations';
import type { RailStation } from '@/data/rail-corridors';
import { type LocalTransitProvider, getProviderZones, LOCAL_TRANSIT_SERVICE_TYPE_LABELS } from '@/data/local-transit-providers';
import { COVERAGE_TYPE_LABELS, COVERAGE_TYPE_DESCRIPTIONS, PRIMARY_RESPONSE_LABELS } from '@/data/operational-coverage';
import { getCountyCoverageBreakdown, kmToMiles } from '@/utils/coverageZones';
import { COUNTY_FTE_MAP, fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS, LoadStatus } from '@/data/fte-capacity';
import { getCountyUtilization, getFacilityUtilization, getUtilizationTier, UTILIZATION_COLORS, OPERATIONAL_READ_COLORS, getCountyEngagementMetrics } from '@/utils/utilizationAggregation';
import { isBehavioralHealthService } from '@/utils/ruralServiceClassification';
import { getCountyBroadband } from '@/data/broadband-coverage';
import { getCountyRemoteFeasibility, getBroadbandOperationalNote, FEASIBILITY_COLORS, READINESS_COLORS } from '@/utils/broadbandFeasibility';
import { getCountyCellular, getReliabilityCategory, READINESS_COLORS as CELLULAR_READINESS_COLORS } from '@/data/cellular-coverage';
import { getCountyMobileFeasibility, getCellularOperationalNote, RELIABILITY_COLORS } from '@/utils/cellularFeasibility';
import { resolveOperationalMeta, PARTICIPATION_STATUS_LABELS, PARTICIPATION_STATUS_COLORS } from '@/types/medicaid';
import { getOperationalTagIndex } from '@/data/operational-metadata';
import type { ServiceOperationalMeta } from '@/types/medicaid';
import { compareEntitiesByOperationalPriority } from '@/utils/entitySortOrder';
import { ROUTING_TIER_COLORS, VERIFICATION_SIGNAL_COLORS } from '@/utils/statusColors';
import MemberAccessPanelLazy from '@/components/map/MemberAccessPanel';
import { checkHighwayAccess } from '@/utils/highwayProximity';
import {
  resolvePsychiatryBadge, resolveInpatientBadge,
  hasPsychiatricData, hasInpatientData,
  PSYCHIATRY_BADGE_COLORS, INPATIENT_BADGE_COLORS,
  REFERRAL_PATHWAY_LABELS, BED_AVAILABILITY_LABELS, TRANSFER_DEPENDENCY_LABELS,
  derivePsychiatricAccess, deriveInpatientAccess, OPERATIONAL_ACCESS_LABELS,
  derivePsychiatricFreshness, deriveInpatientFreshness, FRESHNESS_LABELS,
} from '@/types/service-lines';
import { deriveCountyFallback, PSYCH_FALLBACK_REASON_LABELS, INPATIENT_FALLBACK_REASON_LABELS } from '@/utils/countyFallbackAccess';
import { deriveVerificationQueue as deriveVerificationQueueFn } from '@/utils/verificationPriorityQueue';
import { deriveLastDirectlyVerified as deriveLastDirectlyVerifiedFn } from '@/utils/verificationAuditLog';
import { formatDisplayValue, formatTagLabel } from '@/utils/displayFormat';

/** Counties with no hospital or clinic within ~50 km of their geographic center */
const GAP_COUNTIES = (() => {
  const R = 50;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const countyCenters: Record<string, [number, number]> = {
    Esmeralda: [37.78, -117.63], Mineral: [38.54, -118.43], Lincoln: [37.64, -114.87],
    Eureka: [39.98, -116.00], Storey: [39.44, -119.53], Pershing: [40.56, -118.40],
    Lander: [40.07, -117.04],
  };
  const coverageFacilities = defaultFacilities.filter(f => f.type === 'hospital' || f.type === 'clinic');
  const gaps = new Set<string>();
  for (const [name, [lat, lng]] of Object.entries(countyCenters)) {
    const nearest = Math.min(...coverageFacilities.map(f => haversine(lat, lng, f.lat, f.lng)));
    if (nearest > R) gaps.add(name);
  }
  return gaps;
})();

import type { MapEntity } from '@/types/entities';

interface CoverageDetailPanelProps {
  entity: MapEntity | null;
  onClear: () => void;
  coverageRadiusKm?: number;
  memberLocation?: { lat: number; lng: number } | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Coordinated Entry': 'bg-purple-100 text-purple-700',
  'Shelter': 'bg-orange-100 text-orange-700',
  'Supportive Housing': 'bg-amber-100 text-amber-700',
  'Legal': 'bg-slate-100 text-slate-700',
  'Housing (Low-Income)': 'bg-yellow-100 text-yellow-700',
  'Recovery/Boarding': 'bg-rose-100 text-rose-700',
  'Food': 'bg-green-100 text-green-700',
  'Family Services': 'bg-blue-100 text-blue-700',
  'Senior Services': 'bg-teal-100 text-teal-700',
  'Employment': 'bg-indigo-100 text-indigo-700',
  'Disability Services': 'bg-cyan-100 text-cyan-700',
  'Physical Health': 'bg-red-100 text-red-700',
  'Substance Use': 'bg-pink-100 text-pink-700',
  'Mental Health': 'bg-violet-100 text-violet-700',
};

const COUNTY_SERVICE_COUNT = ruralServices.reduce((map, service) => {
  map.set(service.county, (map.get(service.county) ?? 0) + 1);
  return map;
}, new Map<string, number>());

const GapContextAlerts = ({ county, serviceCount }: { county: string; serviceCount: number }) => {
  if (!GAP_COUNTIES.has(county)) return null;

  return (
    <>
      <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
        <span className="text-[11px] font-semibold text-destructive">No hospital coverage within 31 mi</span>
      </div>
      {serviceCount > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
          <span className="text-[11px] font-medium text-foreground">Services present but limited access</span>
        </div>
      )}
    </>
  );
};

/** Coverage Breakdown badge for county-based entities (FTE drive-time model) */
const CoverageBreakdownBadge = ({ county, coverageRadiusKm }: { county: string; coverageRadiusKm: number }) => {
  const breakdown = getCountyCoverageBreakdown(county, coverageRadiusKm);

  // Determine if county is remote-only based on FTE assignments
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  const hasField = serving.some(f => f.hubLocation !== null);
  const isRemoteOnly = serving.length === 0 || !hasField;

  // Override breakdown for remote-only counties
  const activePercent = isRemoteOnly ? 0 : breakdown.activePercent;
  const scheduledPercent = isRemoteOnly ? 0 : breakdown.scheduledPercent;

  return (
    <div className="rounded-md border border-teal-200 bg-teal-50/50 px-2 py-1.5 mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Radio className="w-3 h-3 flex-shrink-0 text-teal-700" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">Coverage Breakdown</span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">Active Field Coverage</span>
          <span className="font-bold text-teal-800">{activePercent}%</span>
        </div>
        {!isRemoteOnly && (
          <div className="flex justify-between text-[11px]">
            <span className="text-teal-600">Scheduled Outreach</span>
            <span className="font-bold text-teal-700">{scheduledPercent}%</span>
          </div>
        )}
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Telehealth / Remote</span>
          <span className="font-medium text-muted-foreground">100%</span>
        </div>
      </div>
      {breakdown.anchoringFtes.length > 0 && (
        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-teal-100">
          <Users className="w-3 h-3 flex-shrink-0 text-teal-600 opacity-70" />
          <span className="text-[10px] text-teal-700">{breakdown.anchoringFtes.join(', ')}</span>
        </div>
      )}
    </div>
  );
};

/** Capacity Status section for county panel */
const CapacityStatusSection = ({ county }: { county: string }) => {
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  if (serving.length === 0) return null;

  // Show all assigned FTEs
  return (
    <div className="space-y-1.5 mb-2">
      {serving.map(fte => {
        const role = FTE_ROLE_COLORS[fte.id];
        const coverageLabel = fte.hubLocation ? 'Active Field Coverage' : 'Remote Only';
        return (
          <div key={fte.id} className={`rounded-md border-2 px-2 py-1.5 ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-border'}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role?.primary }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Assigned FTE</span>
            </div>
            <div className="text-[11px] font-medium text-foreground">{fte.label} — {coverageLabel}</div>
          </div>
        );
      })}
    </div>
  );
};

const haversineKmLocal = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getMemberTierLabel = (mi: number) =>
  mi <= 10 ? 'Local Access' : mi <= 25 ? 'Managed Access' : mi <= 40 ? 'High Friction' : 'Non-Viable';

const TIER_LABEL_COLOR: Record<string, string> = {
  'Local Access': 'text-green-600',
  'Managed Access': 'text-amber-600',
  'High Friction': 'text-red-500',
  'Non-Viable': 'text-muted-foreground',
};


const MemberDistanceBadge = ({ memberLocation, targetLat, targetLng }: { memberLocation: { lat: number; lng: number }; targetLat: number; targetLng: number }) => {
  const km = haversineKmLocal(memberLocation.lat, memberLocation.lng, targetLat, targetLng);
  const mi = Math.round(km * 0.621371 * 10) / 10;
  const tier = getMemberTierLabel(mi);
  const memberHw = checkHighwayAccess(memberLocation.lat, memberLocation.lng);
  const targetHw = checkHighwayAccess(targetLat, targetLng);
  const sharedCorridor = memberHw.hasAccess && targetHw.hasAccess && memberHw.corridor?.id === targetHw.corridor?.id;
  const targetOnHighway = targetHw.hasAccess;
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-[10px]">
        <Navigation className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-foreground">{mi.toFixed(1)} mi from member</span>
        <span className="text-muted-foreground">·</span>
        <span className={`font-medium ${TIER_LABEL_COLOR[tier]}`}>{tier}</span>
      </div>
      {sharedCorridor && (
        <div className="flex items-center gap-1 mt-1 px-2 text-[9px] text-muted-foreground/70">
          <Route className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Direct {targetHw.corridor?.label} highway access improves travel reliability</span>
        </div>
      )}
      {!sharedCorridor && targetOnHighway && (
        <div className="flex items-center gap-1 mt-1 px-2 text-[9px] text-muted-foreground/70">
          <Route className="w-2.5 h-2.5 flex-shrink-0" />
          <span>Accessible via {targetHw.corridor?.label}</span>
        </div>
      )}
    </div>
  );
};

const CoverageDetailPanel = ({ entity, onClear, coverageRadiusKm = 120, memberLocation }: CoverageDetailPanelProps) => {
  const display = entity;
  const isLocked = !!entity;

  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClear();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, onClear]);

  if (!display) return null;

  return (
    <div
      data-tutorial="details-panel"
      className="absolute top-3 right-3 z-[1000] flex max-h-[calc(100vh-120px)] w-64 select-none flex-col rounded-lg border border-border bg-card/95 shadow-md backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2 flex-shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </h3>
        {isLocked && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClear();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Close details panel"
            title="Close details"
          >
            <X className="h-4 w-4 stroke-[1.75]" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-3 pb-3">
        {memberLocation && display.type === 'facility' && (
          <MemberDistanceBadge memberLocation={memberLocation} targetLat={display.facility.lat} targetLng={display.facility.lng} />
        )}
        {memberLocation && display.type === 'ruralService' && (
          <MemberDistanceBadge memberLocation={memberLocation} targetLat={display.service.lat} targetLng={display.service.lng} />
        )}
        <EntityContent entity={display} coverageRadiusKm={coverageRadiusKm} />
      </div>
    </div>
  );
};

// ── Renderer per entity type ──

const EntityContent = ({ entity, coverageRadiusKm }: { entity: MapEntity; coverageRadiusKm: number }) => {
  switch (entity.type) {
    case 'coverageArea': return <CoverageAreaContent area={entity.area} />;
    case 'county': return <CountyContent county={entity.county} coverageRadiusKm={coverageRadiusKm} />;
    case 'facility': return <FacilityContent facility={entity.facility} />;
    case 'coverageGap': return <CoverageGapContent radiusKm={entity.radiusKm} />;
    case 'memberVolume': return <MemberVolumeContent county={entity.county} memberCount={entity.memberCount} coverageRadiusKm={coverageRadiusKm} />;
    case 'ruralServiceGroup': return <RuralServiceGroupContent county={entity.county} services={entity.services} coverageRadiusKm={coverageRadiusKm} />;
    case 'ruralService': return <RuralServiceContent service={entity.service} />;
    case 'fteDetail': return <FteDetailContent fteId={entity.fteId} />;
    case 'tribalNation': return <TribalNationContent tribe={entity.tribe} />;
    case 'railStation': return <RailStationContent station={entity.station} />;
    case 'localTransitProvider': return <LocalTransitProviderContent provider={entity.provider} />;
    case 'memberAccess': return <MemberAccessPanelLazy analysis={entity.analysis} />;
    default: return null;
  }
};

// ── FTE Detail (unified for all FTEs) ──
const FTE_META: Record<string, { icon: typeof MapPin; coverageType: string; description: string; role: string }> = {
  carson: {
    icon: MapPin,
    coverageType: 'Active Field Coverage',
    description: 'Same-day in-person response available',
    role: 'Field response, engagement, and placement coordination',
  },
  pahrump: {
    icon: MapPin,
    coverageType: 'Active Field Coverage',
    description: 'Same-day in-person response available',
    role: 'Field response, engagement, and placement coordination',
  },
  remote: {
    icon: Headphones,
    coverageType: 'Remote Support Only',
    description: 'Statewide telephonic and virtual coordination (no in-person response)',
    role: 'Intake, routing, telehealth coordination, and referral management',
  },
};

const FteDetailContent = ({ fteId }: { fteId: string }) => {
  const fte = fteCapacityData.find(f => f.id === fteId);
  if (!fte) return null;

  const meta = FTE_META[fteId];
  if (!meta) return null;

  const roleColors = FTE_ROLE_COLORS[fte.id];
  const Icon = meta.icon;
  const isRemote = !fte.hubLocation;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: roleColors?.primary }} />
        <span className="text-sm font-bold text-foreground">{fte.label}</span>
      </div>

      <div className={`rounded-md border px-2 py-1.5 ${roleColors?.light ?? 'bg-secondary'} ${roleColors?.border ?? 'border-border'}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Coverage Type</div>
        <div className="text-[11px] font-medium text-foreground">{meta.coverageType}</div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {meta.description}
      </p>

      {/* Geographic Footprint — always shown */}
      <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Geographic Footprint</div>
        <p className="text-[11px] text-foreground leading-relaxed">
          {isRemote ? 'None – remote coordination only.' : `Field-based coverage from ${fte.label.replace(' FTE', '')} hub.`}
        </p>
      </div>

      <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Operational Status</div>
        <p className="text-[11px] text-muted-foreground italic">
          Detailed engagement capacity counts are not currently available.
        </p>
      </div>

      <div className="rounded-md border border-border bg-secondary px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Role</div>
        <p className="text-[11px] text-foreground leading-relaxed">
          {meta.role}
        </p>
      </div>

      <div className="rounded-md border border-border bg-secondary px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">
          {isRemote ? 'Supported Counties' : 'Counties Served'}
        </div>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {fte.counties.map(c => (
            <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground/80">{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Coverage Area ──
const CoverageAreaContent = ({ area }: { area: CoverageArea }) => {
  const volumeMap = useMemo(() => new Map(memberVolumeData.map(d => [d.county, d.memberCount])), []);
  const counties = useMemo(() => nevadaCounties.filter(c => c.zone === area), [area]);
  const rows = useMemo(() => counties.map(c => ({
    name: c.name,
    count: volumeMap.get(c.name) ?? 0,
    secondaryZone: c.secondaryZone,
  })), [counties, volumeMap]);
  const total = rows.reduce((s, r) => s + r.count, 0);

  const areaColor = area === 'area1' ? 'hsl(142, 71%, 45%)' : area === 'area2' ? 'hsl(35, 92%, 50%)' : 'hsl(217, 91%, 60%)';

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: areaColor }}>
        ● Coverage Area
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">{COVERAGE_AREA_LABELS[area]}</p>
      <div className="space-y-0.5">
        {rows.map(r => (
          <div key={r.name}>
            <div className="flex justify-between text-xs text-foreground/80">
              <span>{r.name}</span>
              <span className="font-medium tabular-nums">{r.count.toLocaleString()}</span>
            </div>
            {r.secondaryZone && (
              <div className="text-[10px] text-muted-foreground italic ml-1">
                Routing: Primary Area {area.replace('area', '')}, Supported by Area {r.secondaryZone.replace('area', '')}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between text-xs font-semibold text-foreground">
        <span>Total</span>
        <span className="tabular-nums">{total.toLocaleString()}</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between text-xs text-foreground/80">
        <span>Rural Access Dependence</span>
        <span className="font-semibold">{RURAL_ACCESS_DEPENDENCE[area]}</span>
      </div>
    </>
  );
};

const ActionStep = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex items-start gap-1.5">
    <span className="text-[10px] font-bold text-primary mt-px">{n}</span>
    <div className="text-[10px] text-foreground/80 space-y-0.5">{children}</div>
  </div>
);

// ── NBH Routing ──
const NBHRoutingSection = ({ county, coverageRadiusKm }: { county: string; coverageRadiusKm: number }) => {
  const breakdown = getCountyCoverageBreakdown(county, coverageRadiusKm);
  const serviceCount = COUNTY_SERVICE_COUNT.get(county) ?? 0;
  const hasServices = serviceCount > 0;
  const sparseThreshold = 3;

  // Determine actual FTE-based coverage type
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  const hasField = serving.some(f => f.hubLocation !== null);
  const hasRemote = serving.some(f => f.hubLocation === null);
  const coverageType = serving.length === 0 ? 'remote' : hasField && hasRemote ? 'mixed' : hasField ? 'active' : 'remote';
  const isRemoteOnly = coverageType === 'remote';

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Route className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
          {isRemoteOnly ? 'Remote Coordination' : 'NBH Routing'}
        </span>
      </div>

      {/* Coverage-based routing info */}
      {coverageType === 'active' ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 mb-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-teal-800">
            {breakdown.anchoringFtes.length > 0 ? breakdown.anchoringFtes[0] : 'Field FTE'}
          </div>
          <div className="text-[10px] text-teal-700">Same-day field response available ({breakdown.activePercent}% active coverage)</div>
          <div className="text-[10px] text-teal-700 italic">Primary: in-person engagement + direct placement coordination</div>
        </div>
      ) : coverageType === 'mixed' ? (
        <div className="rounded-md border border-teal-200 bg-teal-50/80 px-2 py-1.5 mb-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-teal-700">
            {breakdown.anchoringFtes.length > 0 ? breakdown.anchoringFtes[0] : 'Mixed Coverage'}
          </div>
          <div className="text-[10px] text-teal-600">Field and remote coverage available ({breakdown.activePercent}% active)</div>
          <div className="text-[10px] text-teal-600 italic">Primary: in-person when feasible, remote support to bridge gaps</div>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 mb-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-foreground">Remote Coordination</div>
          <div className="text-[10px] text-muted-foreground">Remote triage and coordination only. No routine field-based outreach is currently available in this county.</div>
        </div>
      )}

      {/* Recommended Action Path — dynamic by coverage type */}
      <div className="mt-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-foreground mb-1">Recommended Action Path</div>
        <div className="space-y-1">
          {coverageType === 'active' ? (
            <>
              <ActionStep n={1}>In-person engagement</ActionStep>
              <ActionStep n={2}>Stabilize using local services</ActionStep>
              <ActionStep n={3}>
                <div>Escalate if needed:</div>
                <div className="pl-2 space-y-0.5 text-muted-foreground">
                  <div>• Transfer to Las Vegas or Reno</div>
                  <div>• Telehealth support</div>
                  <div>• Schedule outreach</div>
                </div>
              </ActionStep>
            </>
          ) : coverageType === 'mixed' ? (
            <>
              <ActionStep n={1}>Attempt in-person engagement when feasible</ActionStep>
              <ActionStep n={2}>Use remote support to bridge gaps</ActionStep>
              <ActionStep n={3}>Stabilize using local services</ActionStep>
              <ActionStep n={4}>
                <div>Escalate if needed:</div>
                <div className="pl-2 space-y-0.5 text-muted-foreground">
                  <div>• Transfer to Las Vegas or Reno</div>
                  <div>• Telehealth support</div>
                  <div>• Schedule outreach</div>
                </div>
              </ActionStep>
            </>
          ) : (
            <>
              <ActionStep n={1}>Remote engagement (primary)</ActionStep>
              <ActionStep n={2}>Stabilize using local services</ActionStep>
              <ActionStep n={3}>Schedule outreach only if field capacity becomes available</ActionStep>
              <ActionStep n={4}>
                <div>Escalate if needed:</div>
                <div className="pl-2 space-y-0.5 text-muted-foreground">
                  <div>• Transfer to Las Vegas or Reno</div>
                  <div>• Telehealth support</div>
                  <div>• Coordinated transport if appropriate</div>
                </div>
              </ActionStep>
            </>
          )}
        </div>
      </div>

      {/* Rural Services tie-in */}
      <div className="mt-2 rounded-md border border-border bg-secondary/50 px-2 py-1.5">
        {hasServices && serviceCount > sparseThreshold ? (
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-[10px] text-foreground/80">Local services available (see below)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
            <span className="text-[10px] text-foreground/80">Limited local services — external coordination required</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Utilization & Engagement Section (county-level) ──
const UtilizationEngagementSection = ({ county }: { county: string }) => {
  const util = getCountyUtilization(county);
  if (util.activeProviderCount === 0 && util.totalVisits === 0) return null;

  const tier = getUtilizationTier(util.avgVisitsPerMember);
  const readColor = OPERATIONAL_READ_COLORS[util.operationalRead] ?? 'text-foreground';

  // ── New utilization metrics ──
  const providers = util.activeProviderCount;
  const members = util.totalMembers;
  const encounters = util.totalVisits;

  const membersPerProvider = providers > 0 ? (members / providers) : null;
  const encountersPerMember = members > 0 ? (encounters / members) : null;
  const encountersPerProvider = providers > 0 ? (encounters / providers) : null;
  const providerDensity = members > 0 ? (providers / members) * 1000 : null;

  // Top Provider Share: top 2 (or 1) providers' visits / total encounters
  const topProviderVisits = util.topProviders.slice(0, Math.min(2, util.topProviders.length)).reduce((s, p) => s + p.visits, 0);
  const topProviderShare = encounters > 0 ? (topProviderVisits / encounters) * 100 : null;

  // Interpretation
  const mppHigh = membersPerProvider !== null && membersPerProvider > 150;
  const epmHigh = encountersPerMember !== null && encountersPerMember > 10;
  let interpretation = '';
  if (mppHigh && epmHigh) interpretation = 'High provider strain with active engagement.';
  else if (mppHigh && !epmHigh) interpretation = 'Access gap: demand exceeds engagement.';
  else if (!mppHigh && epmHigh) interpretation = 'Strong local utilization with available capacity.';
  else interpretation = 'Low engagement and low demand.';
  if (topProviderShare !== null && topProviderShare > 60) interpretation += ' High dependency on a single provider.';

  const fmt1 = (v: number | null) => v !== null ? v.toFixed(1) : 'N/A';

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Utilization & Engagement</span>
      </div>
      <div className="rounded-md border border-purple-200 bg-purple-50/50 px-2 py-1.5 space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Members</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.totalMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Visits</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.totalVisits.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Avg Visits/Member</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.avgVisitsPerMember}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Active Providers</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.activeProviderCount}</span>
        </div>
        {util.topProviders.length > 0 && (
          <div className="pt-1 border-t border-purple-100 mt-1">
            <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Top Providers</div>
            {util.topProviders.map((p, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-purple-700 truncate mr-1">{i + 1}. {p.name}</span>
                <span className="text-purple-800 tabular-nums flex-shrink-0">{p.visits.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Utilization Metrics subsection ── */}
        <div className="pt-1.5 border-t border-purple-100 mt-1.5">
          <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Utilization Metrics</div>
          {providers === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No active providers mapped for this county</p>
          ) : (
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-700">Members per Provider</span>
                <span className="font-bold text-purple-800 tabular-nums">{fmt1(membersPerProvider)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-700">Encounters per Member</span>
                <span className="font-bold text-purple-800 tabular-nums">{fmt1(encountersPerMember)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-700">Encounters per Provider</span>
                <span className="font-bold text-purple-800 tabular-nums">{fmt1(encountersPerProvider)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-700">Provider Density (per 1k)</span>
                <span className="font-bold text-purple-800 tabular-nums">{fmt1(providerDensity)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-700">Top Provider Share</span>
                <span className="font-bold text-purple-800 tabular-nums">{topProviderShare !== null ? topProviderShare.toFixed(1) + '%' : 'N/A'}</span>
              </div>
            </div>
          )}
          <p className="text-[10px] text-purple-600 italic leading-relaxed mt-1">{interpretation}</p>
        </div>

        {/* ── Provider Network Risk ── */}
        <div className="pt-1.5 border-t border-purple-100 mt-1.5">
          <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Provider Network Risk</div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-purple-700">Total Providers</span>
              <span className="font-bold text-purple-800 tabular-nums">{providers}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-purple-700">Top Provider Share</span>
              <span className="font-bold text-purple-800 tabular-nums">{topProviderShare !== null ? topProviderShare.toFixed(1) + '%' : 'N/A'}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-purple-700">Network Depth</span>
              <span className={`font-bold ${providers <= 1 ? 'text-red-700' : providers <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {providers === 0 ? 'No providers' : providers === 1 ? 'Single point of failure' : providers <= 3 ? 'Limited network depth' : 'Distributed network'}
              </span>
            </div>
            {topProviderShare !== null && topProviderShare > 60 && (
              <p className="text-[10px] text-orange-600 italic">High dependency on a single provider</p>
            )}
          </div>
        </div>

        {/* ── Access Reality ── */}
        {(() => {
          const countyFacs = defaultFacilities.filter(f => f.county === county);
          const hasInPerson = countyFacs.some(f => f.type === 'hospital' || f.type === 'clinic');

          // Nearest in-person care logic
          let nearestCare = 'Regional hub access required';
          if (hasInPerson) {
            nearestCare = 'Available within county';
          } else {
            // Check adjacent counties via facilities
            const ADJACENT: Record<string, string[]> = {
              'Esmeralda': ['Nye', 'Mineral'],
              'Mineral': ['Lyon', 'Churchill', 'Nye', 'Esmeralda'],
              'Storey': ['Washoe', 'Lyon', 'Carson City'],
              'Pershing': ['Humboldt', 'Lander', 'Churchill'],
              'Eureka': ['Lander', 'White Pine', 'Elko'],
              'Lincoln': ['Nye', 'White Pine', 'Clark'],
              'Douglas': ['Carson City', 'Lyon', 'Washoe'],
            };
            const adj = ADJACENT[county] ?? [];
            const adjHasProvider = adj.some(c => defaultFacilities.some(f => f.county === c && (f.type === 'hospital' || f.type === 'clinic')));
            if (adjHasProvider) nearestCare = 'Available in adjacent county';
          }

          const accessType = hasInPerson ? 'In-person available' : providers > 0 ? 'Telehealth only' : 'Mixed or unknown';

          return (
            <div className="pt-1.5 border-t border-purple-100 mt-1.5">
              <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Access Reality</div>
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-purple-700">Access Type</span>
                  <span className={`font-bold ${hasInPerson ? 'text-emerald-700' : 'text-orange-700'}`}>{accessType}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-purple-700">Nearest In-Person Care</span>
                  <span className={`font-bold ${nearestCare === 'Available within county' ? 'text-emerald-700' : nearestCare === 'Available in adjacent county' ? 'text-amber-700' : 'text-red-700'}`}>
                    {nearestCare}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Engagement Signal ── */}
        <div className="pt-1.5 border-t border-purple-100 mt-1.5">
          <div className="text-[10px] text-purple-600 font-semibold mb-0.5">Engagement Signal</div>
          <p className="text-[10px] text-purple-700 italic leading-relaxed">
            {encountersPerMember !== null && encountersPerMember <= 5 && providers > 0
              ? 'Engagement gap likely (services exist but underutilized)'
              : mppHigh && epmHigh
              ? 'High provider strain with active engagement'
              : !mppHigh && epmHigh
              ? 'Healthy utilization with available capacity'
              : 'Low demand or limited engagement'}
          </p>
        </div>

        {/* ── Data Confidence ── */}
        {(() => {
          const confidence = encounters > 200 && providers >= 3 ? 'High' : (encounters > 50 || providers === 2) ? 'Moderate' : 'Limited';
          const confColor = confidence === 'High' ? 'text-emerald-700' : confidence === 'Moderate' ? 'text-amber-700' : 'text-red-700';
          return (
            <div className="pt-1.5 border-t border-purple-100 mt-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-purple-600 font-semibold">Data Confidence</span>
                <span className={`font-bold ${confColor}`}>{confidence}</span>
              </div>
            </div>
          );
        })()}

        <div className="pt-1 border-t border-purple-100 mt-1 space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-purple-700">Engagement Support</span>
            <span className={`font-bold ${util.hasEngagementSupport ? 'text-emerald-700' : 'text-orange-700'}`}>
              {util.hasEngagementSupport ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-purple-700">Operational Read</span>
            <span className={`font-bold ${readColor}`}>{util.operationalRead}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Facility Utilization Section ──
const FacilityUtilizationSection = ({ facility }: { facility: Facility }) => {
  const util = getFacilityUtilization(facility);
  if (!util) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Utilization Metrics</span>
      </div>
      <div className="rounded-md border border-purple-200 bg-purple-50/50 px-2 py-1.5 space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Provider Rank</span>
          <span className="font-bold text-purple-800">#{util.rank}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Members</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.totalMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Visits</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.totalVisits.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Visits per Member</span>
          <span className="font-bold text-purple-800 tabular-nums">{util.visitsPerMember}</span>
        </div>
      </div>
    </div>
  );
};

// ── Rich Member Volume Section (conditional on layer) ──
const MemberVolumeSection = ({ county }: { county: string }) => {
  const volumeMap = useMemo(() => new Map(memberVolumeData.map(d => [d.county, d.memberCount])), []);
  const memberCount = volumeMap.get(county) ?? 0;
  const totalMembers = memberVolumeData.reduce((s, d) => s + d.memberCount, 0);
  const maxCount = Math.max(...memberVolumeData.map(d => d.memberCount));
  const medianCount = (() => {
    const sorted = [...memberVolumeData].sort((a, b) => a.memberCount - b.memberCount);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid].memberCount : Math.round((sorted[mid - 1].memberCount + sorted[mid].memberCount) / 2);
  })();
  const intensity = maxCount > 0 ? memberCount / maxCount : 0;
  const volumeLevel = intensity > 0.66 ? 'High' : intensity > 0.33 ? 'Moderate' : 'Low';
  const sharePercent = totalMembers > 0 ? ((memberCount / totalMembers) * 100).toFixed(1) : '0';
  const ranked = [...memberVolumeData].sort((a, b) => b.memberCount - a.memberCount);
  const rank = ranked.findIndex(d => d.county === county) + 1;
  const diffFromMax = maxCount - memberCount;

  if (memberCount === 0) {
    return (
      <div className="mt-2 mb-2 rounded-md border border-border bg-secondary/50 px-2 py-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">Member Volume</div>
        <p className="text-[11px] text-muted-foreground italic">No member volume data available</p>
      </div>
    );
  }

  const interpretation = intensity > 0.66
    ? 'This county has one of the highest member concentrations in the rural market.'
    : intensity > 0.33
    ? 'This county has a moderate member concentration relative to the rural market.'
    : 'This county has low member volume relative to the rest of the rural market.';

  const levelColor = volumeLevel === 'High' ? 'text-teal-800' : volumeLevel === 'Moderate' ? 'text-teal-700' : 'text-teal-600';

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Users className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(190, 60%, 40%)' }} />
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'hsl(190, 60%, 40%)' }}>Member Volume</span>
      </div>
      <div className="rounded-md border border-teal-200 bg-teal-50/50 px-2 py-1.5 space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">Total Members</span>
          <span className="font-bold text-teal-800 tabular-nums">{memberCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">Volume Level</span>
          <span className={`font-bold ${levelColor}`}>{volumeLevel}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">County Share</span>
          <span className="font-bold text-teal-800 tabular-nums">{sharePercent}%</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">Volume Rank</span>
          <span className="font-bold text-teal-800">#{rank} of {memberVolumeData.length}</span>
        </div>
        <div className="pt-1 border-t border-teal-100 mt-1 space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-teal-600">vs. Median ({medianCount.toLocaleString()})</span>
            <span className="font-medium text-teal-700 tabular-nums">{memberCount >= medianCount ? '+' : ''}{(memberCount - medianCount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-teal-600">vs. Highest ({maxCount.toLocaleString()})</span>
            <span className="font-medium text-teal-700 tabular-nums">-{diffFromMax.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-[10px] text-teal-600 italic leading-relaxed pt-1 border-t border-teal-100 mt-1">
          {interpretation}
        </p>
      </div>
    </div>
  );
};

const EngagementPriorityCard = ({ county }: { county: string }) => {
  const metrics = getCountyEngagementMetrics(county);

  if (metrics.totalMembers <= 0) return null;

  const engagementRatePercent = (metrics.engagementRate * 100).toFixed(1);
  const highlight = metrics.isTop5Unengaged;

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${highlight ? 'text-destructive' : 'text-foreground'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wide ${highlight ? 'text-destructive' : 'text-foreground'}`}>Engagement Priority</span>
      </div>
      <div className={`rounded-md border px-2 py-1.5 space-y-0.5 ${highlight ? 'border-destructive/25 bg-destructive/10' : 'border-border bg-secondary/60'}`}>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Rank</span>
          <span className={`font-bold ${highlight ? 'text-destructive' : 'text-foreground'}`}>#{metrics.rank} highest gap</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Total Members</span>
          <span className="font-bold text-foreground tabular-nums">{metrics.totalMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Engaged Members</span>
          <span className="font-bold text-foreground tabular-nums">{metrics.engagedMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Unengaged Members</span>
          <span className={`font-bold tabular-nums ${highlight ? 'text-destructive' : 'text-foreground'}`}>{metrics.unengagedMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Engagement Rate</span>
          <span className={`font-bold tabular-nums ${metrics.engagementRate < 0.2 ? 'text-destructive' : 'text-foreground'}`}>{engagementRatePercent}%</span>
        </div>
        <p className={`pt-1 mt-1 border-t text-[10px] italic leading-relaxed ${highlight ? 'border-destructive/15 text-destructive' : 'border-border text-muted-foreground'}`}>
          {highlight
            ? 'Top 5 county by unengaged population — prioritize outreach and field deployment.'
            : metrics.engagementRate < 0.2
            ? 'Below the 20% engagement threshold — consider targeted outreach planning.'
            : 'Use alongside utilization gap signals to prioritize outreach sequencing.'}
        </p>
      </div>
    </div>
  );
};

/** Field Capacity section — aggregates all FTEs serving a county */
const FieldCapacitySection = ({ county }: { county: string }) => {
  const serving = fteCapacityData.filter(f => f.counties.includes(county));

  // No FTEs at all — hide section
  if (serving.length === 0) return null;

  const hasField = serving.some(f => f.hubLocation !== null);
  const hasRemote = serving.some(f => f.hubLocation === null);
  const isRemoteOnly = !hasField;
  const coverageType = hasField && hasRemote ? 'Mixed' : hasField ? 'In-person available' : 'Remote only';

  // Remote-only counties: show as "Regional FTE Support" instead of "Field Capacity"
  const sectionTitle = isRemoteOnly ? 'Regional FTE Support' : 'Field Capacity';

  return (
    <div className="rounded-md border px-2 py-1.5 mb-2 bg-secondary/50 border-border">
      <div className="flex items-center gap-1.5 mb-1">
        <Users className="w-3 h-3 flex-shrink-0 text-foreground/70" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">{sectionTitle}</span>
      </div>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-foreground/80">FTEs Serving</span>
          <span className="font-semibold text-foreground">{serving.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/80">Coverage Type</span>
          <span className="font-medium text-foreground">{coverageType}</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground italic mt-1">
        {isRemoteOnly
          ? 'No locally assigned field staff. Support is coordinated remotely or from regional hubs.'
          : 'Detailed engagement capacity counts are not currently available for this county.'}
      </p>
      <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-border/50">
        {serving.map(f => {
          const rc = FTE_ROLE_COLORS[f.id];
          return (
            <span key={f.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: rc?.primary + '22', color: rc?.primary }}>
              {f.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Local Resource Network section — rural services for a county */
const LocalResourcesSection = ({ county }: { county: string }) => {
  const services = useMemo(() => ruralServices.filter(s => s.county === county), [county]);
  const grouped = useMemo(() => {
    const map = new Map<string, RuralService[]>();
    services.forEach(s => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, items]) => [cat, [...items].sort(compareEntitiesByOperationalPriority)] as [string, RuralService[]]);
  }, [services]);

  if (services.length === 0) {
    return (
      <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Local Resource Network</div>
        <p className="text-[11px] text-muted-foreground italic">No known community resources mapped for this county.</p>
      </div>
    );
  }

  const categoryCount = grouped.length;
  const total = services.length;

  // Resource Strength rating — based on total count + redundancy
  const categoriesWithRedundancy = grouped.filter(([, items]) => items.length > 1).length;
  const strength: 'Strong' | 'Moderate' | 'Minimal' =
    total > 20 && categoriesWithRedundancy >= 3 ? 'Strong'
    : total >= 10 && categoriesWithRedundancy >= 2 ? 'Moderate'
    : 'Minimal';

  const strengthColor = strength === 'Strong' ? 'text-emerald-700' : strength === 'Moderate' ? 'text-amber-700' : 'text-orange-700';
  const strengthBg = strength === 'Strong' ? 'bg-emerald-50 border-emerald-200' : strength === 'Moderate' ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200';
  const strengthDesc = strength === 'Strong'
    ? 'Multiple services and provider options support local stabilization.'
    : strength === 'Moderate'
    ? 'Core services are present with some local stabilization capability.'
    : 'Basic services exist but are limited in capacity, access, and redundancy.';

  return (
    <div className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 mb-2">
      {/* Header with counts */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Local Resource Network</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{total} resources · {categoryCount} categories</span>
      </div>

      {/* Resource Strength */}
      <div className={`rounded-md border px-2 py-1.5 mb-1.5 ${strengthBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Resource Strength</span>
          <span className={`text-[11px] font-bold ${strengthColor}`}>{strength}</span>
        </div>
        <p className={`text-[10px] mt-0.5 leading-relaxed ${strengthColor} opacity-80`}>{strengthDesc}</p>
      </div>

      {/* Category groups */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${CATEGORY_COLORS[category] ?? 'bg-secondary text-foreground'}`}>
                {category}
              </span>
              <span className="text-[10px] font-semibold tabular-nums text-foreground">{items.length}</span>
            </div>
            <div className="space-y-0.5 pl-1">
              {items.map(service => (
                <div key={service.id} className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium text-foreground leading-snug" style={{ wordBreak: 'break-word' }}>{service.name}</div>
                    {service.city && <div className="text-[9px] text-muted-foreground">{service.city}</div>}
                  </div>
                  <ContactPhoneAction phone={service.phone} variant="inline" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Utilization Metrics Card (additive, county-level) ──
const UtilizationMetricsCard = ({ county }: { county: string }) => {
  const util = getCountyUtilization(county);
  if (util.activeProviderCount === 0 && util.totalVisits === 0) return null;

  const totalVisits = util.totalVisits;
  const totalMembers = util.totalMembers;
  const vpm = totalMembers > 0 ? Math.round((totalVisits / totalMembers) * 100) / 100 : 0;
  const uniqueProviders = util.activeProviderCount;

  const topVisits = util.topProviders.length > 0 ? util.topProviders[0].visits : 0;
  const topProviderShare = totalVisits > 0 ? (topVisits / totalVisits) * 100 : 0;

  const top3Visits = util.topProviders.slice(0, 3).reduce((s, p) => s + p.visits, 0);
  const top3Share = totalVisits > 0 ? (top3Visits / totalVisits) * 100 : 0;

  const shareColor = (pct: number) =>
    pct > 60 ? 'text-red-700' : pct >= 40 ? 'text-amber-600' : 'text-emerald-700';

  return (
    <div className="mt-2 mb-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Utilization Metrics</span>
      </div>
      <div className="rounded-md border border-purple-200 bg-purple-50/50 px-2 py-1.5 space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Visits</span>
          <span className="font-bold text-purple-800 tabular-nums">{totalVisits.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Total Members</span>
          <span className="font-bold text-purple-800 tabular-nums">{totalMembers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Visits per Member</span>
          <span className="font-bold text-purple-800 tabular-nums">{vpm.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-purple-700">Unique Providers</span>
          <span className="font-bold text-purple-800 tabular-nums">{uniqueProviders}</span>
        </div>
        <div className="pt-1 border-t border-purple-100 mt-1 space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-purple-700">Top Provider Share</span>
            <span className={`font-bold tabular-nums ${shareColor(topProviderShare)}`}>{topProviderShare.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-purple-700">Top 3 Provider Share</span>
            <span className={`font-bold tabular-nums ${shareColor(top3Share)}`}>{top3Share.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── County ──
const CountyContent = ({ county, coverageRadiusKm }: { county: string; coverageRadiusKm: number }) => {
  const { isOpen, toggle } = useAccordion('memberVolume');
  const countyData = nevadaCounties.find(c => c.name === county);
  const area = getCountyArea(county);
  const countyServiceCount = COUNTY_SERVICE_COUNT.get(county) ?? 0;

  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  const hasField = serving.some(f => f.hubLocation !== null);
  const isRemoteOnly = serving.length === 0 || !hasField;
  const responseLabel = isRemoteOnly
    ? PRIMARY_RESPONSE_LABELS.remote
    : hasField
    ? PRIMARY_RESPONSE_LABELS.active
    : PRIMARY_RESPONSE_LABELS.scheduled;

  const util = getCountyUtilization(county);
  const hasUtilization = util.activeProviderCount > 0 || util.totalVisits > 0;
  const hasFte = serving.length > 0;
  const hasLocalResources = (COUNTY_SERVICE_COUNT.get(county) ?? 0) > 0;

  return (
    <>
      <p className="text-sm font-semibold text-foreground mb-1">{county} County</p>
      <p className="text-[11px] font-bold text-foreground mb-1.5">Primary Response: {responseLabel}</p>
      <GapContextAlerts county={county} serviceCount={countyServiceCount} />

      <DetailSection title="Member Volume" isOpen={isOpen('memberVolume')} onToggle={() => toggle('memberVolume')}>
        <MemberVolumeSection county={county} />
        <EngagementPriorityCard county={county} />
      </DetailSection>

      <DetailSection title="Coverage Breakdown" isOpen={isOpen('coverage')} onToggle={() => toggle('coverage')}>
        <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
        <div className="space-y-1 text-xs text-foreground/80">
          <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
          <div className="flex justify-between"><span>Rural Access Dependence</span><span className="font-medium">{RURAL_ACCESS_DEPENDENCE[area]}</span></div>
          {countyData?.secondaryZone && (
            <div className="text-[10px] text-muted-foreground italic">
              Secondary support from Area {countyData.secondaryZone.replace('area', '')}
            </div>
          )}
        </div>
      </DetailSection>

      {hasFte && (
        <DetailSection title="Regional FTE Support" isOpen={isOpen('fte')} onToggle={() => toggle('fte')}>
          <FieldCapacitySection county={county} />
          <CapacityStatusSection county={county} />
        </DetailSection>
      )}

      {hasUtilization && (
        <DetailSection title="Utilization & Engagement" isOpen={isOpen('utilization')} onToggle={() => toggle('utilization')}>
          <UtilizationEngagementSection county={county} />
          <UtilizationMetricsCard county={county} />
        </DetailSection>
      )}

      <DetailSection title="Routing & Action Path" isOpen={isOpen('routing')} onToggle={() => toggle('routing')}>
        <NBHRoutingSection county={county} coverageRadiusKm={coverageRadiusKm} />
      </DetailSection>

      {hasLocalResources && (
        <DetailSection title="Local Resource Network" isOpen={isOpen('resources')} onToggle={() => toggle('resources')} count={COUNTY_SERVICE_COUNT.get(county)}>
          <LocalResourcesSection county={county} />
        </DetailSection>
      )}

      {(() => {
        const bb = getCountyBroadband(county);
        if (!bb) return null;
        const feasibility = getCountyRemoteFeasibility(county);
        const note = getBroadbandOperationalNote(bb);
        return (
          <DetailSection title="Broadband Access" isOpen={isOpen('broadband')} onToggle={() => toggle('broadband')}>
            <div className="space-y-1.5">
              <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wifi className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Speed Distribution</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">≥100/20 Mbps</span>
                    <span className="font-bold tabular-nums text-foreground">{bb.pct_100_20_plus}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">25/3–100/20</span>
                    <span className="font-medium tabular-nums text-foreground">{bb.pct_25_3_to_100_20}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">&lt;25/3 Mbps</span>
                    <span className="font-medium tabular-nums text-foreground">{bb.pct_below_25_3}%</span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wifi className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Technology Mix</span>
                </div>
                <div className="space-y-0.5">
                  {bb.fiberShare > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Fiber</span>
                      <span className="font-medium tabular-nums text-foreground">{bb.fiberShare}%</span>
                    </div>
                  )}
                  {bb.cableShare > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Cable</span>
                      <span className="font-medium tabular-nums text-foreground">{bb.cableShare}%</span>
                    </div>
                  )}
                  {bb.fixedWirelessShare > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Fixed Wireless</span>
                      <span className="font-medium tabular-nums text-foreground">{bb.fixedWirelessShare}%</span>
                    </div>
                  )}
                  {bb.satelliteShare > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Satellite</span>
                      <span className={`font-medium tabular-nums ${bb.satelliteShare >= 50 ? 'text-destructive' : 'text-foreground'}`}>{bb.satelliteShare}%</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-[11px] px-0.5">
                <span className="text-muted-foreground">Operational Readiness</span>
                <span className={`font-semibold ${READINESS_COLORS[bb.operationalReadiness]}`}>{bb.operationalReadiness}</span>
              </div>
              {feasibility && (
                <div className="flex justify-between text-[11px] px-0.5">
                  <span className="text-muted-foreground">Remote Feasibility</span>
                  <span className={`font-semibold ${FEASIBILITY_COLORS[feasibility]}`}>{feasibility.replace(' Remote Feasibility', '')}</span>
                </div>
              )}
              {bb.coverageUnevenness && (
                <div className="rounded-md border border-engagement-watch/30 bg-engagement-watch/5 px-2 py-1 text-[10px] text-engagement-watch">
                  ⚠ Coverage varies significantly across this county — do not assume uniform access.
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-relaxed">{note}</p>
              {bb.notes && <p className="text-[9px] italic text-muted-foreground/60">{bb.notes}</p>}
            </div>
          </DetailSection>
        );
      })()}

      {(() => {
        const cell = getCountyCellular(county);
        if (!cell) return null;
        const feasibility = getCountyMobileFeasibility(county);
        const note = getCellularOperationalNote(cell);
        const reliability = getReliabilityCategory(cell);
        return (
          <DetailSection title="Cellular Coverage" isOpen={isOpen('cellular')} onToggle={() => toggle('cellular')}>
            <div className="space-y-1.5">
              <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Signal className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Readiness</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Readiness</span>
                    <span className={`font-bold ${CELLULAR_READINESS_COLORS[cell.operationalCellularReadiness]}`}>{cell.operationalCellularReadiness}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium text-foreground">{cell.fieldReliabilityConfidence}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Technology Coverage</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">LTE (4G)</span>
                    <span className="font-bold tabular-nums text-foreground">{cell.lteCoveragePct}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">5G-NR</span>
                    <span className="font-bold tabular-nums text-foreground">{cell.fiveGCoveragePct}%</span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Signal Distribution</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Strong (5G+LTE)</span>
                    <span className="font-bold tabular-nums text-foreground">{cell.strongSignalPct}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Moderate (LTE only)</span>
                    <span className="font-bold tabular-nums text-foreground">{cell.moderateSignalPct}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Weak / None</span>
                    <span className="font-bold tabular-nums text-foreground">{cell.weakOrNonePct}%</span>
                  </div>
                </div>
              </div>
              {feasibility && (
                <div className="flex justify-between text-[11px] px-0.5">
                  <span className="text-muted-foreground">Mobile Feasibility</span>
                  <span className={`font-semibold ${CELLULAR_READINESS_COLORS[cell.operationalCellularReadiness]}`}>{feasibility.replace(' Mobile Feasibility', '')}</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-relaxed">{note}</p>
              <p className="text-[9px] italic text-muted-foreground/50 leading-relaxed">{cell.dataLimitations}</p>
              <p className="text-[9px] italic text-muted-foreground/40">Confidence: {cell.fieldReliabilityConfidence} — {cell.dataSource}</p>
            </div>
          </DetailSection>
        );
      })()}

      {/* Psychiatric & Inpatient County Summary */}
      {(() => {
        const countyFacs = defaultFacilities.filter(fac => fac.county === county);
        const hasHospital = countyHasHospital(county);
        const psychProviders = countyFacs.filter(fac => {
          const p = fac.psychiatric;
          return p?.psychiatric_services_offered === true ||
            (p?.psychiatric_verification_status != null && ['directly_verified', 'verified_via_directory', 'reported_unverified', 'unable_to_confirm'].includes(p.psychiatric_verification_status));
        });
        const inpatientHospitals = countyFacs.filter(fac => {
          const ip = fac.inpatient;
          return ip?.inpatient_services_offered === true ||
            (ip?.inpatient_verification_status != null && ['directly_verified', 'verified_via_directory', 'reported_unverified', 'unable_to_confirm'].includes(ip.inpatient_verification_status));
        });
        if (psychProviders.length === 0 && inpatientHospitals.length === 0 && hasHospital) return null;

        const verifiedPsych = psychProviders.filter(f => f.psychiatric?.psychiatric_verification_status === 'directly_verified' || f.psychiatric?.psychiatric_verification_status === 'verified_via_directory');
        const verifiedMedicaidPsych = verifiedPsych.filter(f => f.psychiatric?.psychiatric_medicaid_status === 'participating');
        const needsVerifPsych = psychProviders.filter(f =>
          f.psychiatric?.psychiatric_services_offered === true && (!f.psychiatric?.psychiatric_verification_status || f.psychiatric.psychiatric_verification_status === 'reported_unverified' || f.psychiatric.psychiatric_verification_status === 'unable_to_confirm')
        );

        const verifiedInp = inpatientHospitals.filter(f => f.inpatient?.inpatient_verification_status === 'directly_verified' || f.inpatient?.inpatient_verification_status === 'verified_via_directory');
        const verifiedPsychInp = verifiedInp.filter(f => f.inpatient?.inpatient_service_types?.some(t => t.toLowerCase().includes('psychiatric inpatient')));
        const medicaidInp = inpatientHospitals.filter(f => f.inpatient?.inpatient_medicaid_status === 'participating');
        const needsVerifInp = inpatientHospitals.filter(f =>
          f.inpatient?.inpatient_services_offered === true && (!f.inpatient?.inpatient_verification_status || f.inpatient.inpatient_verification_status === 'reported_unverified' || f.inpatient.inpatient_verification_status === 'unable_to_confirm')
        );
        const directAdmit = inpatientHospitals.filter(f => f.inpatient?.inpatient_referral_pathway === 'direct_admit_allowed').length;
        const edRequired = inpatientHospitals.filter(f => f.inpatient?.inpatient_referral_pathway === 'ED_required').length;
        const transferOnly = inpatientHospitals.filter(f => f.inpatient?.inpatient_referral_pathway === 'transfer_only').length;

        return (
          <DetailSection title="Service-Line Summary" isOpen={isOpen('serviceLineSummary')} onToggle={() => toggle('serviceLineSummary')}>
            <div className="space-y-2">
              {psychProviders.length > 0 && (() => {
                const opUsable = psychProviders.filter(f => derivePsychiatricAccess(f.psychiatric) === 'operationally_usable').length;
                const fragile = psychProviders.filter(f => derivePsychiatricAccess(f.psychiatric) === 'fragile_access').length;
                const verifNeeded = psychProviders.filter(f => derivePsychiatricAccess(f.psychiatric) === 'verification_needed').length;
                return (
                <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Psychiatric Providers</div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Total Offering</span><span className="font-bold text-foreground tabular-nums">{psychProviders.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Verified</span><span className="font-bold text-foreground tabular-nums">{verifiedPsych.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Verified + Medicaid</span><span className="font-bold text-foreground tabular-nums">{verifiedMedicaidPsych.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Needs Verification</span><span className="font-bold text-foreground tabular-nums">{needsVerifPsych.length}</span></div>
                    <div className="pt-1 border-t border-border/50 mt-1 space-y-0.5">
                      <div className="text-[10px] font-semibold text-foreground/70 mb-0.5">Operational Access</div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Operationally Usable</span><span className="font-bold text-foreground tabular-nums">{opUsable}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fragile Access</span><span className="font-bold text-foreground tabular-nums">{fragile}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Verification Needed</span><span className="font-bold text-foreground tabular-nums">{verifNeeded}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fresh Verifications</span><span className="font-bold text-foreground tabular-nums">{psychProviders.filter(f => f.psychiatric?.psychiatric_verification_status != null && derivePsychiatricFreshness(f.psychiatric) === 'fresh').length}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Stale Verifications</span><span className="font-bold text-foreground tabular-nums">{psychProviders.filter(f => f.psychiatric?.psychiatric_verification_status != null && derivePsychiatricFreshness(f.psychiatric) === 'stale').length}</span></div>
                    </div>
                  </div>
                </div>
                );
              })()}
              {inpatientHospitals.length > 0 && (() => {
                const opUsableInp = inpatientHospitals.filter(f => deriveInpatientAccess(f.inpatient) === 'operationally_usable').length;
                const fragileInp = inpatientHospitals.filter(f => deriveInpatientAccess(f.inpatient) === 'fragile_access').length;
                const transferDep = inpatientHospitals.filter(f => deriveInpatientAccess(f.inpatient) === 'transfer_dependent').length;
                return (
                <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Inpatient Hospitals</div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Total Inpatient</span><span className="font-bold text-foreground tabular-nums">{inpatientHospitals.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Verified</span><span className="font-bold text-foreground tabular-nums">{verifiedInp.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Verified Psych Inpatient</span><span className="font-bold text-foreground tabular-nums">{verifiedPsychInp.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Medicaid Participating</span><span className="font-bold text-foreground tabular-nums">{medicaidInp.length}</span></div>
                    <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Needs Verification</span><span className="font-bold text-foreground tabular-nums">{needsVerifInp.length}</span></div>
                    {(directAdmit > 0 || edRequired > 0 || transferOnly > 0) && (
                      <div className="pt-1 border-t border-border/50 mt-1 space-y-0.5">
                        <div className="text-[10px] font-semibold text-foreground/70 mb-0.5">Referral Pathway</div>
                        {directAdmit > 0 && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Direct Admit</span><span className="font-bold text-foreground tabular-nums">{directAdmit}</span></div>}
                        {edRequired > 0 && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">ED Required</span><span className="font-bold text-foreground tabular-nums">{edRequired}</span></div>}
                        {transferOnly > 0 && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Transfer Only</span><span className="font-bold text-foreground tabular-nums">{transferOnly}</span></div>}
                      </div>
                    )}
                    <div className="pt-1 border-t border-border/50 mt-1 space-y-0.5">
                      <div className="text-[10px] font-semibold text-foreground/70 mb-0.5">Operational Access</div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Operationally Usable</span><span className="font-bold text-foreground tabular-nums">{opUsableInp}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fragile Access</span><span className="font-bold text-foreground tabular-nums">{fragileInp}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Transfer Dependent</span><span className="font-bold text-foreground tabular-nums">{transferDep}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fresh Verifications</span><span className="font-bold text-foreground tabular-nums">{inpatientHospitals.filter(f => f.inpatient?.inpatient_verification_status != null && deriveInpatientFreshness(f.inpatient) === 'fresh').length}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Stale Verifications</span><span className="font-bold text-foreground tabular-nums">{inpatientHospitals.filter(f => f.inpatient?.inpatient_verification_status != null && deriveInpatientFreshness(f.inpatient) === 'stale').length}</span></div>
                    </div>
                  </div>
                </div>
                );
              })()}
              {!hasHospital && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold text-amber-700">⚠ No Hospital in County</div>
                  <p className="text-[9px] text-amber-600 mt-0.5">No hospital entities exist in {county} County</p>
                </div>
              )}
              {verifiedPsych.length === 0 && psychProviders.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-2 py-1.5">
                  <div className="text-[10px] font-semibold text-amber-700">⚠ Zero Verified Psychiatric Providers</div>
                  <p className="text-[9px] text-amber-600 mt-0.5">All {psychProviders.length} psychiatric provider(s) need verification</p>
                </div>
              )}
              {(() => {
                const fb = deriveCountyFallback(county);
                if (!fb.psychiatric_fallback_needed && !fb.inpatient_fallback_needed) return null;
                return (
                  <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Fallback Access</div>
                    <div className="space-y-0.5">
                      {fb.psychiatric_fallback_needed && (
                        <>
                          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Psychiatry Fallback</span><span className="font-bold text-foreground">Needed</span></div>
                          {fb.psychiatric_fallback_county && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fallback County</span><span className="font-medium text-foreground">{fb.psychiatric_fallback_county}</span></div>}
                          {fb.psychiatric_fallback_entity_name && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fallback Provider</span><span className="font-medium text-foreground truncate ml-2 max-w-[140px]">{fb.psychiatric_fallback_entity_name}</span></div>}
                          {fb.psychiatric_fallback_reason && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Reason</span><span className="font-medium text-foreground">{PSYCH_FALLBACK_REASON_LABELS[fb.psychiatric_fallback_reason]}</span></div>}
                        </>
                      )}
                      {fb.inpatient_fallback_needed && (
                        <>
                          {fb.psychiatric_fallback_needed && <div className="border-t border-border/50 my-1" />}
                          <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Inpatient Fallback</span><span className="font-bold text-foreground">Needed</span></div>
                          {fb.inpatient_fallback_county && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fallback County</span><span className="font-medium text-foreground">{fb.inpatient_fallback_county}</span></div>}
                          {fb.inpatient_fallback_entity_name && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fallback Hospital</span><span className="font-medium text-foreground truncate ml-2 max-w-[140px]">{fb.inpatient_fallback_entity_name}</span></div>}
                          {fb.inpatient_fallback_reason && <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Reason</span><span className="font-medium text-foreground">{INPATIENT_FALLBACK_REASON_LABELS[fb.inpatient_fallback_reason]}</span></div>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const queue = deriveVerificationQueueFn();
                const countyQueue = queue.filter(r => {
                  // Include records for entities in this county OR where this county depends on entity
                  return r.county === county || r.dependent_counties.includes(county);
                });
                const highPsych = countyQueue.filter(r => r.service_line === 'psychiatry' && r.priority_tier === 'high').length;
                const highInp = countyQueue.filter(r => r.service_line === 'inpatient' && r.priority_tier === 'high').length;
                if (highPsych === 0 && highInp === 0) return null;
                return (
                  <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-1">Verification Priority</div>
                    <div className="space-y-0.5">
                      {highPsych > 0 && (
                        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">High Priority Psych</span><span className="font-bold text-destructive tabular-nums">{highPsych}</span></div>
                      )}
                      {highInp > 0 && (
                        <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">High Priority Inpatient</span><span className="font-bold text-destructive tabular-nums">{highInp}</span></div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </DetailSection>
        );
      })()}
    </>
  );
};

// ── Accordion Section helper (only one open at a time) ──
const DetailSection = ({ title, isOpen, onToggle, children, count }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode; count?: number }) => {
  return (
    <div className="border-t border-border/50 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">
          {title}{count !== undefined ? ` (${count})` : ''}
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div
        className="overflow-hidden transition-all duration-150"
        style={{ maxHeight: isOpen ? '1000px' : '0', opacity: isOpen ? 1 : 0 }}
      >
        <div className="pb-2">{children}</div>
      </div>
    </div>
  );
};

/** Hook for independent multi-open section state */
const useAccordion = (defaultSection: string) => {
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([defaultSection]));
  const toggle = useCallback((section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);
  const isOpen = useCallback((section: string) => openSections.has(section), [openSections]);
  return { isOpen, toggle };
};

// ── Routing Tier Resolution (truth-gated) ──
type RoutingTierDisplay = 'recommended' | 'available_unverified' | 'fallback';

const ROUTING_TIER_DISPLAY_LABELS: Record<RoutingTierDisplay, string> = {
  recommended: 'Recommended (Medicaid Participating)',
  available_unverified: 'Available (Unverified)',
  fallback: 'Fallback Option',
};

const ROUTING_TIER_DISPLAY_COLORS: Record<RoutingTierDisplay, string> = ROUTING_TIER_COLORS;

const resolveRoutingTierDisplay = (
  entityId?: string,
  meta?: Partial<ServiceOperationalMeta> | null,
): RoutingTierDisplay => {
  const resolved = resolveOperationalMeta(meta);
  const tag = entityId ? getOperationalTagIndex().get(entityId) : undefined;

  // Deferred entities are always fallback regardless of participation value
  if (tag?.verificationStatus === 'deferred') {
    return 'fallback';
  }

  // Only "Recommended" if participating AND direct confidence
  if (resolved.isNevadaMedicaidParticipating === true && tag) {
    if (tag.verificationConfidence === 'direct') {
      return 'recommended';
    }
    // Legacy facility tags without verificationStatus are treated as direct
    if (!tag.verificationStatus && tag.isNevadaMedicaidParticipating === true) {
      return 'recommended';
    }
    // inferred or missing confidence → not recommended
    return 'available_unverified';
  }

  if (resolved.medicaidParticipationStatus === 'non_participating') {
    return 'fallback';
  }

  // unknown or untagged
  return 'available_unverified';
};

// ── Verification Signal Labels ──
type VerificationSignalResult = { label: string; colorClass: string; dotClass: string } | null;

const resolveVerificationSignal = (entityId?: string): VerificationSignalResult => {
  if (!entityId) return null;
  const tag = getOperationalTagIndex().get(entityId);
  if (!tag) return null;

  if (tag.verificationStatus === 'verified_participating')
    return { label: 'Medicaid Verified (DPBH)', colorClass: VERIFICATION_SIGNAL_COLORS.medicaid_verified.text, dotClass: VERIFICATION_SIGNAL_COLORS.medicaid_verified.dot };
  if (tag.verificationStatus === 'needs_verification' && tag.verificationConfidence === 'inferred_strong')
    return { label: 'Provider Identified (NPI Confirmed)', colorClass: VERIFICATION_SIGNAL_COLORS.npi_confirmed.text, dotClass: VERIFICATION_SIGNAL_COLORS.npi_confirmed.dot };
  if (tag.verificationStatus === 'needs_verification' && tag.verificationConfidence === 'unknown')
    return { label: 'Unverified Provider', colorClass: VERIFICATION_SIGNAL_COLORS.unverified.text, dotClass: VERIFICATION_SIGNAL_COLORS.unverified.dot };
  return null;
};

// ── Operational Indicators ──
const OperationalBadges = ({ meta, alwaysShowMedicaid = false, entityId }: { meta?: Partial<ServiceOperationalMeta> | null; alwaysShowMedicaid?: boolean; entityId?: string }) => {
  const resolved = resolveOperationalMeta(meta);

  const showMedicaid = alwaysShowMedicaid || resolved.medicaidParticipationStatus !== 'unknown';
  const hasExtra = resolved.isTribalProvider || resolved.isTriballyOperated || resolved.isCrossBorderService;
  const showRoutingTier = showMedicaid || hasExtra;
  if (!showMedicaid && !hasExtra) return null;

  const routingTier = showRoutingTier ? resolveRoutingTierDisplay(entityId, meta) : undefined;
  const verificationSignal = resolveVerificationSignal(entityId);

  return (
    <div className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 mb-2 space-y-1">
      {routingTier && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">Routing Tier</span>
          <span className={`font-medium leading-tight ${ROUTING_TIER_DISPLAY_COLORS[routingTier]}`}>
            {ROUTING_TIER_DISPLAY_LABELS[routingTier]}
          </span>
        </div>
      )}
      {verificationSignal && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">Verification Signal</span>
          <span className={`font-medium leading-tight flex items-center gap-1 ${verificationSignal.colorClass}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${verificationSignal.dotClass}`} />
            {verificationSignal.label}
          </span>
        </div>
      )}
      {showMedicaid && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">NV Medicaid Participating</span>
          <span className={`font-medium leading-tight ${PARTICIPATION_STATUS_COLORS[resolved.medicaidParticipationStatus]}`}>
            {PARTICIPATION_STATUS_LABELS[resolved.medicaidParticipationStatus]}
          </span>
        </div>
      )}
      {resolved.isTribalProvider && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">Tribal Provider</span>
          <span className="font-medium text-foreground leading-tight">Yes</span>
        </div>
      )}
      {resolved.isTriballyOperated && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">Tribally Operated</span>
          <span className="font-medium text-foreground leading-tight">Yes</span>
        </div>
      )}
      {resolved.isCrossBorderService && (
        <div className="text-[10px]">
          <span className="text-muted-foreground block leading-tight">Cross-border</span>
          <span className="font-medium text-muted-foreground leading-tight">Yes — reimbursement verification may be needed</span>
        </div>
      )}
      {resolved.reimbursementNotes && (
        <p className="text-[10px] text-muted-foreground italic mt-0.5">{resolved.reimbursementNotes}</p>
      )}
    </div>
  );
};

/** Inline operational indicator for service lists (compact) */
const OperationalInlineBadges = ({ meta }: { meta?: Partial<ServiceOperationalMeta> | null }) => {
  if (!meta) return null;
  const resolved = resolveOperationalMeta(meta);
  const badges: string[] = [];

  if (resolved.medicaidParticipationStatus === 'participating') badges.push('NV Medicaid');
  if (resolved.medicaidParticipationStatus === 'non_participating') badges.push('Non-participating');
  if (resolved.isTribalProvider) badges.push('Tribal Provider');
  if (resolved.isCrossBorderService) badges.push('Cross-border');

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {badges.map(b => (
        <span key={b} className="rounded border border-border bg-secondary/70 px-1 py-0 text-[9px] text-muted-foreground">{b}</span>
      ))}
    </div>
  );
};

// ── Service-Line Badges ──

const PsychiatryBadge = ({ fields }: { fields?: Partial<import('@/types/service-lines').PsychiatricServiceFields> | null }) => {
  if (!hasPsychiatricData(fields)) return null;
  const badge = resolvePsychiatryBadge(fields);
  const colors = PSYCHIATRY_BADGE_COLORS[badge];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${colors.bg} ${colors.text}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {badge}
    </span>
  );
};

const InpatientBadge = ({ fields }: { fields?: Partial<import('@/types/service-lines').InpatientServiceFields> | null }) => {
  if (!hasInpatientData(fields)) return null;
  const badge = resolveInpatientBadge(fields);
  const colors = INPATIENT_BADGE_COLORS[badge];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${colors.bg} ${colors.text}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {badge}
    </span>
  );
};

const YNU_LABELS: Record<string, string> = { yes: 'Yes', no: 'No', unknown: 'Unknown' };
const MEDICAID_LABELS: Record<string, string> = { participating: 'Yes', non_participating: 'No', unknown: 'Unknown' };

const MetaRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (value == null || value === '' || value === 'unknown') return null;
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{formatDisplayValue(value)}</span>
    </div>
  );
};

const PsychiatricSection = ({ fields, entityId }: { fields: Partial<import('@/types/service-lines').PsychiatricServiceFields>; entityId?: string }) => {
  const types = fields.psychiatric_service_types ?? [];
  return (
    <div className="space-y-1">
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {types.map(t => (
            <span key={t} className="rounded border border-border bg-secondary/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">{formatTagLabel(t)}</span>
          ))}
        </div>
      )}
      <MetaRow label="Accepting New Patients" value={fields.psychiatric_accepting_new_patients ? YNU_LABELS[fields.psychiatric_accepting_new_patients] : null} />
      <MetaRow label="Medicaid Participating" value={fields.psychiatric_medicaid_status ? MEDICAID_LABELS[fields.psychiatric_medicaid_status] : null} />
      <MetaRow label="Referral Required" value={fields.psychiatric_referral_required ? YNU_LABELS[fields.psychiatric_referral_required] : null} />
      <MetaRow label="Telepsychiatry" value={fields.psychiatric_telepsychiatry_available ? YNU_LABELS[fields.psychiatric_telepsychiatry_available] : null} />
      <MetaRow label="Wait Time (days)" value={fields.psychiatric_wait_time_days} />
      <MetaRow label="Population Focus" value={fields.psychiatric_population_focus !== 'unknown' ? fields.psychiatric_population_focus : null} />
      <MetaRow label="Verification Source" value={fields.psychiatric_verification_source} />
      <MetaRow label="Verification Date" value={fields.psychiatric_verification_date} />
      {fields.psychiatric_access_notes && (
        <p className="text-[10px] text-muted-foreground italic leading-relaxed">{fields.psychiatric_access_notes}</p>
      )}
      <MetaRow label="Psychiatric Access" value={OPERATIONAL_ACCESS_LABELS[derivePsychiatricAccess(fields)]} />
      <MetaRow label="Verification Freshness" value={FRESHNESS_LABELS[derivePsychiatricFreshness(fields)]} />
      {(() => {
        const lv = deriveLastDirectlyVerifiedFn(entityId ?? '', 'psychiatry', fields.psychiatric_verification_status ?? null);
        if (!lv.date) return null;
        return (
          <>
            <MetaRow label="Last Directly Verified" value={lv.date} />
            {lv.by && <MetaRow label="Verified By" value={lv.by} />}
          </>
        );
      })()}
    </div>
  );
};

const InpatientSection = ({ fields, entityId }: { fields: Partial<import('@/types/service-lines').InpatientServiceFields>; entityId?: string }) => {
  const types = fields.inpatient_service_types ?? [];
  return (
    <div className="space-y-1">
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {types.map(t => (
            <span key={t} className="rounded border border-border bg-secondary/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">{formatTagLabel(t)}</span>
          ))}
        </div>
      )}
      <MetaRow label="Accepting Admissions" value={fields.inpatient_accepting_admissions !== 'unknown' ? fields.inpatient_accepting_admissions : null} />
      <MetaRow label="Medicaid Participating" value={fields.inpatient_medicaid_status ? MEDICAID_LABELS[fields.inpatient_medicaid_status] : null} />
      <MetaRow label="Referral Pathway" value={fields.inpatient_referral_pathway ? REFERRAL_PATHWAY_LABELS[fields.inpatient_referral_pathway] : null} />
      <MetaRow label="Bed Availability" value={fields.inpatient_bed_availability_model ? BED_AVAILABILITY_LABELS[fields.inpatient_bed_availability_model] : null} />
      <MetaRow label="Transfer Dependency" value={fields.inpatient_transfer_dependency ? TRANSFER_DEPENDENCY_LABELS[fields.inpatient_transfer_dependency] : null} />
      <MetaRow label="Population Focus" value={fields.inpatient_population_focus !== 'unknown' ? fields.inpatient_population_focus : null} />
      <MetaRow label="Verification Source" value={fields.inpatient_verification_source} />
      <MetaRow label="Verification Date" value={fields.inpatient_verification_date} />
      {fields.inpatient_capacity_notes && (
        <p className="text-[10px] text-muted-foreground italic leading-relaxed">{fields.inpatient_capacity_notes}</p>
      )}
      {fields.inpatient_access_notes && (
        <p className="text-[10px] text-muted-foreground italic leading-relaxed">{fields.inpatient_access_notes}</p>
      )}
      <MetaRow label="Inpatient Access" value={OPERATIONAL_ACCESS_LABELS[deriveInpatientAccess(fields)]} />
      <MetaRow label="Verification Freshness" value={FRESHNESS_LABELS[deriveInpatientFreshness(fields)]} />
      {(() => {
        const lv = deriveLastDirectlyVerifiedFn(entityId ?? '', 'inpatient', fields.inpatient_verification_status ?? null);
        if (!lv.date) return null;
        return (
          <>
            <MetaRow label="Last Directly Verified" value={lv.date} />
            {lv.by && <MetaRow label="Verified By" value={lv.by} />}
          </>
        );
      })()}
    </div>
  );
};

// ── Action Buttons Row ──
const ActionButtonRow = ({ phone, website }: { phone?: string; address?: string; lat?: number; lng?: number; city?: string; website?: string }) => {
  const normalizedWebsite = normalizeWebsite(website);
  if (!phone && !normalizedWebsite) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      <ContactPhoneAction phone={phone} variant="button" />
      {normalizedWebsite && (
        <a
          href={normalizedWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors"
          title="Visit website"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Website
        </a>
      )}
    </div>
  );
};

/** Normalize a website string: trim, add https:// if missing scheme, then validate. */
const normalizeWebsite = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try { new URL(url); return url; } catch { return null; }
};

const isValidUrl = (str: string): boolean => normalizeWebsite(str) !== null;

/** Extract a readable hostname label from a URL string. */
const websiteDisplayLabel = (url: string): string => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.length > 35 ? host.slice(0, 32) + '…' : host;
  } catch { return 'Website'; }
};

// ── Copy Address helper ──
const CopyAddress = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 p-0.5 rounded hover:bg-secondary text-muted-foreground"
      title="Copy address"
    >
      {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
};

// ── Facility ──
const FacilityContent = ({ facility }: { facility: Facility }) => {
  const { isOpen, toggle } = useAccordion('provider');
  const isHighUtilClinic = facility.tier === 'tier1';
  const classification = getFacilityClassification(facility);
  const dataConfidence = getFacilityDataConfidence(facility);
  const typeLabel = classification === 'clinic_provider' && isHighUtilClinic
    ? 'Clinic / Community Provider (High Utilization)'
    : getFacilityTypeLabel(facility);
  const typeColor = facility.type === 'hospital' ? 'bg-red-500' : 'bg-blue-500';
  const coverageArea = getCountyArea(facility.county);
  const countyData = nevadaCounties.find(c => c.name === facility.county);
  const isCah = isCriticalAccessHospital(facility);
  const isMember = isNRHPMember(facility);
  const fullAddress = facility.address ? `${facility.address}, ${facility.city}, NV` : undefined;

  const hasServices = !!facility.service;
  const hasContact = !!(facility.phone || normalizeWebsite(facility.website));
  const hasAccess = !!(facility.type === 'hospital' || facility.accessType);
  const util = getFacilityUtilization(facility);

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full ${typeColor}`} />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {typeLabel}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground leading-tight mb-2" style={{ wordBreak: 'break-word' }}>
        {facility.name}
      </h3>

      <ActionButtonRow
        phone={facility.phone}
        address={facility.address}
        lat={facility.lat}
        lng={facility.lng}
        city={facility.city}
        website={facility.website}
      />

      <OperationalBadges meta={facility.operational} alwaysShowMedicaid entityId={facility.id} />

      {/* Service-line badges */}
      {(hasPsychiatricData(facility.psychiatric) || hasInpatientData(facility.inpatient)) && (
        <div className="flex flex-wrap gap-1 mb-2">
          <PsychiatryBadge fields={facility.psychiatric} />
          <InpatientBadge fields={facility.inpatient} />
        </div>
      )}

      <DetailSection title="Provider Information" isOpen={isOpen('provider')} onToggle={() => toggle('provider')}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{facility.city}, {facility.county} County</span>
          </div>
          {facility.address && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1" style={{ wordBreak: 'break-word' }}>{fullAddress}</span>
              <CopyAddress text={fullAddress!} />
            </div>
          )}
          {facility.type === 'hospital' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span>{isCah ? 'Critical Access Hospital (CAH)' : 'Hospital'}</span>
            </div>
          )}
          {isMember && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 flex-shrink-0" />
              <span>NRHP Member</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⊕</span>
            <span>{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground/80 pt-1">
            Data Confidence: {dataConfidence}
          </div>
        </div>
      </DetailSection>

      {hasServices && (
        <DetailSection title="Services Offered" isOpen={isOpen('services')} onToggle={() => toggle('services')} count={1}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stethoscope className="w-3 h-3 flex-shrink-0" />
            <span>
              {facility.service === 'BH' ? 'Behavioral Health' : 'Primary Care'}
              {facility.volume ? ` · ${facility.volume.toLocaleString()} visits` : ''}
            </span>
          </div>
        </DetailSection>
      )}

      {/* Psychiatric service-line section (providers only) */}
      {hasPsychiatricData(facility.psychiatric) && (
        <DetailSection title="Psychiatry" isOpen={isOpen('psychiatry')} onToggle={() => toggle('psychiatry')}>
          <PsychiatricSection fields={facility.psychiatric!} entityId={facility.id} />
        </DetailSection>
      )}

      {/* Inpatient service-line section (hospitals only) */}
      {hasInpatientData(facility.inpatient) && (
        <DetailSection title="Inpatient Services" isOpen={isOpen('inpatient')} onToggle={() => toggle('inpatient')}>
          <InpatientSection fields={facility.inpatient!} entityId={facility.id} />
        </DetailSection>
      )}

      {hasContact && (
        <DetailSection title="Contact Information" isOpen={isOpen('contact')} onToggle={() => toggle('contact')}>
          <ContactPhoneAction phone={facility.phone} variant="detail" />
          {(() => { const href = normalizeWebsite(facility.website); return href ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" onClick={e => e.stopPropagation()}>{websiteDisplayLabel(href)}</a>
            </div>
          ) : null; })()}
        </DetailSection>
      )}

      {hasAccess && (
        <DetailSection title="Access Details" isOpen={isOpen('access')} onToggle={() => toggle('access')}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapIcon className="w-3 h-3 flex-shrink-0" />
              <span>{COVERAGE_AREA_LABELS[coverageArea]}</span>
            </div>
            {countyData?.secondaryZone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⇄</span>
                <span>Routing: Primary Area {coverageArea.replace('area', '')}, Supported by Area {countyData.secondaryZone.replace('area', '')}</span>
              </div>
            )}
            {facility.accessType && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">◆</span>
                <span>Access: {facility.accessType}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⊕</span>
              <span>Rural Dependence: {RURAL_ACCESS_DEPENDENCE[coverageArea]}</span>
            </div>
          </div>
        </DetailSection>
      )}

      {util && (
        <DetailSection title="Engagement Metrics" isOpen={isOpen('engagement')} onToggle={() => toggle('engagement')}>
          <div className="rounded-md border border-purple-200 bg-purple-50/50 px-2 py-1.5 space-y-0.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-purple-700">Provider Rank</span>
              <span className="font-bold text-purple-800">#{util.rank}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-purple-700">Total Members</span>
              <span className="font-bold text-purple-800 tabular-nums">{util.totalMembers.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-purple-700">Total Visits</span>
              <span className="font-bold text-purple-800 tabular-nums">{util.totalVisits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-purple-700">Visits per Member</span>
              <span className="font-bold text-purple-800 tabular-nums">{util.visitsPerMember}</span>
            </div>
          </div>
        </DetailSection>
      )}
    </>
  );
};

// ── Individual Rural Service ──
const RuralServiceContent = ({ service }: { service: RuralService }) => {
  const { isOpen, toggle } = useAccordion('provider');
  const isBH = isBehavioralHealthService(service);
  const fullAddress = service.address ? `${service.address}, ${service.city}, NV` : undefined;
  const hasContact = !!(service.phone || normalizeWebsite(service.website));
  const categoryColor = CATEGORY_COLORS[service.category] ?? 'bg-secondary text-foreground';

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full ${isBH ? 'bg-purple-500' : 'bg-green-500'}`} />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {isBH ? 'Behavioral Health' : 'Service'}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground leading-tight mb-1" style={{ wordBreak: 'break-word' }}>
        {service.name}
      </h3>
      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium mb-2 ${categoryColor}`}>
        {service.category}
      </span>

      <ActionButtonRow
        phone={service.phone}
        address={service.address}
        lat={service.lat}
        lng={service.lng}
        city={service.city}
        website={service.website}
      />

      <OperationalBadges
        meta={service.operational}
        entityId={service.id}
        alwaysShowMedicaid={
          service.operationalServiceClass === 'billable_clinical' ||
          service.operationalServiceClass === 'behavioral_health_clinical' ||
          service.operationalServiceClass === 'tribal_clinical'
        }
      />

      <DetailSection title="Provider Information" isOpen={isOpen('provider')} onToggle={() => toggle('provider')}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{service.city}, {service.county} County</span>
          </div>
          {service.address && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="flex-1" style={{ wordBreak: 'break-word' }}>{fullAddress}</span>
              <CopyAddress text={fullAddress!} />
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⊕</span>
            <span>{service.lat.toFixed(4)}, {service.lng.toFixed(4)}</span>
          </div>
          {service.notes && (
            <div className="text-[11px] text-muted-foreground/80 pt-1 italic">
              {service.notes}
            </div>
          )}
        </div>
      </DetailSection>

      {hasContact && (
        <DetailSection title="Contact Information" isOpen={isOpen('contact')} onToggle={() => toggle('contact')}>
          <ContactPhoneAction phone={service.phone} variant="detail" />
          {(() => { const href = normalizeWebsite(service.website); return href ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" onClick={e => e.stopPropagation()}>{websiteDisplayLabel(href)}</a>
            </div>
          ) : null; })()}
        </DetailSection>
      )}
    </>
  );
};

// ── Tribal Nation ──
const TribalNationContent = ({ tribe }: { tribe: TribalNation }) => {
  const { isOpen, toggle } = useAccordion('location');
  const normalizedWeb = normalizeWebsite(tribe.website);
  const hasContact = !!(tribe.phone || normalizedWeb);
  const services = tribe.triballyOperatedServices;
  const parent = getParentTribe(tribe);
  const subEntities = getSubEntities(tribe.id);

  // Collect services from sub-entities as well
  const allServices = [
    ...services,
    ...subEntities.flatMap(sub => sub.triballyOperatedServices),
  ];

  const categoryLabel = tribe.category === 'Band' ? 'Tribal Band'
    : tribe.category === 'Community' ? 'Tribal Community'
    : tribe.category === 'Colony' ? 'Tribal Colony'
    : 'Tribal Nation';

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1 text-tribal-nation flex items-center gap-1">
        <Landmark className="w-3 h-3" /> {categoryLabel}
      </div>
      <p className="text-sm font-semibold text-foreground mb-0.5">{tribe.name}</p>
      <p className="text-[11px] text-muted-foreground mb-0.5">{tribe.tribalGroup}</p>
      {parent && (
        <p className="text-[10px] text-muted-foreground mb-1">Part of {parent.name}</p>
      )}
      {subEntities.length > 0 && (
        <p className="text-[10px] text-muted-foreground mb-1">{subEntities.length} constituent {subEntities.length === 1 ? 'band/community' : 'bands/communities'}</p>
      )}

      {tribe.summary && <p className="text-xs text-muted-foreground mb-2">{tribe.summary}</p>}

      <ActionButtonRow phone={tribe.phone} lat={tribe.lat} lng={tribe.lng} website={tribe.website} />

      {/* Location */}
      <DetailSection title="Location" isOpen={isOpen('location')} onToggle={() => toggle('location')}>
        <p className="text-xs text-muted-foreground">{tribe.locationDescription}</p>
        {tribe.counties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tribe.counties.map(c => (
              <span key={c} className="rounded-full border border-border bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground">{c} County</span>
            ))}
          </div>
        )}
        {tribe.landBaseAcres && (
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{tribe.landBaseAcres.toLocaleString()}</span> acres
          </div>
        )}
      </DetailSection>

      {/* Population */}
      {(tribe.tribalMembers || tribe.residentPopulation) && (
        <DetailSection title="Population" isOpen={isOpen('population')} onToggle={() => toggle('population')}>
          <div className="space-y-1 text-xs text-muted-foreground">
            {tribe.tribalMembers && <div>Tribal members: <span className="font-medium text-foreground">{tribe.tribalMembers.toLocaleString()}</span></div>}
            {tribe.residentPopulation && <div>Resident population: <span className="font-medium text-foreground">{tribe.residentPopulation.toLocaleString()}</span></div>}
          </div>
        </DetailSection>
      )}

      {/* Contact */}
      {hasContact && (
        <DetailSection title="Contact Information" isOpen={isOpen('contact')} onToggle={() => toggle('contact')}>
          <ContactPhoneAction phone={tribe.phone} variant="detail" />
          {normalizedWeb && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <a href={normalizedWeb} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate" onClick={e => e.stopPropagation()}>{websiteDisplayLabel(normalizedWeb)}</a>
            </div>
          )}
        </DetailSection>
      )}

      {/* Governance */}
      {(tribe.governingBody || tribe.established) && (
        <DetailSection title="Governance" isOpen={isOpen('governance')} onToggle={() => toggle('governance')}>
          <div className="space-y-1 text-xs text-muted-foreground">
            {tribe.governingBody && <div>{tribe.governingBody}</div>}
            {tribe.established && <div className="text-[11px]">Est. {tribe.established}</div>}
          </div>
        </DetailSection>
      )}

      {/* Tribal Programs */}
      {tribe.tribalPrograms && tribe.tribalPrograms.length > 0 && (
        <DetailSection title="Tribal Programs" isOpen={isOpen('programs')} onToggle={() => toggle('programs')}>
          <div className="flex flex-wrap gap-1">
            {tribe.tribalPrograms.map((p, i) => (
              <span key={i} className="rounded-full border border-border bg-secondary/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">{p}</span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Sub-entities (bands/communities) */}
      {subEntities.length > 0 && (
        <DetailSection title={tribe.category === 'Tribe' && subEntities[0]?.category === 'Band' ? 'Bands' : 'Communities'} isOpen={isOpen('subentities')} onToggle={() => toggle('subentities')} count={subEntities.length}>
          <div className="space-y-1.5">
            {subEntities.map(sub => (
              <div key={sub.id} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5">
                <div className="text-xs font-medium text-foreground">{sub.name}</div>
                <div className="text-[10px] text-muted-foreground">{sub.locationDescription}</div>
                {sub.landBaseAcres && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{sub.landBaseAcres.toLocaleString()} acres</div>
                )}
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Tribally Operated Services */}
      <DetailSection title="Tribally Operated Services" isOpen={isOpen('services')} onToggle={() => toggle('services')} count={allServices.length || undefined}>
        {allServices.length > 0 ? (
          <div className="space-y-1.5">
            {allServices.map(svc => {
              const svcWeb = normalizeWebsite(svc.website);
              return (
                <div key={svc.id} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5">
                  <div className="text-xs font-medium text-foreground">{svc.serviceName}</div>
                  <div className="text-[10px] text-muted-foreground">{svc.serviceType}</div>
                  <OperationalInlineBadges meta={svc.operational} />
                  {svc.description && <div className="text-[10px] text-muted-foreground mt-0.5">{svc.description}</div>}
                  {svc.phone && (
                    <div className="mt-0.5">
                      <ContactPhoneAction phone={svc.phone} variant="inline" />
                    </div>
                  )}
                  {svcWeb && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                      <a href={svcWeb} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate" onClick={e => e.stopPropagation()}>{websiteDisplayLabel(svcWeb)}</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No tribally operated services currently listed in this dataset.</p>
        )}
      </DetailSection>

      {/* Source */}
      <div className="mt-2 pt-2 border-t border-border">
        <a href={tribe.directoryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline" onClick={e => e.stopPropagation()}>
          <ExternalLink className="w-2.5 h-2.5" /> NV Dept. of Native American Affairs Directory
        </a>
      </div>
    </>
  );
};

// ── Coverage Gap ──
const CoverageGapContent = ({ radiusKm }: { radiusKm: number }) => (
  <>
    <div className="text-[10px] font-medium uppercase tracking-wide mb-1 text-destructive">
      ● Coverage Gap
    </div>
    <p className="text-sm font-semibold text-foreground mb-2">Service Gap Detected</p>
    <div className="text-xs text-muted-foreground space-y-1">
      <p>No hospital or clinic within <strong>{kmToMiles(radiusKm)} mi</strong> of this area.</p>
      <p className="italic">This region may have limited access to emergency and primary care services.</p>
    </div>
  </>
);

// ── Member Volume (clicked from choropleth) ──
const MemberVolumeContent = ({ county, memberCount, coverageRadiusKm }: { county: string; memberCount: number; coverageRadiusKm: number }) => {
  const { isOpen, toggle } = useAccordion('memberVolume');
  const area = getCountyArea(county);
  const countyServiceCount = COUNTY_SERVICE_COUNT.get(county) ?? 0;
  const util = getCountyUtilization(county);
  const hasUtilization = util.activeProviderCount > 0 || util.totalVisits > 0;

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'hsl(190, 60%, 40%)' }}>
        ● Member Volume
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">{county} County</p>

      <DetailSection title="Member Volume" isOpen={isOpen('memberVolume')} onToggle={() => toggle('memberVolume')}>
        <MemberVolumeSection county={county} />
        <EngagementPriorityCard county={county} />
      </DetailSection>

      <DetailSection title="Coverage Breakdown" isOpen={isOpen('coverage')} onToggle={() => toggle('coverage')}>
        <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
        <GapContextAlerts county={county} serviceCount={countyServiceCount} />
        <div className="text-xs text-foreground/80 space-y-1">
          <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
        </div>
      </DetailSection>

      {hasUtilization && (
        <DetailSection title="Utilization & Engagement" isOpen={isOpen('utilization')} onToggle={() => toggle('utilization')}>
          <UtilizationEngagementSection county={county} />
          <UtilizationMetricsCard county={county} />
        </DetailSection>
      )}
    </>
  );
};

// ── Rural Service Group ──
const RuralServiceGroupContent = ({ county, services, coverageRadiusKm }: { county: string; services: RuralService[]; coverageRadiusKm: number }) => {
  const { isOpen, toggle } = useAccordion('services');
  const grouped = useMemo(() => {
    const map = new Map<string, RuralService[]>();
    services.forEach(s => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, items]) => [cat, [...items].sort(compareEntitiesByOperationalPriority)] as [string, RuralService[]]);
  }, [services]);

  const util = getCountyUtilization(county);
  const hasUtilization = util.activeProviderCount > 0 || util.totalVisits > 0;

  return (
    <>
      <p className="text-sm font-semibold text-foreground">{county} County</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rural Services</p>

      <DetailSection title="Services" isOpen={isOpen('services')} onToggle={() => toggle('services')} count={services.length}>
        <div className="space-y-1 mb-3">
          {grouped.map(([category, items]) => (
            <div key={category} className="flex items-center justify-between text-xs">
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[category] ?? 'bg-secondary text-foreground'}`}>
                {category}
              </span>
              <span className="font-semibold tabular-nums text-foreground">{items.length}</span>
            </div>
          ))}
        </div>
        {grouped.map(([category, items]) => (
          <div key={category} className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5 border-b border-border pb-1">
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${CATEGORY_COLORS[category] ?? 'bg-secondary text-foreground'}`}>
                {category}
              </span>
              <span className="text-[10px] text-muted-foreground">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map(service => (
                <div key={service.id} className="pl-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground leading-snug" style={{ wordBreak: 'break-word' }}>{service.name}</div>
                      {service.city && <div className="text-[10px] text-muted-foreground">{service.city}</div>}
                      {service.address && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span style={{ wordBreak: 'break-word' }}>{service.address}</span>
                          <CopyAddress text={`${service.address}, ${service.city}, NV`} />
                        </div>
                      )}
                    </div>
                  </div>
                  <ActionButtonRow
                    phone={service.phone}
                    address={service.address}
                    lat={service.lat}
                    lng={service.lng}
                    city={service.city}
                    website={service.website}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </DetailSection>

      <DetailSection title="Coverage Breakdown" isOpen={isOpen('coverage')} onToggle={() => toggle('coverage')}>
        <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
        <GapContextAlerts county={county} serviceCount={services.length} />
      </DetailSection>

      {(
        <DetailSection title="Member Volume" isOpen={isOpen('memberVolume')} onToggle={() => toggle('memberVolume')}>
          <MemberVolumeSection county={county} />
          <EngagementPriorityCard county={county} />
        </DetailSection>
      )}

      {hasUtilization && (
        <DetailSection title="Utilization & Engagement" isOpen={isOpen('utilization')} onToggle={() => toggle('utilization')}>
          <UtilizationEngagementSection county={county} />
          <UtilizationMetricsCard county={county} />
        </DetailSection>
      )}
    </>
  );
};

// ── Amtrak Rail Station (infrastructure overlay; not a provider/service) ──
const RailStationContent = ({ station }: { station: RailStation }) => {
  const bookingUrl = 'https://www.amtrak.com/tickets/departure.html';
  const stationUrl = station.stationCode
    ? `https://www.amtrak.com/stations/${station.stationCode.toLowerCase()}`
    : null;

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1 text-muted-foreground flex items-center gap-1">
        <TrainFront className="w-3 h-3" /> Amtrak Rail Station
      </div>
      <p className="text-sm font-semibold text-foreground mb-0.5">{station.name}</p>
      <p className="text-[11px] text-muted-foreground mb-0.5">
        {station.routeName ?? 'California Zephyr'}
        {station.stationCode && <span className="ml-1 font-mono">· {station.stationCode}</span>}
      </p>
      <p className="text-[10px] text-muted-foreground mb-2">1 daily train each direction through Nevada</p>

      {station.address && (
        <div className="mb-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{station.address}</span>
        </div>
      )}

      {/* Schedule (Published Timetable) */}
      {station.schedule && station.schedule.length > 0 && (
        <div className="mb-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Published Timetable</span>
            <span className="text-[9px] text-muted-foreground">not live status</span>
          </div>
          <div className="space-y-1">
            {station.schedule.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{s.direction}</span>
                  <span className="ml-1">{s.headsign}</span>
                </span>
                <span className="font-mono text-foreground">{s.scheduledTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fare (intentionally not static) */}
      <div className="mb-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Fare</div>
        <div className="text-[11px] text-foreground">Fare varies by date and availability</div>
        <div className="text-[10px] text-muted-foreground">Use live Amtrak lookup for current pricing</div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <ExternalLink className="w-3 h-3" />
          Check current fare &amp; schedule
        </a>
        {stationUrl && (
          <a
            href={stationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ExternalLink className="w-3 h-3" />
            Open station page
          </a>
        )}
      </div>
    </>
  );
};


// ── Local Transit Provider (additive access-support utility) ──
const LocalTransitProviderContent = ({ provider }: { provider: LocalTransitProvider }) => {
  const zones = getProviderZones(provider);
  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1 text-muted-foreground flex items-center gap-1">
        <Route className="w-3 h-3" /> Local Transit Provider
      </div>
      <p className="text-sm font-semibold text-foreground mb-0.5">{provider.name}</p>
      <p className="text-[11px] text-muted-foreground mb-2">{LOCAL_TRANSIT_SERVICE_TYPE_LABELS[provider.serviceType]}</p>

      {zones.length > 0 && (
        <div className="mb-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Operating areas</div>
          <ul className="space-y-0.5">
            {zones.map((z) => (
              <li key={z.id} className="text-[11px] text-foreground flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span>{z.shortLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-foreground mb-2 leading-snug">{provider.note}</p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-snug">Supports local access, not statewide long-distance travel.</p>

      {provider.fareNote && (
        <div className="mb-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">Fare</div>
          <div className="text-[11px] text-foreground">{provider.fareNote}</div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {provider.phone && (
          <ContactPhoneAction phone={provider.phone} label={`Call ${provider.name}`} />
        )}
        {provider.website && (
          <a
            href={provider.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ExternalLink className="w-3 h-3" />
            Open provider website
          </a>
        )}
      </div>
    </>
  );
};


export default CoverageDetailPanel;
