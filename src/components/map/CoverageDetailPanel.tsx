import { useMemo } from 'react';
import { HELP_TOOLTIPS } from '@/data/help-tooltips';
import { X, MapPin, Building2, Stethoscope, Shield, Map as MapIcon, Phone, AlertTriangle, Users, Radio, Route, ArrowRight, PhoneCall, Navigation, Headphones } from 'lucide-react';
import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { Facility, defaultFacilities, getFacilityClassification, getFacilityTypeLabel, isCriticalAccessHospital } from '@/data/facilities';
import { RuralService, ruralServices } from '@/data/rural-services';
import { COVERAGE_TYPE_LABELS, COVERAGE_TYPE_DESCRIPTIONS, PRIMARY_RESPONSE_LABELS } from '@/data/operational-coverage';
import { getCountyCoverageBreakdown, kmToMiles } from '@/utils/coverageZones';
import { COUNTY_FTE_MAP, fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS, LoadStatus } from '@/data/fte-capacity';
import { getCountyUtilization, getFacilityUtilization, getUtilizationTier, UTILIZATION_COLORS, OPERATIONAL_READ_COLORS, getCountyEngagementMetrics } from '@/utils/utilizationAggregation';

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

// ── Unified entity types ──

export type MapEntity =
  | { type: 'coverageArea'; area: CoverageArea }
  | { type: 'county'; county: string }
  | { type: 'facility'; facility: Facility }
  | { type: 'coverageGap'; radiusKm: number }
  | { type: 'memberVolume'; county: string; memberCount: number }
  | { type: 'ruralServiceGroup'; county: string; services: RuralService[] }
  | { type: 'fteDetail'; fteId: string };

interface CoverageDetailPanelProps {
  entity: MapEntity | null;
  hoverEntity: MapEntity | null;
  onClear: () => void;
  coverageRadiusKm?: number;
  memberVolumeLayerOn?: boolean;
  activeHelp?: string | null;
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

const CoverageDetailPanel = ({ entity, hoverEntity, onClear, coverageRadiusKm = 120, memberVolumeLayerOn = false, activeHelp = null }: CoverageDetailPanelProps) => {
  const display = entity ?? hoverEntity;
  const isLocked = !!entity;
  const helpData = activeHelp ? HELP_TOOLTIPS[activeHelp] : null;

  return (
    <div className="absolute top-3 right-3 z-[1000] w-64 max-h-[calc(100vh-120px)] rounded-lg border border-border bg-white/95 backdrop-blur-sm shadow-md flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2 flex-shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {helpData ? 'Help' : 'Details'}
        </h3>
        {isLocked && !helpData && (
          <button
            onClick={onClear}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-3 pb-3">
        {helpData ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">{helpData.label}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{helpData.explanation}</p>
          </div>
        ) : !display ? (
          <p className="text-xs text-muted-foreground/70 italic">
            Select a map element to view details.
          </p>
        ) : (
          <EntityContent entity={display} coverageRadiusKm={coverageRadiusKm} memberVolumeLayerOn={memberVolumeLayerOn} />
        )}
      </div>
    </div>
  );
};

// ── Renderer per entity type ──

const EntityContent = ({ entity, coverageRadiusKm, memberVolumeLayerOn }: { entity: MapEntity; coverageRadiusKm: number; memberVolumeLayerOn: boolean }) => {
  switch (entity.type) {
    case 'coverageArea': return <CoverageAreaContent area={entity.area} />;
    case 'county': return <CountyContent county={entity.county} coverageRadiusKm={coverageRadiusKm} memberVolumeLayerOn={memberVolumeLayerOn} />;
    case 'facility': return <FacilityContent facility={entity.facility} />;
    case 'coverageGap': return <CoverageGapContent radiusKm={entity.radiusKm} />;
    case 'memberVolume': return <MemberVolumeContent county={entity.county} memberCount={entity.memberCount} coverageRadiusKm={coverageRadiusKm} />;
    case 'ruralServiceGroup': return <RuralServiceGroupContent county={entity.county} services={entity.services} coverageRadiusKm={coverageRadiusKm} memberVolumeLayerOn={memberVolumeLayerOn} />;
    case 'fteDetail': return <FteDetailContent fteId={entity.fteId} />;
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
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
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
                  {service.phone && (
                    <a
                      href={`tel:${service.phone.replace(/[^\d+]/g, '')}`}
                      className="flex-shrink-0 p-0.5 rounded hover:bg-secondary text-primary"
                      title={service.phone}
                      onClick={e => e.stopPropagation()}
                    >
                      <Phone className="w-2.5 h-2.5" />
                    </a>
                  )}
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
const CountyContent = ({ county, coverageRadiusKm, memberVolumeLayerOn = false }: { county: string; coverageRadiusKm: number; memberVolumeLayerOn?: boolean }) => {
  const countyData = nevadaCounties.find(c => c.name === county);
  const area = getCountyArea(county);
  const countyServiceCount = COUNTY_SERVICE_COUNT.get(county) ?? 0;

  return (
    <>
      <p className="text-sm font-semibold text-foreground mb-1">{county} County</p>
      {(() => {
        const serving = fteCapacityData.filter(f => f.counties.includes(county));
        const hasField = serving.some(f => f.hubLocation !== null);
        const isRemoteOnly = serving.length === 0 || !hasField;
        const label = isRemoteOnly
          ? PRIMARY_RESPONSE_LABELS.remote
          : hasField
          ? PRIMARY_RESPONSE_LABELS.active
          : PRIMARY_RESPONSE_LABELS.scheduled;
        return <p className="text-[11px] font-bold text-foreground mb-1.5">Primary Response: {label}</p>;
      })()}
      <GapContextAlerts county={county} serviceCount={countyServiceCount} />
      {/* 1. Member Volume */}
      {memberVolumeLayerOn && <MemberVolumeSection county={county} />}
      <EngagementPriorityCard county={county} />
      {/* 2. Coverage Breakdown */}
      <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
      {/* 3. Field Capacity */}
      <FieldCapacitySection county={county} />
      {/* 4. Utilization & Engagement */}
      <UtilizationEngagementSection county={county} />
      {/* 4b. Utilization Metrics */}
      <UtilizationMetricsCard county={county} />
      {/* 5. Assigned FTE */}
      <CapacityStatusSection county={county} />
      {/* 6. Recommended Action Path */}
      <NBHRoutingSection county={county} coverageRadiusKm={coverageRadiusKm} />
      {/* 7. Local Resources */}
      <LocalResourcesSection county={county} />
      <div className="space-y-1 text-xs text-foreground/80">
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
        <div className="flex justify-between"><span>Rural Access Dependence</span><span className="font-medium">{RURAL_ACCESS_DEPENDENCE[area]}</span></div>
        {countyData?.secondaryZone && (
          <div className="text-[10px] text-muted-foreground italic">
            Secondary support from Area {countyData.secondaryZone.replace('area', '')}
          </div>
        )}
      </div>
    </>
  );
};

// ── Facility ──
const FacilityContent = ({ facility }: { facility: Facility }) => {
  const isHighUtilClinic = facility.tier === 'tier1';
  const classification = getFacilityClassification(facility);
  const typeLabel = classification === 'clinic_provider' && isHighUtilClinic
    ? 'Clinic / Community Provider (High Utilization)'
    : getFacilityTypeLabel(facility);
  const typeColor = facility.type === 'hospital' ? 'bg-red-500' : 'bg-blue-500';
  const coverageArea = getCountyArea(facility.county);
  const countyData = nevadaCounties.find(c => c.name === facility.county);
  const isCah = isCriticalAccessHospital(facility);

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
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span>{facility.city}, {facility.county} County</span>
        </div>
        {facility.address && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span style={{ wordBreak: 'break-word' }}>{facility.address}, {facility.city}, NV</span>
          </div>
        )}
        {facility.type === 'hospital' && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span>{isCah ? 'Critical Access Hospital (CAH)' : 'Facility'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 flex-shrink-0" />
              <span>NRHP Member</span>
            </div>
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
          </>
        )}
        {facility.service && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Stethoscope className="w-3 h-3 flex-shrink-0" />
            <span>
              {facility.service === 'BH' ? 'Behavioral Health' : 'Primary Care'}
              {facility.volume ? ` · ${facility.volume.toLocaleString()} visits` : ''}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⊕</span>
          <span>{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</span>
        </div>
      </div>
      <FacilityUtilizationSection facility={facility} />
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
  const area = getCountyArea(county);
  const countyServiceCount = COUNTY_SERVICE_COUNT.get(county) ?? 0;

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'hsl(190, 60%, 40%)' }}>
        ● Member Volume
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">{county} County</p>
      <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
      <GapContextAlerts county={county} serviceCount={countyServiceCount} />
      <MemberVolumeSection county={county} />
      <EngagementPriorityCard county={county} />
      <div className="text-xs text-foreground/80 space-y-1">
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
      </div>
      <UtilizationEngagementSection county={county} />
      <UtilizationMetricsCard county={county} />
    </>
  );
};

// ── Rural Service Group ──
const RuralServiceGroupContent = ({ county, services, coverageRadiusKm, memberVolumeLayerOn = false }: { county: string; services: RuralService[]; coverageRadiusKm: number; memberVolumeLayerOn?: boolean }) => {
  const grouped = useMemo(() => {
    const map = new Map<string, RuralService[]>();
    services.forEach(s => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [services]);

  return (
    <>
      <p className="text-sm font-semibold text-foreground">{county} County</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rural Services</p>

      <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
      <GapContextAlerts county={county} serviceCount={services.length} />
      {memberVolumeLayerOn && <MemberVolumeSection county={county} />}
      <EngagementPriorityCard county={county} />
      <UtilizationEngagementSection county={county} />
      <UtilizationMetricsCard county={county} />

      <p className="text-2xl font-bold text-foreground tabular-nums">{services.length}</p>
      <p className="text-[10px] text-muted-foreground mb-3">total services</p>

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
          <div className="space-y-1.5">
            {items.map(service => (
              <div key={service.id} className="flex items-start justify-between gap-1 pl-1">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground leading-snug" style={{ wordBreak: 'break-word' }}>{service.name}</div>
                  {service.city && <div className="text-[10px] text-muted-foreground">{service.city}</div>}
                </div>
                {service.phone && (
                  <a
                    href={`tel:${service.phone.replace(/[^\d+]/g, '')}`}
                    className="flex-shrink-0 p-1 rounded hover:bg-secondary text-primary"
                    title={service.phone}
                    onClick={e => e.stopPropagation()}
                  >
                    <Phone className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default CoverageDetailPanel;
