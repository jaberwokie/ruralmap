import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAP_TUTORIAL_STEPS } from '@/data/map-tutorial';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface CardLayout {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom-center' | 'above-highlight' | 'below-highlight' | 'centered-modal';
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

const HIGHLIGHT_PADDING = 12;
const VIEWPORT_PADDING = 20;
const CARD_MAX_WIDTH = 460;
const CARD_MIN_WIDTH = 280;
const CARD_MAX_HEIGHT = 420;
const GAP = 16;
const FALLBACK_CARD_HEIGHT = 300;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

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
    top: clamp(bounds.top - HIGHLIGHT_PADDING, 8, window.innerHeight - 24),
    left: clamp(bounds.left - HIGHLIGHT_PADDING, 8, window.innerWidth - 24),
    width: clamp(bounds.right - bounds.left + HIGHLIGHT_PADDING * 2, 120, window.innerWidth - 16),
    height: clamp(bounds.bottom - bounds.top + HIGHLIGHT_PADDING * 2, 64, window.innerHeight - 16),
  };
};

const getCardLayout = (
  viewport: ViewportSize,
  highlightRect: HighlightRect | null,
  measuredHeight: number,
): CardLayout => {
  const availableWidth = Math.max(CARD_MIN_WIDTH, viewport.width - VIEWPORT_PADDING * 2);
  const width = Math.min(CARD_MAX_WIDTH, availableWidth);
  const maxHeight = Math.min(CARD_MAX_HEIGHT, viewport.height - VIEWPORT_PADDING * 2);
  const cardHeight = Math.min(Math.max(measuredHeight, FALLBACK_CARD_HEIGHT), maxHeight);
  const centeredLeft = clamp((viewport.width - width) / 2, VIEWPORT_PADDING, viewport.width - width - VIEWPORT_PADDING);
  const centeredTop = clamp((viewport.height - cardHeight) / 2, VIEWPORT_PADDING, viewport.height - cardHeight - VIEWPORT_PADDING);
  const isCompactViewport = viewport.width < 900 || viewport.height < 720;

  if (isCompactViewport) {
    return {
      top: centeredTop,
      left: centeredLeft,
      width,
      maxHeight,
      placement: 'centered-modal',
    };
  }

  const defaultTop = clamp(viewport.height - cardHeight - VIEWPORT_PADDING, VIEWPORT_PADDING, viewport.height - cardHeight - VIEWPORT_PADDING);

  if (!highlightRect) {
    return {
      top: defaultTop,
      left: centeredLeft,
      width,
      maxHeight,
      placement: 'bottom-center',
    };
  }

  const aboveTop = highlightRect.top - cardHeight - GAP;
  const belowTop = highlightRect.top + highlightRect.height + GAP;
  const canPlaceAbove = aboveTop >= VIEWPORT_PADDING;
  const canPlaceBelow = belowTop + cardHeight <= viewport.height - VIEWPORT_PADDING;
  const alignedLeft = clamp(
    highlightRect.left + highlightRect.width / 2 - width / 2,
    VIEWPORT_PADDING,
    viewport.width - width - VIEWPORT_PADDING,
  );

  if (canPlaceBelow) {
    return {
      top: belowTop,
      left: alignedLeft,
      width,
      maxHeight,
      placement: 'below-highlight',
    };
  }

  if (canPlaceAbove) {
    return {
      top: aboveTop,
      left: alignedLeft,
      width,
      maxHeight,
      placement: 'above-highlight',
    };
  }

  return {
    top: defaultTop,
    left: centeredLeft,
    width,
    maxHeight,
    placement: 'bottom-center',
  };
};

const MapTutorialOverlay = ({ introOpen, walkthroughOpen, stepIndex, onStart, onSkip, onNext, onBack }: MapTutorialOverlayProps) => {
  const step = MAP_TUTORIAL_STEPS[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(FALLBACK_CARD_HEIGHT);

  useEffect(() => {
    setMounted(true);
    setViewport(getViewportSize());
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updateViewport = () => setViewport(getViewportSize());

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !walkthroughOpen || !step) return;

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
  }, [mounted, step, walkthroughOpen]);

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

  useLayoutEffect(() => {
    if (!mounted || !cardRef.current || (!introOpen && !walkthroughOpen)) return;

    const element = cardRef.current;
    const updateHeight = () => setCardHeight(element.getBoundingClientRect().height || FALLBACK_CARD_HEIGHT);

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [introOpen, mounted, stepIndex, walkthroughOpen]);

  const cardLayout = useMemo(() => {
    if (!mounted || viewport.width === 0 || viewport.height === 0) return null;
    return getCardLayout(viewport, highlightRect, cardHeight);
  }, [cardHeight, highlightRect, mounted, viewport]);

  if (!mounted || (!introOpen && (!walkthroughOpen || !step))) return null;

  if (introOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-foreground/45 px-4 backdrop-blur-[1px]">
        <div
          ref={cardRef}
          className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
          style={{ maxHeight: 'calc(100vh - 32px)' }}
        >
          <div className="shrink-0 border-b border-border px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">First-time walkthrough</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">How to Read This Map</h2>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">Understand access, coverage, and gaps across rural Nevada</p>
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            <div className="flex flex-wrap gap-3">
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
      </div>,
      document.body,
    );
  }

  if (!cardLayout || !step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2200] pointer-events-none">
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
        ref={cardRef}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-[top,left,width,max-height] duration-300 ease-out"
        style={{
          top: cardLayout.top,
          left: cardLayout.left,
          width: cardLayout.width,
          maxHeight: cardLayout.maxHeight,
        }}
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
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
        </div>

        <div className="min-h-0 overflow-y-auto px-4 py-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          {step.footer && (
            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              {step.footer}
            </p>
          )}
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
    </div>,
    document.body,
  );
};

export default MapTutorialOverlay;