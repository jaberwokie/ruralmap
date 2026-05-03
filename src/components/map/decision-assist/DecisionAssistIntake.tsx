/**
 * Structured intake — domain chips → need chips. No freeform text input.
 */

import { ChevronLeft } from 'lucide-react';
import type { Domain, Need } from './decisionAssistTypes';
import { DOMAIN_LABELS, NEEDS_BY_DOMAIN } from './decisionAssistTaxonomy';

interface Props {
  selectedDomain: Domain | null;
  selectedNeed: Need | null;
  onDomainChange: (d: Domain | null) => void;
  onNeedChange: (n: Need | null) => void;
}

const DOMAINS: Domain[] = ['physical', 'behavioral', 'social'];

const DecisionAssistIntake = ({ selectedDomain, selectedNeed, onDomainChange, onNeedChange }: Props) => {
  if (!selectedDomain) {
    return (
      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          What is the member seeking?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onDomainChange(d)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-secondary transition-colors"
            >
              {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const needs = NEEDS_BY_DOMAIN[selectedDomain];

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => { onNeedChange(null); onDomainChange(null); }}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          {DOMAIN_LABELS[selectedDomain]}
        </button>
        {selectedNeed && (
          <button
            type="button"
            onClick={() => onNeedChange(null)}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Change need
          </button>
        )}
      </div>
      {!selectedNeed && (
        <div className="flex flex-wrap gap-1.5">
          {needs.map(n => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNeedChange(n.id)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-secondary transition-colors"
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DecisionAssistIntake;
