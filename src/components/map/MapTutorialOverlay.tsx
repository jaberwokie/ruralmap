import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MAP_TUTORIAL_STEPS, type MapTutorialStep } from '@/data/map-tutorial';
import MapTutorialCard from '@/components/map/tutorial/MapTutorialCard';
import { getTutorialAnchorContext, getTutorialFallbackElement, resolveTutorialElements, scrollTutorialElementIntoView } from '@/components/map/tutorial/tutorialDom';
import { FALLBACK_CARD_HEIGHT, getCardLayout, getHighlightRect, getViewportSize, clampHighlightToContainer, type HighlightRect, type TutorialAnchorContext, type ViewportSize } from '@/components/map/tutorial/tutorialLayout';

interface MapTutorialOverlayProps {
  introOpen: boolean;
  walkthroughOpen: boolean;
  stepIndex: number;
  onStart: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

interface CommittedState {
  stepIndex: number;
  step: MapTutorialStep;
  highlightRect: HighlightRect | null;
  fallbackRect: HighlightRect | null;
  anchorContext: TutorialAnchorContext;
}

const MAX_RESOLVE_ATTEMPTS = 14;

const MapTutorialOverlay = ({ introOpen, walkthroughOpen, stepIndex, onStart, onSkip, onNext, onBack }: MapTutorialOverlayProps) => {
  const step = MAP_TUTORIAL_STEPS[stepIndex];
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(FALLBACK_CARD_HEIGHT);

  const [committed, setCommitted] = useState<CommittedState | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Track which stepIndex has been dispatched so we don't re-dispatch
  const dispatchedStepRef = useRef<number>(-1);
  // Separate cancel ref that is NOT cleared by the effect cleanup
  const pipelineCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => { setMounted(true); setViewport(getViewportSize()); }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setViewport(getViewportSize());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mounted]);

  // ── Measure geometry for a step, optionally clamping to sidebar ──
  const measureGeometry = useCallback((targetStep: MapTutorialStep, allowFallback: boolean) => {
    const elements = resolveTutorialElements(targetStep.selectors);
    const primary = elements[0] ?? (allowFallback ? getTutorialFallbackElement(targetStep.selectors) : null);
    const ctx = getTutorialAnchorContext(primary, targetStep.selectors);
    if (!primary) return { ok: false as const, ctx };

    let hr = elements.length > 0 ? getHighlightRect(elements) : null;
    let fr = elements.length === 0 ? getHighlightRect([primary]) : null;

    // Clamp sidebar highlights to the sidebar container
    if (ctx === 'sidebar') {
      const sidebar = document.querySelector('[data-tutorial="sidebar"]') as HTMLElement | null;
      if (sidebar) {
        const sidebarRect = sidebar.getBoundingClientRect();
        if (hr) hr = clampHighlightToContainer(hr, sidebarRect);
        if (fr) fr = clampHighlightToContainer(fr, sidebarRect);
      }
    }

    if (!hr && !fr) return { ok: false as const, ctx };
    return { ok: true as const, ctx, hr, fr, primary };
  }, []);

  // ── Resolution pipeline — runs once per step change ──
  const resolveStep = useCallback((targetStep: MapTutorialStep, targetIndex: number) => {
    // Cancel previous pipeline
    pipelineCancelRef.current?.();

    let cancelled = false;
    let timer = 0;
    let raf = 0;
    let attempts = 0;

    pipelineCancelRef.current = () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };

    const schedule = (cb: () => void, delay = 0) => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (delay > 0) {
        timer = window.setTimeout(() => { raf = requestAnimationFrame(cb); }, delay);
      } else {
        raf = requestAnimationFrame(cb);
      }
    };

    const commit = (hr: HighlightRect | null, fr: HighlightRect | null, ctx: TutorialAnchorContext) => {
      if (cancelled) return;
      // 1. Hide card content (it was already hidden or showing old step)
      setContentVisible(false);
      // 2. Commit new geometry — highlight transitions via CSS
      setCommitted({ stepIndex: targetIndex, step: targetStep, highlightRect: hr, fallbackRect: fr, anchorContext: ctx });
      // 3. After highlight CSS transition settles, re-measure and reveal
      schedule(() => {
        if (cancelled) return;
        const final = measureGeometry(targetStep, true);
        if (final.ok) {
          setCommitted(prev => prev ? { ...prev, highlightRect: final.hr ?? null, fallbackRect: final.fr ?? null, anchorContext: final.ctx } : prev);
        }
        // Reveal card content
        schedule(() => {
          if (cancelled) return;
          setContentVisible(true);
          setTransitioning(false);
        }, 50);
      }, 240);
    };

    const tryResolve = () => {
      if (cancelled) return;
      const result = measureGeometry(targetStep, false);

      if (!result.ok) {
        if (attempts < MAX_RESOLVE_ATTEMPTS) {
          attempts++;
          schedule(tryResolve, attempts < 4 ? 40 : 80);
          return;
        }
        const fb = measureGeometry(targetStep, true);
        commit(fb.ok ? fb.hr ?? null : null, fb.ok ? fb.fr ?? null : null, fb.ctx);
        return;
      }

      const didScroll = scrollTutorialElementIntoView(result.primary!);

      if (didScroll) {
        schedule(() => {
          if (cancelled) return;
          const post = measureGeometry(targetStep, true);
          commit(post.ok ? post.hr ?? null : null, post.ok ? post.fr ?? null : null, post.ctx);
        }, 380);
      } else {
        commit(result.hr ?? null, result.fr ?? null, result.ctx);
      }
    };

    setTransitioning(true);
    setContentVisible(false);
    tryResolve();
  }, [measureGeometry]);

  // ── Trigger resolution on step change ──
  // Key fix: do NOT include `committed` in deps. Use a ref to track dispatched step.
  useEffect(() => {
    if (!mounted || !walkthroughOpen || !step) return;

    if (dispatchedStepRef.current !== stepIndex) {
      dispatchedStepRef.current = stepIndex;
      resolveStep(step, stepIndex);
    }
  }, [mounted, walkthroughOpen, step, stepIndex, resolveStep]);

  // Reset dispatch tracking when tutorial closes
  useEffect(() => {
    if (!walkthroughOpen) {
      dispatchedStepRef.current = -1;
      pipelineCancelRef.current?.();
      setCommitted(null);
      setContentVisible(false);
      setTransitioning(false);
    }
  }, [walkthroughOpen]);

  // Live position refresh (resize/scroll)
  useEffect(() => {
    if (!mounted || !walkthroughOpen || !committed) return;

    const refresh = () => {
      if (transitioning) return;
      const result = measureGeometry(committed.step, true);
      if (result.ok) {
        setCommitted(prev => prev ? { ...prev, highlightRect: result.hr ?? null, fallbackRect: result.fr ?? null } : prev);
      }
    };

    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [mounted, walkthroughOpen, committed, transitioning, measureGeometry]);

  // Keyboard
  useEffect(() => {
    if (!introOpen && !walkthroughOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onSkip(); return; }
      if (!walkthroughOpen || transitioning) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') onNext();
      if (event.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [introOpen, walkthroughOpen, transitioning, onBack, onNext, onSkip]);

  // Card height measurement
  useLayoutEffect(() => {
    if (!mounted || !cardRef.current || (!introOpen && !walkthroughOpen)) return;
    const el = cardRef.current;
    const update = () => setCardHeight(el.getBoundingClientRect().height || FALLBACK_CARD_HEIGHT);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [introOpen, mounted, committed?.stepIndex, walkthroughOpen]);

  const focusRect = committed ? (committed.highlightRect ?? committed.fallbackRect) : null;

  const cardLayout = useMemo(() => {
    if (!mounted || viewport.width === 0 || viewport.height === 0 || !committed) return null;
    return getCardLayout(viewport, committed.highlightRect, cardHeight, committed.anchorContext, committed.fallbackRect);
  }, [committed, cardHeight, mounted, viewport]);

  if (!mounted || (!introOpen && (!walkthroughOpen || !step))) return null;

  // Intro screen
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
              <button type="button" onClick={onStart} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]">
                Start Walkthrough
              </button>
              <button type="button" onClick={onSkip} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:scale-[0.98]">
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Walkthrough
  const displayStep = committed?.step ?? step;
  const displayStepIndex = committed?.stepIndex ?? stepIndex;

  if (!cardLayout || !displayStep) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2200] pointer-events-none">
      {focusRect ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-foreground/16 transition-all duration-[260ms] ease-out" style={{ height: focusRect.top }} />
          <div className="absolute bottom-0 left-0 bg-foreground/16 transition-all duration-[260ms] ease-out" style={{ top: focusRect.top, width: focusRect.left, height: focusRect.height }} />
          <div className="absolute bg-foreground/16 transition-all duration-[260ms] ease-out" style={{ top: focusRect.top, left: focusRect.left + focusRect.width, right: 0, height: focusRect.height }} />
          <div className="absolute inset-x-0 bottom-0 bg-foreground/16 transition-all duration-[260ms] ease-out" style={{ top: focusRect.top + focusRect.height }} />
          <div
            className="absolute rounded-lg border-2 border-primary/70 bg-transparent transition-all duration-[260ms] ease-out"
            style={{
              top: focusRect.top, left: focusRect.left, width: focusRect.width, height: focusRect.height,
              boxShadow: '0 0 0 1px hsl(var(--background) / 0.28), inset 0 0 0 1px hsl(var(--primary) / 0.10)',
            }}
          />
          <div
            className="absolute pointer-events-none transition-all duration-[260ms] ease-out"
            style={{ top: focusRect.top - 10, left: focusRect.left + 8, opacity: contentVisible ? 1 : 0 }}
          >
            <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-sm">
              {displayStep.targetLabel}
            </span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-foreground/16" />
      )}

      <div
        className="transition-opacity duration-150 ease-out"
        style={{ opacity: contentVisible ? 1 : 0, pointerEvents: contentVisible ? 'auto' : 'none' }}
      >
        <MapTutorialCard
          ref={cardRef}
          layout={cardLayout}
          highlightRect={committed?.highlightRect ?? null}
          step={displayStep}
          stepIndex={displayStepIndex}
          onBack={transitioning ? () => {} : onBack}
          onNext={transitioning ? () => {} : onNext}
          onClose={onSkip}
        />
      </div>
    </div>,
    document.body,
  );
};

export default MapTutorialOverlay;
