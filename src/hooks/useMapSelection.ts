import { useState, useCallback, useMemo } from 'react';
import type { MapEntity } from '@/types/entities';
import { COUNTY_FTE_MAP } from '@/data/fte-capacity';

export interface MapSelectionState {
  lockedEntity: MapEntity | null;
  previousEntity: MapEntity | null;
  selectedFteId: string | null;
  selectedCounty: string | null;
  activeFteId: string | null;
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
  }, []);

  const handleMapClick = useCallback(() => {
    setLockedEntity(null);
    setPreviousEntity(null);
    setSelectedFteId(null);
  }, []);

  const handleFteHubClick = useCallback((fteId: string) => {
    const isAlready = selectedFteId === fteId;
    setSelectedFteId(isAlready ? null : fteId);
    setPreviousEntity(null);
    setLockedEntity(isAlready ? null : { type: 'fteDetail', fteId });
  }, [selectedFteId]);

  const handleFteCardClick = useCallback((fteId: string) => {
    const isAlready = selectedFteId === fteId;
    setSelectedFteId(isAlready ? null : fteId);
    setPreviousEntity(null);
    setLockedEntity(isAlready ? null : { type: 'fteDetail', fteId });
  }, [selectedFteId]);

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
