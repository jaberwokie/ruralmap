/**
 * Decision Assist — guided intake drawer.
 *
 * Desktop/laptop only (≥768px). Returns null on mobile so the subtree is
 * absent from the DOM. Hidden until a member pin/address is set. Hidden
 * during Presentation Mode. Additive only — no map mutations beyond calling
 * the passed onFacilitySelect handler.
 *
 * Mount: sibling of CoverageDetailPanel inside the map column in Index.tsx.
 * Position: absolute bottom-0 left-0 right-14 z-[640].
 * Rollback: delete this folder and remove the single mount line in Index.tsx.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, X, Stethoscope } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import type { Domain, Need } from './decisionAssistTypes';
import { DOMAIN_LABELS, findNeed } from './decisionAssistTaxonomy';
import { deriveDecisionAssist } from './deriveDecisionAssist';
import DecisionAssistIntake from './DecisionAssistIntake';
import DecisionAssistResultView from './DecisionAssistResult';

interface Props {
  memberLocation: { lat: number; lng: number } | null;
  facilities: Facility[];
  services: RuralService[];
  onFacilitySelect: (f: Facility) => void;
  isPresenting: boolean;
}

const DecisionAssistDrawer = ({
  memberLocation,
  facilities,
  services,
  onFacilitySelect,
  isPresenting,
}: Props) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);

  // Reset all selections when the member context goes away.
  useEffect(() => {
    if (!memberLocation) {
      setIsOpen(false);
      setSelectedDomain(null);
      setSelectedNeed(null);
    }
  }, [memberLocation]);

  const result = useMemo(() => {
    if (!memberLocation || !selectedDomain || !selectedNeed) return null;
    return deriveDecisionAssist(
      { member: memberLocation, facilities, services },
      selectedDomain,
      selectedNeed,
    );
  }, [memberLocation, facilities, services, selectedDomain, selectedNeed]);

  // Desktop-only v1. Mobile/tablet: no DOM at all.
  if (isMobile) return null;
  if (!memberLocation) return null;
  if (isPresenting) return null;

  const summary = selectedNeed
    ? `${selectedDomain ?? ''} · ${selectedNeed.replace(/_/g, ' ')}`
    : 'Tap to start';

  return (
    <div className="absolute bottom-0 left-0 right-14 z-[640] pointer-events-none">
      <div className="pointer-events-auto mx-2 mb-2 rounded-md border border-border bg-card shadow-lg overflow-hidden">
        {/* Header / collapsed tab */}
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-secondary/60 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold text-foreground leading-tight">Decision Assist</p>
              <p className="text-[10px] text-muted-foreground truncate capitalize">{summary}</p>
            </div>
          </div>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {isOpen && (
          <div className="border-t border-border max-h-[45vh] overflow-y-auto">
            <div className="flex items-center justify-between px-3 pt-2">
              <p className="text-[10px] text-muted-foreground">Structured intake — no freeform input</p>
              <button
                type="button"
                onClick={() => { setSelectedDomain(null); setSelectedNeed(null); }}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Reset
              </button>
            </div>
            <DecisionAssistIntake
              selectedDomain={selectedDomain}
              selectedNeed={selectedNeed}
              onDomainChange={setSelectedDomain}
              onNeedChange={setSelectedNeed}
            />
            {result && selectedDomain && selectedNeed && (
              <DecisionAssistResultView
                result={result}
                domainLabel={DOMAIN_LABELS[selectedDomain]}
                needLabel={findNeed(selectedNeed)?.label ?? selectedNeed}
                onFacilitySelect={onFacilitySelect}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionAssistDrawer;
