import { useCallback, useState } from 'react';

/**
 * Presentation Mode — passive demo overlay state.
 *
 * Lifecycle constraints (intentional):
 *  - State is React-only (useState). No localStorage, sessionStorage, cookies, or URL writes.
 *  - Page refresh resets the mode to OFF and the phase to 1.
 *  - `?present=1` URL param is a one-shot read on initial mount; it is never written back.
 *  - Closing/reopening the tab starts clean. The mode cannot accidentally linger.
 *
 * Phase is a manual presenter selector (1–4). It is NOT step progression — there is no
 * next/previous, no auto-advance, and the selector does not interact with map state,
 * filters, or selection.
 */
export type PresentationPhase = 1 | 2 | 3 | 4;

const readInitialFromUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('present') === '1';
  } catch {
    return false;
  }
};

export interface PresentationModeState {
  isPresenting: boolean;
  phase: PresentationPhase;
  toggle: () => void;
  setPhase: (phase: PresentationPhase) => void;
}

export const usePresentationMode = (): PresentationModeState => {
  const [isPresenting, setIsPresenting] = useState<boolean>(readInitialFromUrl);
  const [phase, setPhaseState] = useState<PresentationPhase>(1);

  const toggle = useCallback(() => {
    setIsPresenting((prev) => {
      const next = !prev;
      // Always reset phase to 1 when enabling, so each demo starts at orientation.
      if (next) setPhaseState(1);
      return next;
    });
  }, []);

  const setPhase = useCallback((p: PresentationPhase) => {
    setPhaseState(p);
  }, []);

  return { isPresenting, phase, toggle, setPhase };
};
