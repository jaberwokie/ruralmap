/**
 * Renders pathway, order of operations, confidence, constraint, next action,
 * and clickable primary targets. Click-through routes through the existing
 * onFacilitySelect handler — no new selection logic.
 */

import { ArrowRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Facility } from '@/data/facilities';
import type { DecisionAssistResult } from './decisionAssistTypes';

interface Props {
  result: DecisionAssistResult;
  onFacilitySelect: (f: Facility) => void;
}

const CONFIDENCE_STYLE = {
  high:   { color: 'hsl(142, 60%, 35%)', bg: 'hsl(142, 60%, 96%)', label: 'High confidence', Icon: CheckCircle2 },
  medium: { color: 'hsl(38, 85%, 40%)',  bg: 'hsl(38, 85%, 96%)',  label: 'Medium confidence', Icon: Info },
  low:    { color: 'hsl(0, 65%, 45%)',   bg: 'hsl(0, 65%, 97%)',   label: 'Low confidence', Icon: AlertTriangle },
} as const;

const DecisionAssistResultView = ({ result, onFacilitySelect }: Props) => {
  const conf = CONFIDENCE_STYLE[result.confidence];
  const ConfIcon = conf.Icon;

  return (
    <div className="px-3 pb-3 space-y-2">
      {/* Pathway + confidence */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pathway</p>
          <p className="text-[12px] font-semibold text-foreground">{result.pathway}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border"
          style={{ color: conf.color, background: conf.bg, borderColor: conf.color }}
        >
          <ConfIcon className="h-3 w-3" />
          {conf.label}
        </span>
      </div>

      {/* Next staff action */}
      <div className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5">Next staff action</p>
        <p className="text-[11px] font-medium text-foreground leading-snug">{result.nextStaffAction}</p>
      </div>

      {/* Constraint */}
      {result.constraint && (
        <div
          className="rounded-md border px-2 py-1.5 text-[11px] leading-snug"
          style={{ borderColor: 'hsl(38, 85%, 80%)', background: 'hsl(38, 85%, 96%)', color: 'hsl(38, 85%, 30%)' }}
        >
          <span className="font-semibold">Constraint: </span>{result.constraint}
        </div>
      )}

      {/* Order of operations */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Order of operations</p>
        <ol className="space-y-1">
          {result.orderOfOperations.map(s => (
            <li key={s.step} className="flex gap-2 text-[11px] text-foreground leading-snug">
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-secondary text-foreground text-[10px] font-semibold flex items-center justify-center">
                {s.step}
              </span>
              <span>{s.action}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Primary targets */}
      {result.primaryTargets.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Primary targets</p>
          <ul className="space-y-1">
            {result.primaryTargets.map(t => {
              const clickable = t.kind === 'facility' && t.facility;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (clickable && t.facility) onFacilitySelect(t.facility);
                    }}
                    className={`w-full text-left rounded border border-border px-2 py-1 transition-colors ${
                      clickable ? 'hover:bg-secondary cursor-pointer' : 'cursor-default opacity-90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-foreground truncate">{t.name}</span>
                      {clickable && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {t.distanceMi !== null ? `${t.distanceMi} mi · ${t.tier}` : t.kind === 'mobility_manager' ? 'County coordinator' : 'Hotline'}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DecisionAssistResultView;
