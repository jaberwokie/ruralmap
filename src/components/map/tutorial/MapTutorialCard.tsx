import { MAP_TUTORIAL_STEPS, type MapTutorialStep } from '@/data/map-tutorial';
import { type CardLayout, type HighlightRect, getArrowStyle } from '@/components/map/tutorial/tutorialLayout';

interface MapTutorialCardProps {
  cardRef: React.RefObject<HTMLDivElement>;
  layout: CardLayout;
  highlightRect: HighlightRect | null;
  step: MapTutorialStep;
  stepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}

const MapTutorialCard = ({ cardRef, layout, highlightRect, step, stepIndex, onBack, onNext, onClose }: MapTutorialCardProps) => {
  const arrowStyle = getArrowStyle(layout, highlightRect);

  return (
    <div
      ref={cardRef}
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-[top,left,width,max-height] duration-200 ease-out"
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
          className="absolute h-3 w-3 rotate-45 border border-border bg-card"
          style={arrowStyle}
        />
      ) : null}

      <div className="relative shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Step {stepIndex + 1} of {MAP_TUTORIAL_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98]"
          >
            Close
          </button>
        </div>
        <h3 id="map-tutorial-title" className="mt-2 text-base font-semibold leading-snug text-balance">
          {step.title}
        </h3>
      </div>

      <div className="min-h-0 overflow-y-auto px-4 py-3">
        <p id="map-tutorial-description" className="text-sm leading-relaxed text-muted-foreground whitespace-normal break-words">
          {step.text}
        </p>
        {step.footer ? (
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground whitespace-normal break-words">
            {step.footer}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIndex === 0}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            {stepIndex === MAP_TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapTutorialCard;