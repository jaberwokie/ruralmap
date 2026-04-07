import { useState, useCallback } from 'react';
import type { Filters } from '@/types/filters';

export interface MapFilterState {
  searchQuery: string;
  filters: Filters;
  topProvidersOnly: boolean;
  engagementRateBelow20Only: boolean;
}

export interface MapFilterActions {
  setSearchQuery: (q: string) => void;
  setFilters: (f: Filters) => void;
  setTopProvidersOnly: (v: boolean) => void;
  setEngagementRateBelow20Only: (v: boolean) => void;
}

export interface UseMapFiltersReturn extends MapFilterState {
  actions: MapFilterActions;
}

export const useMapFilters = (): UseMapFiltersReturn => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ types: new Set(), counties: new Set(), serviceCategories: new Set() });
  const [topProvidersOnly, setTopProvidersOnly] = useState(false);
  const [engagementRateBelow20Only, setEngagementRateBelow20Only] = useState(false);

  const actions: MapFilterActions = {
    setSearchQuery: useCallback((q: string) => setSearchQuery(q), []),
    setFilters: useCallback((f: Filters) => setFilters(f), []),
    setTopProvidersOnly: useCallback((v: boolean) => setTopProvidersOnly(v), []),
    setEngagementRateBelow20Only: useCallback((v: boolean) => setEngagementRateBelow20Only(v), []),
  };

  return {
    searchQuery,
    filters,
    topProvidersOnly,
    engagementRateBelow20Only,
    actions,
  };
};
