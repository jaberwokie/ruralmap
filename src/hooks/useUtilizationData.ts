/**
 * Lazy hook for the Demand & Utilization datasets.
 * Returns inert state until `enabled === true`. Once enabled, fetches once
 * and keeps the cache for the session.
 */

import { useEffect, useState } from 'react';
import { loadUtilizationDataset, type UtilizationDataset } from '@/data/utilization';

export interface UseUtilizationDataResult {
  /** True after initial fetch resolves. */
  ready: boolean;
  /** True while the initial fetch is in flight. */
  loading: boolean;
  error: string | null;
  data: UtilizationDataset | null;
}

const INERT: UseUtilizationDataResult = {
  ready: false,
  loading: false,
  error: null,
  data: null,
};

export const useUtilizationData = (enabled: boolean): UseUtilizationDataResult => {
  const [state, setState] = useState<UseUtilizationDataResult>(INERT);

  useEffect(() => {
    if (!enabled) return;
    if (state.data || state.loading) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadUtilizationDataset()
      .then((data) => {
        if (cancelled) return;
        setState({ ready: true, loading: false, error: null, data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load utilization data';
        setState({ ready: false, loading: false, error: msg, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, state.data, state.loading]);

  return state;
};
