import { MapPin, Navigation, AlertTriangle, CheckCircle2, Brain } from 'lucide-react';
import type { MemberAccessAnalysis, AccessTierKey } from '@/hooks/useMemberAccess';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { isBehavioralHealthService } from '@/utils/ruralServiceClassification';

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
}

const classifyFacility = (f: Facility & { distanceMi: number }): TaggedResource => ({
  name: f.name,
  distanceMi: f.distanceMi,
  isBH: facilityOffersBehavioralHealth(f),
});

const classifyService = (s: RuralService & { distanceMi: number }): TaggedResource => ({
  name: s.name,
  distanceMi: s.distanceMi,
  isBH: isBehavioralHealthService(s),
});

const ResourceName = ({ name, distanceMi, isBH }: { name: string; distanceMi: number; isBH?: boolean }) => (
  <div className="flex items-center justify-between gap-1 text-[10px]">
    <span className="text-foreground truncate flex items-center gap-1">
      {isBH && <Brain className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'hsl(270, 50%, 55%)' }} />}
      {name}
    </span>
    <span className="text-muted-foreground flex-shrink-0">{distanceMi.toFixed(1)} mi</span>
  </div>
);

const BHCounts = ({ bhCount, total }: { bhCount: number; total: number }) => (
  <div className="ml-3.5 mt-0.5 flex items-center gap-2 text-[9px]">
    <span className="text-muted-foreground">{total} resource{total !== 1 ? 's' : ''}</span>
    <span className="text-muted-foreground">·</span>
    <span style={{ color: bhCount > 0 ? 'hsl(270, 50%, 55%)' : undefined }} className={bhCount === 0 ? 'text-muted-foreground/60' : ''}>
      BH: {bhCount}
    </span>
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
}

const TierSection = ({ label, rangeLabel, tierKey, facilities, services }: TierSectionProps) => {
  const combined: TaggedResource[] = [
    ...facilities.map(classifyFacility),
    ...services.map(classifyService),
  ].sort((a, b) => a.distanceMi - b.distanceMi);

  const total = combined.length;
  const bhCount = combined.filter(r => r.isBH).length;
  const color = TIER_COLORS[tierKey];
  const description = TIER_DESCRIPTIONS[tierKey];
  const showBHGap = total > 0 && bhCount === 0 && (tierKey === 'local' || tierKey === 'managed');

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
        <BHCounts bhCount={bhCount} total={total} />
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
        <BHCounts bhCount={bhCount} total={total} />
        {showItems.length > 0 && (
          <div className="ml-3.5 mt-1 space-y-0.5 opacity-80">
            {showItems.map((item, i) => (
              <ResourceName key={i} name={item.name} distanceMi={item.distanceMi} isBH={item.isBH} />
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
      <BHCounts bhCount={bhCount} total={total} />
      {showBHGap && <BHGapWarning />}
      {showItems.length > 0 && (
        <div className="ml-3.5 mt-1 space-y-0.5">
          {showItems.map((item, i) => (
            <ResourceName key={i} name={item.name} distanceMi={item.distanceMi} isBH={item.isBH} />
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

const MemberAccessPanel = ({ analysis }: { analysis: MemberAccessAnalysis }) => {
  const recStyle = RECOMMENDATION_STYLE[analysis.recommendation] ?? {
    icon: AlertTriangle,
    color: 'hsl(0, 0%, 55%)',
    support: 'No realistic in-person options were found within the defined access ranges.',
  };
  const RecIcon = recStyle.icon;

  const totalResources = analysis.tiers.reduce(
    (sum, t) => sum + t.facilities.length + t.services.length, 0
  );

  // BH gap across Local + Managed (Tier 1–2)
  const localManaged = analysis.tiers.filter(t => t.key === 'local' || t.key === 'managed');
  const bhInLocalManaged = localManaged.some(t =>
    t.facilities.some(f => facilityOffersBehavioralHealth(f)) ||
    t.services.some(s => isBehavioralHealthService(s))
  );

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

      <div className="divide-y divide-border/50">
        {analysis.tiers.map(tier => (
          <TierSection
            key={tier.key}
            label={tier.label}
            rangeLabel={tier.rangeLabel}
            tierKey={tier.key}
            facilities={tier.facilities}
            services={tier.services}
          />
        ))}
      </div>

      {/* BH gap summary above recommendation */}
      {!bhInLocalManaged && totalResources > 0 && (
        <div className="mt-2 px-2 py-1 rounded text-[10px] italic" style={{ color: 'hsl(270, 50%, 55%)', background: 'hsl(270, 50%, 95%)' }}>
          No behavioral health access available within 25 miles
        </div>
      )}

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
