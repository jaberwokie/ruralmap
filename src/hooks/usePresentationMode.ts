import { useCallback, useEffect, useState } from 'react';

/**
 * Presentation Mode — passive demo overlay state.
 *
 * Lifecycle constraints (intentional):
 *  - State is React-only (useState). No localStorage, sessionStorage, cookies, or URL writes.
 *  - Page refresh resets the mode to OFF and the phase to 1.
 *  - `?present=1` URL param is a one-shot read on initial mount; it is never written back.
 *  - Closing/reopening the tab starts clean. The mode cannot accidentally linger.
 *
 * Activation:
 *  - No visible UI control. Toggled via Ctrl+Shift+P (global document listener).
 *  - The hotkey is ignored when focus is in an input, textarea, or contenteditable element
 *    so it never interferes with typing in the search field or other forms.
 *
 * Phase is a manual presenter selector (1–4). It is NOT step progression — there is no
 * next/previous, no auto-advance, and the selector does not interact with map state,
 * filters, or selection. Phase is currently only switchable programmatically; in normal
 * use it stays at 1 since there is no UI selector.
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

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
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

  // Global hotkey: Ctrl+Shift+P toggles Presentation Mode.
  // No URL writes, no persistence — refresh still resets to off.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key !== 'P' && e.key !== 'p') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return { isPresenting, phase, toggle, setPhase };
};
