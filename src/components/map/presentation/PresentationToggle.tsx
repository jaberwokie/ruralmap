import { Presentation } from 'lucide-react';
import type { PresentationPhase } from '@/hooks/usePresentationMode';

/**
 * Presentation Mode toggle pill + manual phase selector.
 *
 * Mounted in the map canvas top-right (above the existing zoom/recenter stack).
 * Reads as a temporary viewing mode, not an admin control. Phase chips appear
 * only when the mode is active. The selector is purely passive — switching a
 * phase only changes which static callouts render.
 */
interface Props {
  isPresenting: boolean;
  phase: PresentationPhase;
  onToggle: () => void;
  onPhaseChange: (phase: PresentationPhase) => void;
}

const PHASES: PresentationPhase[] = [1, 2, 3, 4];

const PresentationToggle = ({ isPresenting, phase, onToggle, onPhaseChange }: Props) => {
  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-[820] flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        title={isPresenting ? 'Exit Presentation Mode' : 'Enable Presentation Mode (demo overlay)'}
        className={
          isPresenting
            ? 'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary shadow-sm backdrop-blur-sm transition-colors hover:bg-primary/15'
            : 'inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground'
        }
      >
        <Presentation className="h-3 w-3" />
        {isPresenting ? 'Exit Presentation' : 'Presentation Mode'}
      </button>

      {isPresenting && (
        <div
          role="group"
          aria-label="Presentation phase"
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-sm"
        >
          {PHASES.map((p) => {
            const active = p === phase;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPhaseChange(p)}
                title={`Phase ${p}`}
                className={
                  active
                    ? 'h-5 w-6 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground'
                    : 'h-5 w-6 rounded-full text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground'
                }
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresentationToggle;
