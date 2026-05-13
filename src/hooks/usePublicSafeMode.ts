/**
 * PUBLIC_SAFE_MODE — non-destructive presentation layer for public screenshots,
 * shareable URLs (LinkedIn, decks, etc.), and external demos.
 *
 * Activated by the `/public` route (and any path under it).
 * Session-only (no persistence). This module is the single source of truth
 * for public-mode detection — other modules must call `isPublicSafeModeActive()`
 * rather than parsing `window.location` themselves.
 *
 * Intent:
 * - Hide member / engagement counts ENTIRELY (no bucketing).
 * - Hide internal performance panels (utilization rankings, top-providers,
 *   engagement scoring, verification queue, mapping, audit, staging).
 * - Hide admin surfaces and dev/build fingerprints.
 * - Soften operational language ("same-day response", "unverified", claims).
 * - Force a visible disclaimer on coverage interpretation.
 *
 * This hook does NOT mutate state, does NOT change business logic, and does
 * NOT persist. Every call re-reads `window.location.pathname`.
 */
import { useMemo } from 'react';

export interface PublicSafeMode {
  /** Is public-safe mode active for this pageview? */
  isPublicSafe: boolean;
  /**
   * Format a count for display. In public mode, returns an empty string so
   * callers that still render the value won't leak numbers — but the
   * preferred pattern is to hide the entire row/section via `isPublicSafe`.
   */
  displayCount: (n: number | null | undefined) => string;
  /**
   * True whenever a count should not be shown at all. In public mode this is
   * always true for any non-zero value so UIs can drop the whole row.
   */
  isSuppressed: (n: number | null | undefined) => boolean;
  /** Soften claims-pipeline terminology for visible UI strings. */
  safeText: (text: string) => string;
}

let _unauthenticatedPublicSafe = true;

/**
 * Called by AuthContext when auth state resolves.
 * When true, forces public-safe mode for unauthenticated users regardless of route.
 */
export const setUnauthenticatedPublicSafe = (value: boolean): void => {
  _unauthenticatedPublicSafe = value;
};

const readFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const path = window.location.pathname || '';
    return path === '/public' || path.startsWith('/public/');
  } catch {
    return false;
  }
};

export const usePublicSafeMode = (): PublicSafeMode => {
  // Re-evaluate on each render; effectively free and lets the flag flip
  // mid-session without a reload if a user appends it.
  const isPublicSafe = _unauthenticatedPublicSafe || readFlag();

  return useMemo<PublicSafeMode>(() => {
    const displayCount = (n: number | null | undefined): string => {
      const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
      // Public mode: hide counts entirely. Callers should prefer to omit the
      // row; this is a last-resort fallback that returns an empty string.
      if (isPublicSafe) return '';
      return value.toLocaleString();
    };

    const isSuppressed = (n: number | null | undefined): boolean => {
      if (!isPublicSafe) return false;
      const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
      // Any non-zero count is suppressed in public mode.
      return value > 0;
    };

    const safeText = (text: string): string => {
      if (!isPublicSafe || !text) return text;
      return text
        .replace(/\bclaims\b/gi, 'service data')
        .replace(/\bencounters\b/gi, 'visits')
        .replace(/\battributed\b/gi, 'associated')
        .replace(/\bpenetration\b/gi, 'reach')
        .replace(/\bunverified\b/gi, 'participation status not confirmed');
    };

    return { isPublicSafe, displayCount, isSuppressed, safeText };
  }, [isPublicSafe]);
};

/**
 * Module-scope reader for non-React contexts (e.g., `App.tsx` root-level
 * components where hooks aren't convenient). Safe to call during render.
 */
export const isPublicSafeModeActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  return _unauthenticatedPublicSafe || readFlag();
};
