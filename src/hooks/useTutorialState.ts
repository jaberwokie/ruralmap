import { useState, useCallback, useRef, useEffect } from 'react';
import type { LayerState } from '@/types/layers';
import type { MapEntity } from '@/types/entities';
import {
  isMapTutorialCompleted,
  MAP_TUTORIAL_COMPLETION_VALUE,
  MAP_TUTORIAL_STORAGE_KEY,
  MAP_TUTORIAL_STEPS,
  MapTutorialStepKey,
} from '@/data/map-tutorial';

interface TutorialSnapshot {
  layers: LayerState;
  coverageRadius: boolean;
  coverageGaps: boolean;
}

export interface UseTutorialStateReturn {
  tutorialIntroOpen: boolean;
  tutorialOpen: boolean;
  tutorialStepIndex: number;
  tutorialStepKey: MapTutorialStepKey | null;
  startTutorial: () => void;
  closeTutorial: (markComplete?: boolean) => void;
  replayTutorial: () => void;
  goToNextTutorialStep: () => void;
  goToPreviousTutorialStep: () => void;
}

interface TutorialDeps {
  /** Get current layer/coverage snapshot */
  getSnapshot: () => TutorialSnapshot;
  /** Restore a snapshot */
  restoreSnapshot: (snap: TutorialSnapshot) => void;
  /** Set specific layers during tutorial steps */
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  /** Control mobile sidebar */
  setMobileSidebarOpen: (open: boolean) => void;
  /** Clear selection state */
  clearSelection: () => void;
}

export const useTutorialState = (deps: TutorialDeps): UseTutorialStateReturn => {
  const [tutorialIntroOpen, setTutorialIntroOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const snapshotRef = useRef<TutorialSnapshot | null>(null);

  // Check completion on mount
  useEffect(() => {
    try {
      const completed = isMapTutorialCompleted(localStorage.getItem(MAP_TUTORIAL_STORAGE_KEY));
      if (!completed) setTutorialIntroOpen(true);
    } catch {
      setTutorialIntroOpen(true);
    }
  }, []);

  const tutorialStepKey = tutorialOpen ? MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key ?? null : null;

  const markComplete = useCallback(() => {
    try {
      localStorage.setItem(MAP_TUTORIAL_STORAGE_KEY, MAP_TUTORIAL_COMPLETION_VALUE);
    } catch {}
  }, []);

  const restoreSnapshotInternal = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;
    deps.restoreSnapshot(snap);
    snapshotRef.current = null;
  }, [deps]);

  const startTutorial = useCallback(() => {
    snapshotRef.current = deps.getSnapshot();
    setTutorialIntroOpen(false);
    deps.setMobileSidebarOpen(false);
    deps.clearSelection();
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  }, [deps]);

  const closeTutorial = useCallback((doMarkComplete = false) => {
    setTutorialIntroOpen(false);
    setTutorialOpen(false);
    setTutorialStepIndex(0);
    restoreSnapshotInternal();
    if (doMarkComplete) markComplete();
  }, [markComplete, restoreSnapshotInternal]);

  const replayTutorial = useCallback(() => {
    const nextSnap = snapshotRef.current ?? deps.getSnapshot();
    restoreSnapshotInternal();
    snapshotRef.current = nextSnap;
    setTutorialIntroOpen(false);
    deps.setMobileSidebarOpen(false);
    deps.clearSelection();
    setTutorialStepIndex(0);
    setTutorialOpen(true);
  }, [deps, restoreSnapshotInternal]);

  const goToNextTutorialStep = useCallback(() => {
    setTutorialStepIndex((current) => {
      if (current >= MAP_TUTORIAL_STEPS.length - 1) {
        window.setTimeout(() => closeTutorial(true), 0);
        return current;
      }
      return current + 1;
    });
  }, [closeTutorial]);

  const goToPreviousTutorialStep = useCallback(() => {
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  }, []);

  // Tutorial-driven layer overrides
  useEffect(() => {
    if (!tutorialOpen) return;
    const stepKey = MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key as MapTutorialStepKey | undefined;
    if (!stepKey) return;
    if (stepKey === 'coreMap' || stepKey === 'providerLocations') {
      deps.setLayers((current) => ({ ...current, services: true, behavioralHealth: true }));
    }
  }, [tutorialOpen, tutorialStepIndex, deps]);

  // Tutorial-driven mobile sidebar
  useEffect(() => {
    if (!tutorialOpen || window.innerWidth >= 768) return;
    const stepKey = MAP_TUTORIAL_STEPS[tutorialStepIndex]?.key as MapTutorialStepKey | undefined;
    if (!stepKey) return;
    const sidebarSteps = new Set<MapTutorialStepKey>(['search', 'facilityFilters', 'coreMap', 'providerLocations', 'connectivity']);
    deps.setMobileSidebarOpen(sidebarSteps.has(stepKey));
  }, [tutorialOpen, tutorialStepIndex, deps]);

  return {
    tutorialIntroOpen,
    tutorialOpen,
    tutorialStepIndex,
    tutorialStepKey,
    startTutorial,
    closeTutorial,
    replayTutorial,
    goToNextTutorialStep,
    goToPreviousTutorialStep,
  };
};
