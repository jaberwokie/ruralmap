import { useMemo } from 'react';
import { X, MapPin, Building2, Stethoscope, Shield, Map as MapIcon, Phone, AlertTriangle, Users, Radio, Route, ArrowRight, PhoneCall, Navigation, Headphones } from 'lucide-react';
import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { Facility, defaultFacilities } from '@/data/facilities';
import { RuralService, ruralServices } from '@/data/rural-services';
import { COVERAGE_TYPE_LABELS, COVERAGE_TYPE_DESCRIPTIONS, PRIMARY_RESPONSE_LABELS } from '@/data/operational-coverage';
import { getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { COUNTY_FTE_MAP, fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS } from '@/data/fte-capacity';

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
        <span className="text-[11px] font-semibold text-destructive">No hospital coverage within 50 km</span>
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

  const status = getLoadStatus(fte.currentLoad, fte.capacity);
  const statusColors = LOAD_STATUS_COLORS[status];
  const role = FTE_ROLE_COLORS[fte.id];

  return (
    <div className={`rounded-md border-2 px-2 py-1.5 mb-2 ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-border'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role?.primary }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Capacity Status</span>
      </div>
      <div className="text-[11px] font-medium text-foreground">{fte.label}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColors.dot }} />
        <span className={`text-[10px] ${statusColors.text}`}>
          {fte.currentLoad} / {fte.capacity} engagements · <span className="font-semibold">{LOAD_STATUS_LABELS[status]}</span>
        </span>
      </div>
      <div className={`text-[10px] italic ${statusColors.text} opacity-80 mt-0.5`}>
        {LOAD_STATUS_GUIDANCE[status]}
      </div>
    </div>
  );
};

const CoverageDetailPanel = ({ entity, hoverEntity, onClear, coverageRadiusKm = 120 }: CoverageDetailPanelProps) => {
  const display = entity ?? hoverEntity;
  const isLocked = !!entity;

  return (
    <div className="absolute top-3 right-3 z-[1000] w-64 max-h-[calc(100vh-120px)] rounded-lg border border-border bg-white/95 backdrop-blur-sm shadow-md flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2 flex-shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </h3>
        {isLocked && (
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
        {!display ? (
          <p className="text-xs text-muted-foreground/70 italic">
            Select a map element to view details.
          </p>
        ) : (
          <EntityContent entity={display} coverageRadiusKm={coverageRadiusKm} />
        )}
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

  const status = getLoadStatus(fte.currentLoad, fte.capacity);
  const statusColors = LOAD_STATUS_COLORS[status];
  const roleColors = FTE_ROLE_COLORS[fte.id];
  const Icon = meta.icon;
  const unit = fteId === 'remote' ? 'interactions' : 'engagements';

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

      <div className={`rounded-md border px-2 py-1.5 ${roleColors?.light ?? 'bg-secondary'} ${roleColors?.border ?? 'border-border'}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70 mb-0.5">Capacity</div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColors.dot }} />
          <span className={`text-[11px] font-medium ${statusColors.text}`}>
            {fte.currentLoad} / {fte.capacity} {unit} · <span className="font-semibold">{LOAD_STATUS_LABELS[status]}</span>
          </span>
        </div>
        <div className={`text-[10px] italic ${statusColors.text} opacity-80 mt-0.5`}>
          {LOAD_STATUS_GUIDANCE[status]}
        </div>
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

      {/* Recommended Action Path */}
      <div className="mt-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-foreground mb-1">Recommended Action Path</div>
        <div className="space-y-1">
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-bold text-primary mt-px">1</span>
            <span className="text-[10px] text-foreground/80">In-person engagement</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-bold text-primary mt-px">2</span>
            <span className="text-[10px] text-foreground/80">Stabilize using local services</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-bold text-primary mt-px">3</span>
            <div className="text-[10px] text-foreground/80 space-y-0.5">
              <div>Escalate if needed:</div>
              <div className="pl-2 space-y-0.5 text-muted-foreground">
                <div>• Transfer to Las Vegas or Reno</div>
                <div>• Telehealth support</div>
                <div>• Schedule outreach</div>
              </div>
            </div>
          </div>
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

// ── County ──
const CountyContent = ({ county, coverageRadiusKm }: { county: string; coverageRadiusKm: number }) => {
  const countyData = nevadaCounties.find(c => c.name === county);
  const area = getCountyArea(county);
  const volumeMap = useMemo(() => new Map(memberVolumeData.map(d => [d.county, d.memberCount])), []);
  const memberCount = volumeMap.get(county) ?? 0;
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
      <NBHRoutingSection county={county} coverageRadiusKm={coverageRadiusKm} />
      <CoverageBreakdownBadge county={county} coverageRadiusKm={coverageRadiusKm} />
      <CapacityStatusSection county={county} />
      <GapContextAlerts county={county} serviceCount={countyServiceCount} />
      <div className="space-y-1 text-xs text-foreground/80">
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
        <div className="flex justify-between"><span>Member Volume</span><span className="font-medium tabular-nums">{memberCount.toLocaleString()}</span></div>
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
      <p>No hospital or clinic within <strong>{radiusKm} km</strong> of this area.</p>
      <p className="italic">This region may have limited access to emergency and primary care services.</p>
    </div>
  </>
);

// ── Member Volume ──
const MemberVolumeContent = ({ county, memberCount, coverageRadiusKm }: { county: string; memberCount: number; coverageRadiusKm: number }) => {
  const maxCount = Math.max(...memberVolumeData.map(d => d.memberCount));
  const intensity = maxCount > 0 ? memberCount / maxCount : 0;
  const intensityLabel = intensity > 0.66 ? 'High' : intensity > 0.33 ? 'Moderate' : 'Low';
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
      <div className="text-xs text-foreground/80 space-y-1">
        <div className="flex justify-between"><span>Members</span><span className="font-semibold tabular-nums">{memberCount.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Intensity</span><span className="font-medium">{intensityLabel}</span></div>
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
      </div>
    </>
  );
};

// ── Rural Service Group ──
const RuralServiceGroupContent = ({ county, services, coverageRadiusKm }: { county: string; services: RuralService[]; coverageRadiusKm: number }) => {
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

      <CoverageBreakdownBadge county={county} />
      <GapContextAlerts county={county} serviceCount={services.length} />

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
