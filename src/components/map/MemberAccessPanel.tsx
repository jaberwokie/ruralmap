import { MapPin, Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { MemberAccessAnalysis, AccessTierKey } from '@/hooks/useMemberAccess';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';

const TIER_COLORS: Record<AccessTierKey, string> = {
  local: 'hsl(142, 60%, 40%)',
  managed: 'hsl(38, 85%, 50%)',
  highFriction: 'hsl(0, 65%, 55%)',
  nonViable: 'hsl(0, 0%, 55%)',
};

const TIER_NOTES: Record<AccessTierKey, string | null> = {
  local: null,
  managed: 'Transport/planning dependent',
  highFriction: 'Not reliable for routine engagement',
  nonViable: null,
};

const RECOMMENDATION_STYLE: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  'Local in-person engagement viable': { icon: CheckCircle2, color: 'hsl(142, 60%, 40%)' },
  'Coordinated access required (transport needed)': { icon: Navigation, color: 'hsl(38, 85%, 50%)' },
  'Remote engagement recommended': { icon: AlertTriangle, color: 'hsl(0, 65%, 55%)' },
};

const ResourceName = ({ name, distanceMi }: { name: string; distanceMi: number }) => (
  <div className="flex items-center justify-between gap-1 text-[10px]">
    <span className="text-foreground truncate">{name}</span>
    <span className="text-muted-foreground flex-shrink-0">{distanceMi.toFixed(1)} mi</span>
  </div>
);

interface TierSectionProps {
  label: string;
  rangeLabel: string;
  tierKey: AccessTierKey;
  facilities: (Facility & { distanceMi: number })[];
  services: (RuralService & { distanceMi: number })[];
}

const TierSection = ({ label, rangeLabel, tierKey, facilities, services }: TierSectionProps) => {
  const total = facilities.length + services.length;
  const color = TIER_COLORS[tierKey];
  const note = TIER_NOTES[tierKey];

  // Non-viable: count only
  if (tierKey === 'nonViable') {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-medium text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">({rangeLabel})</span>
        </div>
        <p className="text-[10px] text-muted-foreground ml-3.5 mt-0.5">
          {total} resource{total !== 1 ? 's' : ''} beyond viable range
        </p>
      </div>
    );
  }

  // Top 3 combined, sorted by distance
  const combined = [
    ...facilities.map(f => ({ name: f.name, distanceMi: f.distanceMi })),
    ...services.map(s => ({ name: s.name, distanceMi: s.distanceMi })),
  ].sort((a, b) => a.distanceMi - b.distanceMi);

  const showItems = tierKey === 'highFriction' ? combined.slice(0, 2) : combined.slice(0, 3);

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">({rangeLabel})</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{total}</span>
      </div>
      {note && <p className="text-[9px] text-muted-foreground/70 italic ml-3.5 mt-0.5">{note}</p>}
      {showItems.length > 0 && (
        <div className="ml-3.5 mt-1 space-y-0.5">
          {showItems.map((item, i) => (
            <ResourceName key={i} name={item.name} distanceMi={item.distanceMi} />
          ))}
          {combined.length > showItems.length && (
            <p className="text-[9px] text-muted-foreground/60">+{combined.length - showItems.length} more</p>
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
  const recStyle = RECOMMENDATION_STYLE[analysis.recommendation] ?? { icon: AlertTriangle, color: 'hsl(0, 0%, 55%)' };
  const RecIcon = recStyle.icon;

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

      {/* Recommendation */}
      <div className="mt-2 pt-2 border-t border-border rounded-md px-2 py-1.5" style={{ background: `${recStyle.color}10` }}>
        <div className="flex items-start gap-1.5">
          <RecIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: recStyle.color }} />
          <p className="text-[11px] font-medium" style={{ color: recStyle.color }}>{analysis.recommendation}</p>
        </div>
      </div>
    </>
  );
};

export default MemberAccessPanel;
