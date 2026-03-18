import { useMemo } from 'react';
import { X, MapPin, Building2, Stethoscope, Shield, Map as MapIcon, Phone, AlertTriangle } from 'lucide-react';
import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties, getCountyArea } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { Facility, defaultFacilities } from '@/data/facilities';
import { RuralService, ruralServices } from '@/data/rural-services';

/** Counties with no hospital or clinic within ~50 km of their geographic center */
const GAP_COUNTIES = (() => {
  const R = 50; // km threshold
  const toRad = (d: number) => (d * Math.PI) / 180;
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  // Approximate county centers from boundary data
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
  | { type: 'ruralServiceGroup'; county: string; services: RuralService[] };

interface CoverageDetailPanelProps {
  entity: MapEntity | null;
  hoverEntity: MapEntity | null;
  onClear: () => void;
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

const CoverageDetailPanel = ({ entity, hoverEntity, onClear }: CoverageDetailPanelProps) => {
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
            Hover or select a map element to view details.
          </p>
        ) : (
          <EntityContent entity={display} />
        )}
      </div>
    </div>
  );
};

// ── Renderer per entity type ──

const EntityContent = ({ entity }: { entity: MapEntity }) => {
  switch (entity.type) {
    case 'coverageArea': return <CoverageAreaContent area={entity.area} />;
    case 'county': return <CountyContent county={entity.county} />;
    case 'facility': return <FacilityContent facility={entity.facility} />;
    case 'coverageGap': return <CoverageGapContent radiusKm={entity.radiusKm} />;
    case 'memberVolume': return <MemberVolumeContent county={entity.county} memberCount={entity.memberCount} />;
    case 'ruralServiceGroup': return <RuralServiceGroupContent county={entity.county} services={entity.services} />;
    default: return null;
  }
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

// ── County ──
const CountyContent = ({ county }: { county: string }) => {
  const countyData = nevadaCounties.find(c => c.name === county);
  const area = getCountyArea(county);
  const volumeMap = useMemo(() => new Map(memberVolumeData.map(d => [d.county, d.memberCount])), []);
  const memberCount = volumeMap.get(county) ?? 0;

  const isGap = GAP_COUNTIES.has(county);

  return (
    <>
      <p className="text-sm font-semibold text-foreground mb-1">{county} County</p>
      {isGap && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          <span className="text-[11px] font-semibold text-destructive">No hospital coverage within 50 km</span>
        </div>
      )}
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
const MemberVolumeContent = ({ county, memberCount }: { county: string; memberCount: number }) => {
  const maxCount = Math.max(...memberVolumeData.map(d => d.memberCount));
  const intensity = maxCount > 0 ? memberCount / maxCount : 0;
  const intensityLabel = intensity > 0.66 ? 'High' : intensity > 0.33 ? 'Moderate' : 'Low';
  const area = getCountyArea(county);

  return (
    <>
      <div className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'hsl(190, 60%, 40%)' }}>
        ● Member Volume
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">{county} County</p>
      <div className="text-xs text-foreground/80 space-y-1">
        <div className="flex justify-between"><span>Members</span><span className="font-semibold tabular-nums">{memberCount.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Intensity</span><span className="font-medium">{intensityLabel}</span></div>
        <div className="flex justify-between"><span>Coverage Area</span><span className="font-medium">{COVERAGE_AREA_LABELS[area]}</span></div>
      </div>
    </>
  );
};

// ── Rural Service Group ──
const RuralServiceGroupContent = ({ county, services }: { county: string; services: RuralService[] }) => {
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

  const isGap = GAP_COUNTIES.has(county);

  return (
    <>
      {/* Header */}
      <p className="text-sm font-semibold text-foreground">{county} County</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rural Services</p>

      {isGap && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
          <span className="text-[11px] font-semibold text-destructive">No hospital coverage within 50 km</span>
        </div>
      )}
      {isGap && services.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-[11px] font-medium text-amber-700">Services present but limited access</span>
        </div>
      )}

      <p className="text-2xl font-bold text-foreground tabular-nums">{services.length}</p>
      <p className="text-[10px] text-muted-foreground mb-3">total services</p>

      {/* Category breakdown */}
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

      {/* Grouped service list */}
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
