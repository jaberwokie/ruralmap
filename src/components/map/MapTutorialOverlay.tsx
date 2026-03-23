import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAP_TUTORIAL_STEPS } from '@/data/map-tutorial';
import MapTutorialCard from '@/components/map/tutorial/MapTutorialCard';
import { getTutorialAnchorContext, getTutorialFallbackElement, resolveTutorialElements, scrollTutorialElementIntoView } from '@/components/map/tutorial/tutorialDom';
import { FALLBACK_CARD_HEIGHT, getCardLayout, getHighlightRect, getViewportSize, type HighlightRect, type TutorialAnchorContext, type ViewportSize } from '@/components/map/tutorial/tutorialLayout';

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
  const [fallbackRect, setFallbackRect] = useState<HighlightRect | null>(null);
  const [anchorContext, setAnchorContext] = useState<TutorialAnchorContext>('generic');
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
    let cancelled = false;
    let attempts = 0;

    const MAX_RESOLUTION_ATTEMPTS = 12;

    const schedule = (callback: () => void, delay = 0) => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);

      if (delay > 0) {
        timeout = window.setTimeout(() => {
          frame = window.requestAnimationFrame(callback);
        }, delay);
        return;
      }

      frame = window.requestAnimationFrame(callback);
    };

    const updateStepGeometry = (allowFallback: boolean) => {
      const elements = resolveTutorialElements(step.selectors);
      const primaryElement = elements[0] ?? (allowFallback ? getTutorialFallbackElement(step.selectors) : null);

      setAnchorContext(getTutorialAnchorContext(primaryElement, step.selectors));

      if (!primaryElement) {
        setHighlightRect(null);
        setFallbackRect(null);
        return false;
      }

      const nextHighlightRect = elements.length > 0 ? getHighlightRect(elements) : null;
      const nextFallbackRect = elements.length === 0 ? getHighlightRect([primaryElement]) : null;

      setHighlightRect(nextHighlightRect);
      setFallbackRect(nextFallbackRect);

      return Boolean(nextHighlightRect || nextFallbackRect);
    };

    const refreshPosition = () => {
      if (cancelled) return;
      updateStepGeometry(true);
    };

    const resolveAnchor = () => {
      if (cancelled) return;

      const elements = resolveTutorialElements(step.selectors);
      const primaryElement = elements[0] ?? null;

      if (!primaryElement) {
        if (attempts < MAX_RESOLUTION_ATTEMPTS) {
          attempts += 1;
          schedule(resolveAnchor, attempts < 4 ? 40 : 80);
          return;
        }

        const hasFallbackAnchor = updateStepGeometry(true);
        console.warn('[MapTutorialOverlay] Missing tutorial anchor selector', {
          stepKey: step.key,
          selectors: step.selectors,
          fallbackUsed: hasFallbackAnchor,
        });
        setStepReady(true);
        return;
      }

      const didScroll = scrollTutorialElementIntoView(primaryElement);
      schedule(() => {
        if (cancelled) return;

        const hasResolvedAnchor = updateStepGeometry(false);

        if (!hasResolvedAnchor && attempts < MAX_RESOLUTION_ATTEMPTS) {
          attempts += 1;
          schedule(resolveAnchor, 60);
          return;
        }

        if (!hasResolvedAnchor) {
          const hasFallbackAnchor = updateStepGeometry(true);
          console.warn('[MapTutorialOverlay] Falling back after unresolved tutorial anchor', {
            stepKey: step.key,
            selectors: step.selectors,
            fallbackUsed: hasFallbackAnchor,
          });
        }

        setStepReady(true);
      }, didScroll ? 110 : 0);
    };

    setStepReady(false);
    setHighlightRect(null);
    setFallbackRect(null);
    resolveAnchor();

    window.addEventListener('resize', refreshPosition);
    window.addEventListener('scroll', refreshPosition, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', refreshPosition);
      window.removeEventListener('scroll', refreshPosition, true);
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
    return getCardLayout(viewport, highlightRect, cardHeight, anchorContext, fallbackRect);
  }, [anchorContext, cardHeight, fallbackRect, highlightRect, mounted, viewport]);

  const focusRect = highlightRect ?? fallbackRect;

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
    <div className="fixed inset-0 z-[2200] pointer-events-none">
      {focusRect ? (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-foreground/16 transition-[height] duration-200 ease-out"
            style={{ height: focusRect.top }}
          />
          <div
            className="absolute bottom-0 left-0 bg-foreground/16 transition-[top,width,height] duration-200 ease-out"
            style={{
              top: focusRect.top,
              width: focusRect.left,
              height: focusRect.height,
            }}
          />
          <div
            className="absolute bg-foreground/16 transition-[top,left,width,height] duration-200 ease-out"
            style={{
              top: focusRect.top,
              left: focusRect.left + focusRect.width,
              right: 0,
              height: focusRect.height,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-foreground/16 transition-[top] duration-200 ease-out"
            style={{ top: focusRect.top + focusRect.height }}
          />
          <div
            className="absolute rounded-2xl border border-border/90 bg-background/5 shadow-sm transition-[top,left,width,height] duration-200 ease-out"
            style={{
              top: focusRect.top,
              left: focusRect.left,
              width: focusRect.width,
              height: focusRect.height,
              boxShadow: '0 0 0 1px hsl(var(--background) / 0.28)',
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-foreground/16" />
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