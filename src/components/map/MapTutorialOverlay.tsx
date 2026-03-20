import { useEffect, useMemo, useState } from 'react';
import { MAP_TUTORIAL_STEPS } from '@/data/map-tutorial';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MapTutorialOverlayProps {
  introOpen: boolean;
  walkthroughOpen: boolean;
  stepIndex: number;
  onStart: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

const PADDING = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getHighlightRect = (selectors: string[]): HighlightRect | null => {
  const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)) as HTMLElement[]);
  const visibleRects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (visibleRects.length === 0) return null;

  const bounds = visibleRects.reduce(
    (acc, rect) => ({
      top: Math.min(acc.top, rect.top),
      left: Math.min(acc.left, rect.left),
      right: Math.max(acc.right, rect.right),
      bottom: Math.max(acc.bottom, rect.bottom),
    }),
    {
      top: visibleRects[0].top,
      left: visibleRects[0].left,
      right: visibleRects[0].right,
      bottom: visibleRects[0].bottom,
    },
  );

  return {
    top: clamp(bounds.top - PADDING, 8, window.innerHeight - 24),
    left: clamp(bounds.left - PADDING, 8, window.innerWidth - 24),
    width: clamp(bounds.right - bounds.left + PADDING * 2, 120, window.innerWidth - 16),
    height: clamp(bounds.bottom - bounds.top + PADDING * 2, 64, window.innerHeight - 16),
  };
};

const MapTutorialOverlay = ({ introOpen, walkthroughOpen, stepIndex, onStart, onSkip, onNext, onBack }: MapTutorialOverlayProps) => {
  const step = MAP_TUTORIAL_STEPS[stepIndex];
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    if (!walkthroughOpen || !step) return;

    let frame = 0;
    const updateRect = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setHighlightRect(getHighlightRect(step.selectors));
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step, walkthroughOpen]);

  useEffect(() => {
    if (!introOpen && !walkthroughOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
      if (!walkthroughOpen) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') onNext();
      if (event.key === 'ArrowLeft') onBack();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [introOpen, onBack, onNext, onSkip, walkthroughOpen]);

  const cardStyle = useMemo(() => {
    const cardWidth = Math.min(320, window.innerWidth - 32);

    if (!highlightRect) {
      return {
        width: cardWidth,
        top: Math.max(16, window.innerHeight - 220),
        left: 16,
      };
    }

    const preferredTop = highlightRect.top > 220
      ? highlightRect.top - 176
      : highlightRect.top + highlightRect.height + 16;

    return {
      width: cardWidth,
      top: clamp(preferredTop, 16, window.innerHeight - 196),
      left: clamp(highlightRect.left + highlightRect.width / 2 - cardWidth / 2, 16, window.innerWidth - cardWidth - 16),
    };
  }, [highlightRect]);

  if (!introOpen && (!walkthroughOpen || !step)) return null;

  if (introOpen) {
    return (
      <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-foreground/45 px-4 backdrop-blur-[1px]">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">First-time walkthrough</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">How to Read This Map</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Understand access, coverage, and gaps across rural Nevada</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
            >
              Start Walkthrough
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:scale-[0.98]"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1400] pointer-events-none">
      <div className="absolute inset-0 bg-transparent" />
      {highlightRect && (
        <div
          className="absolute rounded-2xl border border-primary/45 bg-transparent transition-[top,left,width,height] duration-300 ease-out"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: '0 0 0 9999px hsl(var(--foreground) / 0.42)',
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl transition-[top,left] duration-300 ease-out"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Step {stepIndex + 1} of {MAP_TUTORIAL_STEPS.length}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98]"
          >
            Skip
          </button>
        </div>

        <h3 className="mt-2 text-base font-semibold text-balance">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
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

export default MapTutorialOverlay;