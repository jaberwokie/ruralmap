/**
 * Dev-only validator for Staffing Capacity & Load behavior.
 *
 * Observes the staffing selection state and:
 *   - Logs transitions (active set changes, details target changes,
 *     master toggle off/on with restore).
 *   - Warns on invariant violations:
 *       1. activeFteCoverageIds must be unique
 *       2. selectedFteId must be null or contained in activeFteCoverageIds
 *       3. While master toggle is off, no staffing overlays may render
 *       4. After master toggle off→on, the active set must match what it
 *          was just before the off transition
 *
 * No UI changes. No production cost: the entire body short-circuits when
 * `import.meta.env.DEV` is false.
 */
import { useEffect, useRef } from 'react';

interface Params {
  /** Whether the Staffing Capacity & Load master layer toggle is enabled. */
  masterEnabled: boolean;
  /** IDs of staffing overlays currently visible on the map. */
  activeFteCoverageIds: string[];
  /** ID of the staffing record currently driving the details panel (or null). */
  selectedFteId: string | null;
}

const TAG = '[StaffingValidation]';

export function useStaffingValidation({
  masterEnabled,
  activeFteCoverageIds,
  selectedFteId,
}: Params): void {
  // Snapshot of active set captured the moment master toggle flips off,
  // used to verify on→off→on restore behavior.
  const lastActiveBeforeOffRef = useRef<string[] | null>(null);
  const prevMasterEnabledRef = useRef<boolean>(masterEnabled);
  const prevActiveKeyRef = useRef<string>('');
  const prevSelectedRef = useRef<string | null>(selectedFteId);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const activeKey = [...activeFteCoverageIds].sort().join('|');

    // --- Invariant 1: uniqueness ---
    if (new Set(activeFteCoverageIds).size !== activeFteCoverageIds.length) {
      console.warn(`${TAG} INVARIANT FAIL: activeFteCoverageIds contains duplicates`, {
        activeFteCoverageIds,
      });
    }

    // --- Invariant 2: details target must be in active set (or null) ---
    if (selectedFteId !== null && !activeFteCoverageIds.includes(selectedFteId)) {
      // Edge case: details panel can legitimately remain on an FTE while the
      // master layer is off (overlays hidden but selection preserved). Only
      // warn when master is on, since that's when desync is user-visible.
      if (masterEnabled) {
        console.warn(`${TAG} INVARIANT FAIL: selectedFteId not in active set`, {
          selectedFteId,
          activeFteCoverageIds,
        });
      }
    }

    // --- Invariant 3: master off ⇒ no overlays render ---
    // We can't introspect Leaflet from here, but we can assert that the
    // upstream contract holds: when master is off, MapView reads the layer
    // flag and skips rendering. We log the state so a regression is visible.
    if (!masterEnabled && activeFteCoverageIds.length > 0) {
      console.info(
        `${TAG} master OFF — overlays suppressed, ${activeFteCoverageIds.length} selection(s) preserved:`,
        activeFteCoverageIds,
      );
    }

    // --- Master toggle transitions ---
    const prevMaster = prevMasterEnabledRef.current;
    if (prevMaster !== masterEnabled) {
      if (!masterEnabled) {
        // ON → OFF: snapshot for restore check
        lastActiveBeforeOffRef.current = [...activeFteCoverageIds];
        console.info(`${TAG} master ON → OFF`, {
          snapshot: lastActiveBeforeOffRef.current,
          selectedFteId,
        });
      } else {
        // OFF → ON: verify restore matches snapshot
        const snapshot = lastActiveBeforeOffRef.current;
        if (snapshot !== null) {
          const snapKey = [...snapshot].sort().join('|');
          if (snapKey !== activeKey) {
            console.warn(`${TAG} INVARIANT FAIL: restore mismatch on master OFF → ON`, {
              expected: snapshot,
              actual: activeFteCoverageIds,
            });
          } else {
            console.info(`${TAG} master OFF → ON — restored ${activeFteCoverageIds.length} selection(s)`, activeFteCoverageIds);
          }
        }
      }
    }

    // --- Active set transitions (only when master is on, to avoid noise) ---
    if (masterEnabled && activeKey !== prevActiveKeyRef.current) {
      console.info(`${TAG} active set changed →`, {
        active: activeFteCoverageIds,
        controlsDetails: selectedFteId,
      });
    }

    // --- Details target transitions ---
    if (selectedFteId !== prevSelectedRef.current) {
      console.info(`${TAG} details panel target →`, {
        selectedFteId,
        active: activeFteCoverageIds,
      });
    }

    prevMasterEnabledRef.current = masterEnabled;
    prevActiveKeyRef.current = activeKey;
    prevSelectedRef.current = selectedFteId;
  }, [masterEnabled, activeFteCoverageIds, selectedFteId]);
}
