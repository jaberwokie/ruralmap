import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAP_TUTORIAL_STEPS } from '@/data/map-tutorial';
import MapTutorialCard from '@/components/map/tutorial/MapTutorialCard';
import { getPrimaryTutorialElement, resolveTutorialElements, scrollTutorialElementIntoView } from '@/components/map/tutorial/tutorialDom';
import { FALLBACK_CARD_HEIGHT, getCardLayout, getHighlightRect, getViewportSize, type HighlightRect, type ViewportSize } from '@/components/map/tutorial/tutorialLayout';

interface MapTutorialOverlayProps {
  introOpen: boolean;
  walkthroughOpen: boolean;
  stepIndex: number;
  onStart: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

const MapTutorialOverlay = ({ introOpen, walkthroughOpen, stepIndex, onStart, onSkip, onNext, onBack }: MapTutorialOverlayProps) => {
  const step = MAP_TUTORIAL_STEPS[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [stepReady, setStepReady] = useState(false);
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
    let timeout = 0;

    const updateRect = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const elements = resolveTutorialElements(step.selectors);
        setHighlightRect(getHighlightRect(elements));
        setStepReady(true);
      });
    };

    setStepReady(false);
    const primaryElement = getPrimaryTutorialElement(step.selectors);
    const didScroll = scrollTutorialElementIntoView(primaryElement);

    if (didScroll) {
      timeout = window.setTimeout(updateRect, 80);
    } else {
      updateRect();
    }

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.clearTimeout(timeout);
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

  if (!cardLayout || !step || !stepReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2200] pointer-events-auto">
      <button type="button" aria-label="Close tutorial" className="absolute inset-0 bg-foreground/28" onClick={onSkip} />
      {highlightRect && (
        <div
          className="absolute rounded-2xl border border-primary/45 bg-transparent transition-[top,left,width,height] duration-200 ease-out"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: '0 0 0 9999px hsl(var(--foreground) / 0.18)',
          }}
        />
      )}

      <MapTutorialCard
        ref={cardRef}
        layout={cardLayout}
        highlightRect={highlightRect}
        step={step}
        stepIndex={stepIndex}
        onBack={onBack}
        onNext={onNext}
        onClose={onSkip}
      />
    </div>,
    document.body,
  );
};

export default MapTutorialOverlay;