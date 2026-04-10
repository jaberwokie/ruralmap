import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { MAP_TUTORIAL_STEPS, type MapTutorialStep } from '@/data/map-tutorial';
import { type CardLayout, type HighlightRect, getArrowStyle } from '@/components/map/tutorial/tutorialLayout';

interface MapTutorialCardProps {
  layout: CardLayout;
  highlightRect: HighlightRect | null;
  step: MapTutorialStep;
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const MapTutorialCard = forwardRef<HTMLDivElement, MapTutorialCardProps>(({ layout, highlightRect, step, stepIndex, onBack, onNext, onClose }, ref) => {
  const arrowStyle = getArrowStyle(layout, highlightRect);

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border-2 border-primary bg-card/95 text-card-foreground shadow-lg transition-[top,left,width,max-height] duration-200 ease-out"
      style={{
        top: layout.top,
        left: layout.left,
        width: layout.width,
        maxHeight: layout.maxHeight,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-tutorial-title"
      aria-describedby="map-tutorial-description"
    >
      {arrowStyle ? (
        <span
          aria-hidden="true"
          className="absolute h-3 w-3 rotate-45 border-2 border-primary bg-card/95"
          style={arrowStyle}
        />
      ) : null}

      <div className="relative shrink-0 border-b border-border/80 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Step {stepIndex + 1} of {MAP_TUTORIAL_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <h3 id="map-tutorial-title" className="mt-1.5 text-[15px] font-semibold leading-snug text-balance">
          {step.title}
        </h3>
      </div>

      <div className="min-h-0 overflow-y-auto px-4 py-2.5">
        <p id="map-tutorial-description" className="text-[13px] leading-5 text-muted-foreground whitespace-normal break-words">
          {step.text}
        </p>
        {step.footer ? (
          <p className="mt-2 border-t border-border/80 pt-2 text-[11px] leading-4 text-muted-foreground whitespace-normal break-words">
            {step.footer}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border/80 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIndex === 0}
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            {stepIndex === MAP_TUTORIAL_STEPS.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
});

MapTutorialCard.displayName = 'MapTutorialCard';

export default MapTutorialCard;