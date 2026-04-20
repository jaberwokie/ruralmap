import { useState, useCallback, useMemo } from 'react';
import type { MapEntity } from '@/types/entities';
import { COUNTY_FTE_MAP } from '@/data/fte-capacity';

export interface MapSelectionState {
  lockedEntity: MapEntity | null;
  previousEntity: MapEntity | null;
  selectedFteId: string | null;
  selectedCounty: string | null;
  activeFteId: string | null;
  /** Multi-select set of FTE coverage overlays currently visible on the map. */
  activeFteCoverageIds: string[];
}

export interface MapSelectionActions {
  selectEntity: (entity: MapEntity | null) => void;
  /** Select a new entity while preserving the current one for back-navigation. */
  selectEntityWithBack: (entity: MapEntity) => void;
  /** Restore the previously selected entity (if any). */
  goBack: () => void;
  clearSelection: () => void;
  selectCounty: (county: string) => void;
  selectFte: (fteId: string) => void;
  clearFteSelection: () => void;
  handleMapClick: () => void;
  handleFteHubClick: (fteId: string) => void;
  handleFteCardClick: (fteId: string) => void;
}

export interface UseMapSelectionReturn extends MapSelectionState {
  actions: MapSelectionActions;
}

export const useMapSelection = (): UseMapSelectionReturn => {
  const [lockedEntity, setLockedEntity] = useState<MapEntity | null>(null);
  const [previousEntity, setPreviousEntity] = useState<MapEntity | null>(null);
  const [selectedFteId, setSelectedFteId] = useState<string | null>(null);
  // Multi-select set of FTE coverage overlays. Independent of details panel selection.
  const [activeFteCoverageSet, setActiveFteCoverageSet] = useState<Set<string>>(() => new Set());

  const selectedCounty = useMemo(() => {
    if (!lockedEntity) return null;
    if (lockedEntity.type === 'ruralServiceGroup' || lockedEntity.type === 'county' || lockedEntity.type === 'memberVolume') {
      return lockedEntity.county;
    }
    return null;
  }, [lockedEntity]);

  const activeFteId = useMemo(() => {
    if (selectedFteId) return selectedFteId;
    if (selectedCounty) {
      const fte = COUNTY_FTE_MAP.get(selectedCounty);
      return fte?.id ?? null;
    }
    return null;
  }, [selectedFteId, selectedCounty]);

  const selectEntity = useCallback((entity: MapEntity | null) => {
    setLockedEntity(entity);
    setPreviousEntity(null);
  }, []);

  const selectEntityWithBack = useCallback((entity: MapEntity) => {
    setLockedEntity((current) => {
      setPreviousEntity(current);
      return entity;
    });
  }, []);

  const goBack = useCallback(() => {
    setLockedEntity(previousEntity);
    setPreviousEntity(null);
  }, [previousEntity]);

  const clearSelection = useCallback(() => {
    setLockedEntity(null);
    setPreviousEntity(null);
    setSelectedFteId(null);
    setActiveFteCoverageSet(new Set());
  }, []);

  const selectCounty = useCallback((county: string) => {
    setSelectedFteId(null);
    setPreviousEntity(null);
    setLockedEntity({ type: 'county', county });
  }, []);

  const selectFte = useCallback((fteId: string) => {
    setSelectedFteId(fteId);
    setPreviousEntity(null);
    setLockedEntity({ type: 'fteDetail', fteId });
  }, []);

  const clearFteSelection = useCallback(() => {
    setSelectedFteId(null);
    setActiveFteCoverageSet(new Set());
  }, []);

  const handleMapClick = useCallback(() => {
    setLockedEntity(null);
    setPreviousEntity(null);
    setSelectedFteId(null);
    // Map background click does not clear coverage overlays — they are an
    // independent visibility state controlled only by the staffing cards.
  }, []);

  const handleFteHubClick = useCallback((fteId: string) => {
    // Hub-pin click toggles the coverage overlay AND drives the details panel
    // to the clicked FTE (last-clicked wins for details — Option A).
    setActiveFteCoverageSet((prev) => {
      const next = new Set(prev);
      if (next.has(fteId)) next.delete(fteId);
      else next.add(fteId);
      return next;
    });
    setSelectedFteId((prev) => (prev === fteId ? null : fteId));
    setPreviousEntity(null);
    setLockedEntity((prev) =>
      prev?.type === 'fteDetail' && prev.fteId === fteId ? null : { type: 'fteDetail', fteId },
    );
  }, []);

  const handleFteCardClick = useCallback((fteId: string) => {
    // Sidebar card click is a multi-select toggle. Adding a card also makes it
    // the active details record (last-clicked wins). Removing the only active
    // card clears the details panel; removing one of several leaves details on
    // the most recently added card.
    setActiveFteCoverageSet((prev) => {
      const next = new Set(prev);
      const wasActive = next.has(fteId);
      if (wasActive) next.delete(fteId);
      else next.add(fteId);

      if (wasActive) {
        // Removed: if it was the details target, fall back to any remaining
        // active card, else clear details.
        setSelectedFteId((current) => {
          if (current !== fteId) return current;
          const remaining = Array.from(next);
          return remaining.length > 0 ? remaining[remaining.length - 1] : null;
        });
        setLockedEntity((current) => {
          if (current?.type !== 'fteDetail' || current.fteId !== fteId) return current;
          const remaining = Array.from(next);
          return remaining.length > 0
            ? { type: 'fteDetail', fteId: remaining[remaining.length - 1] }
            : null;
        });
      } else {
        // Added: this becomes the details target.
        setSelectedFteId(fteId);
        setLockedEntity({ type: 'fteDetail', fteId });
      }
      return next;
    });
    setPreviousEntity(null);
  }, []);

  const actions: MapSelectionActions = useMemo(() => ({
    selectEntity,
    selectEntityWithBack,
    goBack,
    clearSelection,
    selectCounty,
    selectFte,
    clearFteSelection,
    handleMapClick,
    handleFteHubClick,
    handleFteCardClick,
  }), [selectEntity, selectEntityWithBack, goBack, clearSelection, selectCounty, selectFte, clearFteSelection, handleMapClick, handleFteHubClick, handleFteCardClick]);

  return {
    lockedEntity,
    previousEntity,
    selectedFteId,
    selectedCounty,
    activeFteId,
    actions,
  };
};
