/**
 * PUBLIC_SAFE_MODE — non-destructive presentation layer for public screenshots
 * and shareable URLs (LinkedIn, decks, etc.).
 *
 * Activate by adding `?publicSafe=1` to the URL. Session-only (no persistence).
 *
 * Intent:
 * - Hide small-cell member counts (<11) to avoid re-identification risk.
 * - Hide internal performance panels (utilization rankings, top-providers,
 *   engagement scoring, verification queue).
 * - Hide admin surfaces and dev/build fingerprints.
 * - Soften operational language ("same-day response", "unverified", claims).
 * - Force a visible disclaimer on coverage interpretation.
 *
 * This hook does NOT mutate state, does NOT change business logic, and does
 * NOT persist. Every call re-reads `window.location.search`.
 */
import { useMemo } from 'react';

const SMALL_CELL_THRESHOLD = 11;

export interface PublicSafeMode {
  /** Is public-safe mode active for this pageview? */
  isPublicSafe: boolean;
  /** Format a member/engagement count, suppressing small cells in public mode. */
  displayCount: (n: number | null | undefined) => string;
  /** Returns true if the raw count should be suppressed as small-cell in public mode. */
  isSuppressed: (n: number | null | undefined) => boolean;
  /** Soften claims-pipeline terminology for visible UI strings. */
  safeText: (text: string) => string;
}

const readFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('publicSafe') === '1';
  } catch {
    return false;
  }
};

export const usePublicSafeMode = (): PublicSafeMode => {
  // Re-evaluate on each render; effectively free and lets ?publicSafe=1 flip
  // mid-session without a reload if a user appends it.
  const isPublicSafe = readFlag();

  return useMemo<PublicSafeMode>(() => {
    const displayCount = (n: number | null | undefined): string => {
      const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
      if (!isPublicSafe) return value.toLocaleString();
      if (value > 0 && value < SMALL_CELL_THRESHOLD) return '<11';
      return value.toLocaleString();
    };

    const isSuppressed = (n: number | null | undefined): boolean => {
      if (!isPublicSafe) return false;
      const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
      return value > 0 && value < SMALL_CELL_THRESHOLD;
    };

    const safeText = (text: string): string => {
      if (!isPublicSafe || !text) return text;
      return text
        .replace(/\bclaims\b/gi, 'service data')
        .replace(/\bencounters\b/gi, 'visits')
        .replace(/\battributed\b/gi, 'associated');
    };

    return { isPublicSafe, displayCount, isSuppressed, safeText };
  }, [isPublicSafe]);
};

/**
 * Module-scope reader for non-React contexts (e.g., `App.tsx` root-level
 * components where hooks aren't convenient). Safe to call during render.
 */
export const isPublicSafeModeActive = (): boolean => readFlag();
