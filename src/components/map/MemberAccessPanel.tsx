import { MapPin, Navigation, AlertTriangle, CheckCircle2, Brain, Route, TrainFront, Bus } from 'lucide-react';
import { computeFieldResponseStrain, STRAIN_TONE, getStrainRecommendation, getCapacityBoundaryLabel, getStrainTier, STRAIN_TIER_LABEL, STRAIN_TIER_TONE, STRAIN_TIER_OPERATIONAL_REALITY } from '@/utils/fieldResponseStrain';
import { FTE_ROLE_COLORS } from '@/data/fte-capacity';
import type { MemberAccessAnalysis, AccessTierKey } from '@/hooks/useMemberAccess';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { isBehavioralHealthService } from '@/utils/ruralServiceClassification';
import { checkHighwayAccess } from '@/utils/highwayProximity';
import { evaluateRailRelevance } from '@/utils/railProximity';
import { findZoneContaining } from '@/data/local-transit-zones';
import {
  getProviderForZoneId,
  LOCAL_TRANSIT_SUPPORT_LEVEL_LABELS,
  type LocalTransitSupportLevel,
} from '@/data/local-transit-providers';
import { getCountyForLocation } from '@/utils/countyLookup';
import { countyHasFieldCoverage } from '@/utils/fieldCoverageStatus';
import EngagementOwnershipBlock from '@/components/map/EngagementOwnershipBlock';
import TransportationCoordinationSection from '@/components/map/TransportationCoordinationSection';

const TIER_COLORS: Record<AccessTierKey, string> = {
  local: 'hsl(142, 60%, 40%)',
  managed: 'hsl(38, 85%, 50%)',
  highFriction: 'hsl(0, 65%, 55%)',
  nonViable: 'hsl(0, 0%, 55%)',
};

const TIER_DESCRIPTIONS: Record<AccessTierKey, string> = {
  local: 'Realistic for local in-person coordination',
  managed: 'Possible, but transport or planning is required',
  highFriction: 'Not reliable for routine engagement',
  nonViable: 'Too far for standard in-person access',
};

const RECOMMENDATION_STYLE: Record<string, { icon: typeof CheckCircle2; color: string; support: string }> = {
  'Local in-person engagement viable': {
    icon: CheckCircle2,
    color: 'hsl(142, 60%, 40%)',
    support: 'Use local in-person coordination as the primary approach.',
  },
  'Coordinated access required (transport needed)': {
    icon: Navigation,
    color: 'hsl(38, 85%, 50%)',
    support: 'Use scheduled coordination and plan for transportation barriers.',
  },
  'Remote engagement recommended': {
    icon: AlertTriangle,
    color: 'hsl(0, 65%, 55%)',
    support: 'Use remote engagement as the default unless the need is urgent or life-threatening.',
  },
};

interface TaggedResource {
  name: string;
  distanceMi: number;
  isBH: boolean;
  highwayCorridor?: string;
  /** Original entity for click-through. Exactly one of facility/service is set. */
  facility?: Facility;
  service?: RuralService;
}

const classifyFacility = (f: Facility & { distanceMi: number }): TaggedResource => {
  const hw = checkHighwayAccess(f.lat, f.lng);
  return {
    name: f.name,
    distanceMi: f.distanceMi,
    isBH: facilityOffersBehavioralHealth(f),
    highwayCorridor: hw.hasAccess ? hw.corridor?.label : undefined,
    facility: f,
  };
};

const classifyService = (s: RuralService & { distanceMi: number }): TaggedResource => {
  const hw = checkHighwayAccess(s.lat, s.lng);
  return {
    name: s.name,
    distanceMi: s.distanceMi,
    isBH: isBehavioralHealthService(s),
    highwayCorridor: hw.hasAccess ? hw.corridor?.label : undefined,
    service: s,
  };
};

interface ResourceNameProps {
  resource: TaggedResource;
  onSelect?: (r: TaggedResource) => void;
}

const ResourceName = ({ resource, onSelect }: ResourceNameProps) => {
  const { name, distanceMi, isBH, highwayCorridor } = resource;
  const clickable = !!onSelect && (resource.facility || resource.service);
  const content = (
    <>
      <span className="text-foreground truncate flex items-center gap-1 text-left">
        {isBH && <Brain className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'hsl(270, 50%, 55%)' }} />}
        {name}
      </span>
      <span className="text-muted-foreground flex-shrink-0 flex items-center gap-1">
        {highwayCorridor && (
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground/70" title={`Near ${highwayCorridor}`}>
            <Route className="w-2 h-2" />
            {highwayCorridor}
          </span>
        )}
        {distanceMi.toFixed(1)} mi
      </span>
    </>
  );
  if (clickable) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect?.(resource); }}
        className="w-full flex items-center justify-between gap-1 text-[10px] rounded px-1 py-0.5 -mx-1 hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none transition-colors cursor-pointer text-left"
        title="Open provider details"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-1 text-[10px]">
      {content}
    </div>
  );
};

const BHCounts = ({ bhCount, total, hwCount }: { bhCount: number; total: number; hwCount?: number }) => (
  <div className="ml-3.5 mt-0.5 flex items-center gap-2 text-[9px]">
    <span className="text-muted-foreground">{total} resource{total !== 1 ? 's' : ''}</span>
    <span className="text-muted-foreground">·</span>
    <span style={{ color: bhCount > 0 ? 'hsl(270, 50%, 55%)' : undefined }} className={bhCount === 0 ? 'text-muted-foreground/60' : ''}>
      BH: {bhCount}
    </span>
    {hwCount != null && hwCount > 0 && (
      <>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground/70 flex items-center gap-0.5">
          <Route className="w-2 h-2" />
          Hwy: {hwCount}
        </span>
      </>
    )}
  </div>
);

const BHGapWarning = () => (
  <p className="text-[9px] ml-3.5 mt-0.5 italic" style={{ color: 'hsl(270, 50%, 55%)' }}>
    No behavioral health services available in this range
  </p>
);

interface TierSectionProps {
  label: string;
  rangeLabel: string;
  tierKey: AccessTierKey;
  facilities: (Facility & { distanceMi: number })[];
  services: (RuralService & { distanceMi: number })[];
  onSelectResource?: (r: TaggedResource) => void;
}

const TierSection = ({ label, rangeLabel, tierKey, facilities, services, onSelectResource }: TierSectionProps) => {
  const combined: TaggedResource[] = [
    ...facilities.map(classifyFacility),
    ...services.map(classifyService),
  ].sort((a, b) => a.distanceMi - b.distanceMi);

  const total = combined.length;
  const bhCount = combined.filter(r => r.isBH).length;
  const color = TIER_COLORS[tierKey];
  const description = TIER_DESCRIPTIONS[tierKey];
  const showBHGap = total > 0 && bhCount === 0 && (tierKey === 'local' || tierKey === 'managed');
  const hwCount = combined.filter(r => r.highwayCorridor).length;

  // Non-viable: count only, visually muted
  if (tierKey === 'nonViable') {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0 opacity-60" style={{ background: color }} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground/70">({rangeLabel})</span>
        </div>
        <p className="text-[9px] text-muted-foreground/60 italic ml-3.5 mt-0.5">{description}</p>
        <BHCounts bhCount={bhCount} total={total} hwCount={hwCount} />
      </div>
    );
  }

  // High Friction: muted presentation, top 2 only
  if (tierKey === 'highFriction') {
    const showItems = total <= 3 ? combined : combined.slice(0, 2);
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0 opacity-75" style={{ background: color }} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground/70">({rangeLabel})</span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">{total}</span>
        </div>
        <p className="text-[9px] text-muted-foreground/60 italic ml-3.5 mt-0.5">{description}</p>
        <BHCounts bhCount={bhCount} total={total} hwCount={hwCount} />
        {showItems.length > 0 && (
          <div className="ml-3.5 mt-1 space-y-0.5 opacity-80">
            {showItems.map((item, i) => (
              <ResourceName key={i} resource={item} onSelect={onSelectResource} />
            ))}
            {combined.length > showItems.length && (
              <p className="text-[9px] text-muted-foreground/50">+{combined.length - showItems.length} more</p>
            )}
          </div>
        )}
        {total === 0 && (
          <p className="text-[10px] text-muted-foreground/50 italic ml-3.5 mt-0.5">None in range</p>
        )}
      </div>
    );
  }

  // Local / Managed: full presentation, BH-first ordering
  const bhResources = combined.filter(r => r.isBH);
  const otherResources = combined.filter(r => !r.isBH);
  const prioritized = [...bhResources, ...otherResources];
  const showItems = prioritized.slice(0, 3);

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">({rangeLabel})</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{total}</span>
      </div>
      {tierKey === 'managed' && (
        <p className="text-[9px] text-muted-foreground/70 italic ml-3.5 mt-0.5">{description}</p>
      )}
      <BHCounts bhCount={bhCount} total={total} hwCount={hwCount} />
      {showBHGap && <BHGapWarning />}
      {showItems.length > 0 && (
        <div className="ml-3.5 mt-1 space-y-0.5">
          {showItems.map((item, i) => (
            <ResourceName key={i} resource={item} onSelect={onSelectResource} />
          ))}
          {prioritized.length > showItems.length && (
            <p className="text-[9px] text-muted-foreground/60">+{prioritized.length - showItems.length} more</p>
          )}
        </div>
      )}
      {total === 0 && (
        <p className="text-[10px] text-muted-foreground/60 italic ml-3.5 mt-0.5">None in range</p>
      )}
    </div>
  );
};

interface MemberAccessPanelProps {
  analysis: MemberAccessAnalysis;
  /** Active drive-time radius from sidebar slider — feeds Field Response Strain. */
  coverageRadiusKm?: number;
  /** Open a facility's detail view, preserving member context. */
  onFacilitySelect?: (facility: Facility) => void;
  /** Open a rural service's detail view, preserving member context. */
  onServiceSelect?: (service: RuralService) => void;
}

const MemberAccessPanel = ({ analysis, coverageRadiusKm = 120, onFacilitySelect, onServiceSelect }: MemberAccessPanelProps) => {
  const recStyle = RECOMMENDATION_STYLE[analysis.recommendation] ?? {
    icon: AlertTriangle,
    color: 'hsl(0, 0%, 55%)',
    support: 'No realistic in-person options were found within the defined access ranges.',
  };
  const RecIcon = recStyle.icon;

  const handleSelectResource = (r: TaggedResource) => {
    if (r.facility) onFacilitySelect?.(r.facility);
    else if (r.service) onServiceSelect?.(r.service);
  };

  const totalResources = analysis.tiers.reduce(
    (sum, t) => sum + t.facilities.length + t.services.length, 0
  );

  // BH gap across Local + Managed (Tier 1–2)
  const localManaged = analysis.tiers.filter(t => t.key === 'local' || t.key === 'managed');
  const bhInLocalManaged = localManaged.some(t =>
    t.facilities.some(f => facilityOffersBehavioralHealth(f)) ||
    t.services.some(s => isBehavioralHealthService(s))
  );

  // ── Transport Context (rail) — additive, only surfaces in narrow northern long-distance cases.
  const railCandidates = analysis.tiers.flatMap(t => [
    ...t.facilities.map(f => ({ name: f.name, lat: f.lat, lng: f.lng, distanceMi: f.distanceMi })),
    ...t.services.map(s => ({ name: s.name, lat: s.lat, lng: s.lng, distanceMi: s.distanceMi })),
  ]);
  const railContext = evaluateRailRelevance(analysis.location, railCandidates);
  if (import.meta.env.DEV) {
    console.info('[Rail] member relevance evaluation', {
      memberLat: analysis.location.lat,
      candidates: railCandidates.length,
      relevant: railContext.relevant,
      message: railContext.message,
    });
  }

  // ── Local Transit Context (additive) ──
  // Strictly does not affect tier scoring, recommendation, or member distance math.
  const memberZone = findZoneContaining(analysis.location.lat, analysis.location.lng);
  const inRangeDestinations = analysis.tiers
    .filter(t => t.key === 'local' || t.key === 'managed')
    .flatMap(t => [
      ...t.facilities.map(f => ({ lat: f.lat, lng: f.lng, distanceMi: f.distanceMi })),
      ...t.services.map(s => ({ lat: s.lat, lng: s.lng, distanceMi: s.distanceMi })),
    ])
    .sort((a, b) => a.distanceMi - b.distanceMi);
  const closestDest = inRangeDestinations[0];
  const destZone = closestDest ? findZoneContaining(closestDest.lat, closestDest.lng) : null;
  const sharedZone = memberZone && destZone && memberZone.id === destZone.id ? memberZone : null;

  // Resolve a support level for the zone, if any.
  const memberProvider = memberZone ? getProviderForZoneId(memberZone.id) : null;
  const destProvider = destZone ? getProviderForZoneId(destZone.id) : null;
  const memberSupport: LocalTransitSupportLevel | null = memberProvider?.supportLevel ?? null;

  let transitMessage: string | null = null;
  if (sharedZone) {
    transitMessage = 'Both member and destination fall within the same local transit support area.';
  } else if (memberZone && destZone) {
    transitMessage = 'Local transit exists in both areas, but continuity of service is not implied.';
  } else if (memberZone && memberSupport === 'structured_local_transit') {
    transitMessage = 'Structured local transit may support local access in this area.';
  } else if (memberZone && memberSupport === 'limited_community_transit') {
    transitMessage = 'Limited community transit may support some local access.';
  } else if (memberZone) {
    // Zone present but provider/support unresolved — keep neutral.
    transitMessage = `Local transit may support in-town access in the ${memberZone.shortLabel}.`;
  } else {
    transitMessage = 'No local transit provider identified in this area.';
  }

  if (import.meta.env.DEV) {
    console.info('[LocalTransit] member context evaluation', {
      memberZone: memberZone?.id ?? null,
      destZone: destZone?.id ?? null,
      sharedZone: sharedZone?.id ?? null,
      memberSupportLevel: memberSupport,
      destSupportLevel: destProvider?.supportLevel ?? null,
      message: transitMessage,
    });
  }

  // ── Field Response Strain (member-level) ──
  // Reuses the same helper that powers the county detail panel's strain block.
  const strain = computeFieldResponseStrain(
    { lat: analysis.location.lat, lng: analysis.location.lng },
    coverageRadiusKm,
  );
  const strainSameDayLabel = strain
    ? strain.withinActive
      ? 'Within same-day field reach'
      : strain.coverage === 'noSameDay'
        ? 'Outside realistic same-day field response'
        : 'Strained — beyond active radius, scheduled outreach'
    : null;
  const strainSameDayTone = strain
    ? strain.withinActive
      ? 'text-emerald-700'
      : strain.coverage === 'noSameDay' ? 'text-red-600' : 'text-amber-700'
    : 'text-muted-foreground';
  const responderRole = strain?.responder ? FTE_ROLE_COLORS[strain.responder.id] : null;

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary">Member Access Analysis</p>
          {analysis.location.address && (
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{analysis.location.address}</p>
          )}
        </div>
      </div>

      {strain && (() => {
        const tier = getStrainTier(strain);
        return (
        <div className="rounded-md border border-border bg-card px-2 py-2 mb-2 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3 h-3 flex-shrink-0 text-foreground/70" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Field Response Strain</span>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${STRAIN_TIER_TONE[tier]}`}>{STRAIN_TIER_LABEL[tier]}</span>
          </div>

          {strain.responder ? (
            <>
              <div className="flex items-start gap-1.5">
                <div className="w-2 h-2 mt-1 rounded-full flex-shrink-0" style={{ backgroundColor: responderRole?.primary }} />
                <div className="text-[11px] text-foreground leading-tight">
                  <span className="font-medium">Likely responder:</span> {strain.responder.label}
                  {strain.responder.anchorSite && (
                    <span className="text-muted-foreground"> · from {strain.responder.anchorSite.name}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-muted-foreground">One-way</span>
                <span className="text-right font-medium text-foreground">~{strain.oneWayMi} mi · ~{strain.oneWayMin} min</span>
                <span className="text-muted-foreground">Round-trip</span>
                <span className="text-right font-semibold text-foreground">~{strain.roundTripMi} mi · ~{strain.roundTripMin} min</span>
              </div>

              <div className={`text-[10px] font-medium ${strainSameDayTone}`}>{strainSameDayLabel}</div>
              <div className={`text-[10px] ${STRAIN_TONE[strain.coverage]}`}>{strain.coverageLabel}</div>
              <div className={`text-[11px] font-semibold ${STRAIN_TONE[strain.coverage]} pt-1 border-t border-border/60`}>
                {getStrainRecommendation(strain)}
              </div>
              <div className={`text-[10px] ${STRAIN_TONE[strain.coverage]} opacity-90`}>
                {getCapacityBoundaryLabel(strain)}
              </div>

              <div className={`text-[10px] leading-tight pt-1 border-t border-border/60 ${STRAIN_TIER_TONE[tier]}`}>
                <span className="font-semibold">Operational reality:</span> {STRAIN_TIER_OPERATIONAL_REALITY[tier]}
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-foreground leading-tight">
                <span className="font-medium">Field response:</span> Remote coordination only
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                No realistic same-day field response from current FTE placement.
              </div>
              <div className={`text-[10px] leading-tight pt-1 border-t border-border/60 ${STRAIN_TIER_TONE[tier]}`}>
                <span className="font-semibold">Operational reality:</span> {STRAIN_TIER_OPERATIONAL_REALITY[tier]}
              </div>
            </>
          )}

          <div className="text-[9px] text-muted-foreground/80 italic leading-tight pt-0.5 border-t border-border/60">
            Estimated from straight-line distance to anchor site at ~80 km/h rural average. Round-trip reflects staff time consumed. Remote support remains available regardless of field response reach.
          </div>
        </div>
        );
      })()}

      <div className="divide-y divide-border/50">
        {analysis.tiers.map(tier => (
          <TierSection
            key={tier.key}
            label={tier.label}
            rangeLabel={tier.rangeLabel}
            tierKey={tier.key}
            facilities={tier.facilities}
            services={tier.services}
            onSelectResource={handleSelectResource}
          />
        ))}
      </div>

      {/* BH gap summary above recommendation */}
      {!bhInLocalManaged && totalResources > 0 && (
        <div className="mt-2 px-2 py-1 rounded text-[10px] italic" style={{ color: 'hsl(270, 50%, 55%)', background: 'hsl(270, 50%, 95%)' }}>
          No behavioral health access available within 25 miles
        </div>
      )}

      {/* Transport Context — additive, only shown when rail is meaningfully relevant */}
      {railContext.relevant && railContext.message && (
        <div className="mt-2 px-2 py-1.5 rounded border border-border/60 bg-secondary/40">
          <div className="flex items-start gap-1.5">
            <TrainFront className="w-3 h-3 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Transport Context</p>
              <p className="text-[10px] text-foreground leading-snug mt-0.5">{railContext.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Local Transit Context — additive, only shown when member or shared zone is detected */}
      {transitMessage && (
        <div className="mt-2 px-2 py-1.5 rounded border border-border/60 bg-secondary/40">
          <div className="flex items-start gap-1.5">
            <Bus className="w-3 h-3 flex-shrink-0 mt-0.5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Local Transit</p>
              <p className="text-[10px] text-foreground leading-snug mt-0.5">{transitMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Transportation Coordination — Mobility Manager for member's county. */}
      {(() => {
        const memberCounty = getCountyForLocation(analysis.location.lat, analysis.location.lng);
        if (!memberCounty) return null;
        return (
          <TransportationCoordinationSection
            county={memberCounty}
            title="Transportation Coordination Available"
          />
        );
      })()}

      {/* Engagement Ownership — Primary CHW vs Remote CHW (display only) */}
      {(() => {
        const memberCounty = getCountyForLocation(analysis.location.lat, analysis.location.lng);
        if (!memberCounty) return null;
        return (
          <div className="mt-3">
            <EngagementOwnershipBlock county={memberCounty} compact />
          </div>
        );
      })()}

      {/* Recommendation */}
      <div className="mt-3 pt-2 border-t border-border rounded-md px-2 py-2" style={{ background: `${recStyle.color}10` }}>
        <div className="flex items-start gap-1.5">
          <RecIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: recStyle.color }} />
          <div>
            <p className="text-[11px] font-semibold" style={{ color: recStyle.color }}>{analysis.recommendation}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{recStyle.support}</p>
          </div>
        </div>
        {totalResources === 0 && (
          <p className="text-[9px] text-muted-foreground/70 italic mt-1.5 ml-5">
            No realistic in-person options were found within the defined access ranges.
          </p>
        )}
      </div>
    </>
  );
};

export default MemberAccessPanel;
