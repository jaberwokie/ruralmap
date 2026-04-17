/**
 * Lazy hook for the Demand & Utilization datasets.
 * Returns inert state until `enabled === true`. Once enabled, fetches once
 * and keeps the cache for the session.
 *
 * StrictMode-safe: uses a module-level promise (in `loadUtilizationDataset`)
 * plus a ref-based in-flight guard so React 18's double-invoked effect cannot
 * deadlock the loading state. The `cancelled` flag only suppresses stale
 * setState — it never prevents the live request from clearing loading.
 */

import { useEffect, useRef, useState } from 'react';
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
  const hasStartedRef = useRef(false);
  const mountedRef = useRef(true);

  // eslint-disable-next-line no-console
  console.log('[Utilization] hook init, enabled =', enabled, 'hasStarted =', hasStartedRef.current);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (state.data) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // eslint-disable-next-line no-console
    console.log('[Utilization] fetch start');
    setState((s) => ({ ...s, loading: true, error: null }));

    loadUtilizationDataset()
      .then((data) => {
        // eslint-disable-next-line no-console
        console.log('[Utilization] fetch resolved — loading -> false, ready -> true', {
          zipDemand: data.zipDemand.length,
          countyGap: data.countyGap.length,
          providerUtil: data.providerUtil.length,
          tribal: data.tribal.length,
          zipRollup: data.zipRollup.length,
        });
        if (!mountedRef.current) return;
        setState({ ready: true, loading: false, error: null, data });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load utilization data';
        // eslint-disable-next-line no-console
        console.error('[Utilization] fetch error — loading -> false', msg);
        // Allow retry on next enable cycle.
        hasStartedRef.current = false;
        if (!mountedRef.current) return;
        setState({ ready: false, loading: false, error: msg, data: null });
      });
  }, [enabled, state.data]);

  return state;
};
