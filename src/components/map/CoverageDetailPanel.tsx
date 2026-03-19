import { useMemo } from 'react';
import { HELP_TOOLTIPS } from '@/data/help-tooltips';
import { X, MapPin, Building2, Stethoscope, Shield, Map as MapIcon, Phone, AlertTriangle, Users, Radio, Route, ArrowRight, PhoneCall, Navigation, Headphones } from 'lucide-react';
import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { Facility, defaultFacilities } from '@/data/facilities';
import { RuralService, ruralServices } from '@/data/rural-services';
import { COVERAGE_TYPE_LABELS, COVERAGE_TYPE_DESCRIPTIONS, PRIMARY_RESPONSE_LABELS } from '@/data/operational-coverage';
import { getCountyCoverageBreakdown, kmToMiles } from '@/utils/coverageZones';
import { COUNTY_FTE_MAP, fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS, LoadStatus } from '@/data/fte-capacity';
import { getCountyUtilization, getFacilityUtilization, getUtilizationTier, UTILIZATION_COLORS, OPERATIONAL_READ_COLORS } from '@/utils/utilizationAggregation';

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

  return (
    <div className="rounded-md border border-teal-200 bg-teal-50/50 px-2 py-1.5 mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Radio className="w-3 h-3 flex-shrink-0 text-teal-700" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">Coverage Breakdown</span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-700">Active Field Coverage</span>
          <span className="font-bold text-teal-800">{breakdown.activePercent}%</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-teal-600">Scheduled Outreach</span>
          <span className="font-bold text-teal-700">{breakdown.scheduledPercent}%</span>
        </div>
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
  const fte = COUNTY_FTE_MAP.get(county);
  if (!fte) return null;

  const role = FTE_ROLE_COLORS[fte.id];
  const coverageLabel = fte.hubLocation ? 'Active Field Coverage' : 'Remote Only';

  return (
    <div className={`rounded-md border-2 px-2 py-1.5 mb-2 ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-border'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role?.primary }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Assigned FTE</span>
      </div>
      <div className="text-[11px] font-medium text-foreground">{fte.label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{coverageLabel}</div>
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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Counties Served</div>
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

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Route className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">NBH Routing</span>
      </div>

      {/* Coverage-based routing info */}
      {breakdown.primaryType === 'active' ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 mb-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-teal-800">
            {breakdown.anchoringFtes.length > 0 ? breakdown.anchoringFtes[0] : 'Field FTE'}
          </div>
          <div className="text-[10px] text-teal-700">Same-day field response available ({breakdown.activePercent}% active coverage)</div>
          <div className="text-[10px] text-teal-700 italic">Primary: in-person engagement + direct placement coordination</div>
        </div>
      ) : (
        <div className="rounded-md border border-teal-100 bg-teal-50/60 px-2 py-1.5 mb-2 space-y-0.5">
          <div className="text-[11px] font-semibold text-teal-700">
            {breakdown.anchoringFtes.length > 0 ? breakdown.anchoringFtes[0] : 'Scheduled Outreach'}
          </div>
          <div className="text-[10px] text-teal-600">
            {breakdown.activePercent > 0
              ? `Partial active coverage (${breakdown.activePercent}%) — scheduled outreach for remainder`
              : 'Scheduled outreach only (not same-day)'}
          </div>
          <div className="text-[10px] text-teal-600 italic">Primary: remote triage + scheduled field visit</div>
        </div>
      )}

      {/* Recommended Action Path — dynamic by coverage type */}
      <div className="mt-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-foreground mb-1">Recommended Action Path</div>
        <div className="space-y-1">
          {(() => {
            const serving = fteCapacityData.filter(f => f.counties.includes(county));
            const hasField = serving.some(f => f.hubLocation !== null);
            const hasRemote = serving.some(f => f.hubLocation === null);
            const coverageType = hasField && hasRemote ? 'mixed' : hasField ? 'active' : 'remote';

            if (coverageType === 'active') {
              return (
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
              );
            }

            if (coverageType === 'mixed') {
              return (
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
              );
            }

            // remote only
            return (
              <>
                <ActionStep n={1}>Remote engagement (primary)</ActionStep>
                <ActionStep n={2}>Stabilize using local services</ActionStep>
                <ActionStep n={3}>Schedule outreach when field support becomes available</ActionStep>
                <ActionStep n={4}>
                  <div>Escalate if needed:</div>
                  <div className="pl-2 space-y-0.5 text-muted-foreground">
                    <div>• Transfer to Las Vegas or Reno</div>
                    <div>• Telehealth support</div>
                    <div>• Coordinate transport if appropriate</div>
                  </div>
                </ActionStep>
              </>
            );
          })()}
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

/** Field Capacity section — aggregates all FTEs serving a county */
const FieldCapacitySection = ({ county }: { county: string }) => {
  const serving = fteCapacityData.filter(f => f.counties.includes(county));
  if (serving.length === 0) {
    return (
      <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Field Capacity</div>
        <p className="text-[11px] text-muted-foreground italic">No field-based engagement coverage assigned to this county.</p>
      </div>
    );
  }

  const hasField = serving.some(f => f.hubLocation !== null);
  const hasRemote = serving.some(f => f.hubLocation === null);
  const coverageType = hasField && hasRemote ? 'Mixed' : hasField ? 'In-person available' : 'Remote only';

  return (
    <div className="rounded-md border px-2 py-1.5 mb-2 bg-secondary/50 border-border">
      <div className="flex items-center gap-1.5 mb-1">
        <Users className="w-3 h-3 flex-shrink-0 text-foreground/70" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Field Capacity</span>
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
        Detailed engagement capacity counts are not currently available for this county.
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

/** Local Resources section — rural services for a county */
const LocalResourcesSection = ({ county }: { county: string }) => {
  const services = useMemo(() => ruralServices.filter(s => s.county === county), [county]);

  if (services.length === 0) {
    return (
      <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5 mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Local Resources</div>
        <p className="text-[11px] text-muted-foreground italic">No known community resources mapped for this county.</p>
      </div>
    );
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RuralService[]>();
    services.forEach(s => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [services]);

  return (
    <div className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Local Resources</span>
        <span className="text-[10px] font-semibold text-foreground tabular-nums">{services.length}</span>
      </div>
      <div className="space-y-0.5 mb-1.5">
        {grouped.map(([category, items]) => (
          <div key={category} className="flex items-center justify-between text-[11px]">
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${CATEGORY_COLORS[category] ?? 'bg-secondary text-foreground'}`}>
              {category}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{items.length}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {services.slice(0, 10).map(service => (
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
        {services.length > 10 && (
          <p className="text-[9px] text-muted-foreground italic">+ {services.length - 10} more resources</p>
        )}
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
        const breakdown = getCountyCoverageBreakdown(county, coverageRadiusKm);
        const label = breakdown.primaryType === 'active'
          ? PRIMARY_RESPONSE_LABELS.active
          : breakdown.activePercent > 0
          ? PRIMARY_RESPONSE_LABELS.scheduled
          : PRIMARY_RESPONSE_LABELS.remote;
        return <p className="text-[11px] font-bold text-foreground mb-1.5">Primary Response: {label}</p>;
      })()}
      <GapContextAlerts county={county} serviceCount={countyServiceCount} />
      {/* 1. Member Volume */}
      {memberVolumeLayerOn && <MemberVolumeSection county={county} />}
      {/* 2. Coverage Breakdown */}
      <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
      {/* 3. Field Capacity */}
      <FieldCapacitySection county={county} />
      {/* 4. Utilization & Engagement */}
      <UtilizationEngagementSection county={county} />
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
  const typeLabel = facility.type === 'hospital' ? 'Hospital' :
    facility.type === 'tier1' ? 'Tier 1 Provider' : 'Clinic / FQHC';
  const typeColor = facility.type === 'hospital' ? 'bg-red-500' :
    facility.type === 'tier1' ? 'bg-yellow-500' : 'bg-blue-500';
  const coverageArea = getCountyArea(facility.county);
  const countyData = nevadaCounties.find(c => c.name === facility.county);

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
              <span>Critical Access Hospital (CAH)</span>
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
      <div className="text-xs text-foreground/80 space-y-1">
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
      </div>
      <UtilizationEngagementSection county={county} />
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
