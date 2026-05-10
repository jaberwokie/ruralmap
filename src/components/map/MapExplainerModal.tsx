import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePublicSafeMode } from '@/hooks/usePublicSafeMode';

interface MapExplainerModalProps {
  open: boolean;
  onClose: () => void;
}

type TabKey =
  | 'overview'
  | 'how-to-use'
  | 'layers'
  | 'access'
  | 'verification'
  | 'transit'
  | 'limits';

const ALL_TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'how-to-use', label: 'How to Use' },
  { key: 'layers', label: 'Operational Overlays' },
  { key: 'access', label: 'Access' },
  { key: 'verification', label: 'Verification' },
  { key: 'transit', label: 'Transportation' },
  { key: 'limits', label: 'Limits' },
];

const Bullets = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/60">
    {items.map((item, i) => (
      <li key={i} className="text-[13px] leading-relaxed text-foreground/85">
        {item}
      </li>
    ))}
  </ul>
);

const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-relaxed text-foreground/85">{children}</p>
);

const Term = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium text-foreground">{children}</span>
);

const MapExplainerModal = ({ open, onClose }: MapExplainerModalProps) => {
  const { isPublicSafe } = usePublicSafeMode();
  const backdropRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  // PUBLIC_SAFE_MODE: hide the "Verification" tab — its body exposes
  // internal terminology (Unverified, Fallback, Priority Queue, audit history).
  const TABS = useMemo(
    () => (isPublicSafe ? ALL_TABS.filter((t) => t.key !== 'verification') : ALL_TABS),
    [isPublicSafe],
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab('overview');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Lead>
            This is an operational decision environment for rural Nevada access coordination.
            It brings together provider access infrastructure, behavioral health capacity,
            community services, county and tribal boundaries, transportation feasibility,
            and selected utilization signals to support response capability review, routing
            decisions, and field coordination planning.
          </Lead>
        );
      case 'how-to-use':
        return (
          <Bullets
            items={[
              'Start with core operational overlays to understand what exists in a region',
              'Use filters to narrow by provider type or service need',
              'Enter a member address to evaluate distance and travel friction',
              'Use access and verification signals to prioritize options',
              'Treat this environment as coordination infrastructure, not proof of real-time availability',
            ]}
          />
        );
      case 'layers':
        return (
          <Bullets
            items={[
              <><Term>County Operating Boundaries:</Term> geographic reference for county-level review</>,
              <><Term>Tribal Jurisdiction Context:</Term> tribal land context and tribally operated services</>,
              <><Term>Provider Access Infrastructure:</Term> hospitals and clinics as verified access points</>,
              <><Term>Behavioral Health Capacity Network:</Term> behavioral health access points</>,
              <><Term>Community Service Access Network:</Term> community-based and support services</>,
            ]}
          />
        );
      case 'access':
        return (
          <div className="space-y-3">
            <Lead>
              Distance estimates geographic reach, not guaranteed access. A nearby resource may
              still be unusable due to scheduling, referral limits, transportation barriers, or
              availability.
            </Lead>
            <Bullets
              items={[
                'Shorter distance generally means lower travel friction',
                'Longer distance increases coordination difficulty',
                'A mapped resource is not the same as a usable placement',
                'Access improves when distance, verification, and transportation align',
              ]}
            />
          </div>
        );
      case 'verification':
        if (isPublicSafe) return null;
        return (
          <div className="space-y-3">
            <Lead>
              Verification signals help distinguish stronger routing options from uncertain or
              fallback options.
            </Lead>
            <Bullets
              items={[
                <><Term>Verified:</Term> confirmed and higher confidence</>,
                <><Term>Unverified:</Term> exists but requires confirmation</>,
                <><Term>Fallback:</Term> limited or last-resort option</>,
                'Priority Queue and audit history support follow-up work',
              ]}
            />
          </div>
        );
      case 'transit':
        return (
          <div className="space-y-3">
            <Lead>
              Transportation overlays provide mobility context but do not guarantee trip
              completion.
            </Lead>
            <Bullets
              items={[
                <><Term>Transportation Corridor Context</Term> shows long-distance corridor presence</>,
                <><Term>Local Transportation Feasibility</Term> indicates possible local mobility</>,
                <><Term>Transportation Access Providers</Term> identify operators, not reliability</>,
                'Transportation context supports planning, not guaranteed transportation',
              ]}
            />
          </div>
        );
      case 'limits':
        return (
          <Bullets
            items={[
              'No real-time appointment availability',
              'No guarantee a provider is accepting referrals',
              'No guarantee of transportation continuity',
              'Some areas have limited or no local services',
              'Final decisions require outreach and confirmation',
            ]}
          />
        );
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl flex flex-col overflow-hidden"
        style={{ height: 'min(560px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Operational Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Close explainer"
          >
            <X className="h-4 w-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Operational Guide sections"
          className="flex w-full items-stretch overflow-x-auto border-b border-border bg-card whitespace-nowrap scrollbar-thin"
        >
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={
                  isActive
                    ? { boxShadow: 'inset 0 -2px 0 0 hsl(var(--brand-health))' }
                    : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 text-left">{renderTab()}</div>
      </div>
    </div>
  );
};

export default MapExplainerModal;
