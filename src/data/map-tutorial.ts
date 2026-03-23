export type MapTutorialStepKey =
  | 'search'
  | 'facilityFilters'
  | 'coreMap'
  | 'providerLocations'
  | 'map'
  | 'detailsPanel';

export interface MapTutorialStep {
  key: MapTutorialStepKey;
  title: string;
  text: string;
  selectors: string[];
  footer?: string;
}

export const MAP_TUTORIAL_STORAGE_KEY = 'rural-operations-map-tutorial-complete';
export const MAP_TUTORIAL_STORAGE_VERSION = 'v4';
export const MAP_TUTORIAL_COMPLETION_VALUE = `completed:${MAP_TUTORIAL_STORAGE_VERSION}`;

export const isMapTutorialCompleted = (value: string | null) => value === MAP_TUTORIAL_COMPLETION_VALUE;

export const MAP_TUTORIAL_STEPS: MapTutorialStep[] = [
  {
    key: 'search',
    title: 'Search for a location',
    text: 'Search for a facility, city, or county without scanning the full map.',
    selectors: ['[data-tutorial="search-bar"]'],
  },
  {
    key: 'facilityFilters',
    title: 'Filter locations by type',
    text: 'Use these chips to show Hospital, Clinic, Service, or Behavioral Health locations.',
    selectors: ['[data-tutorial="facility-filter-chips"]', '[data-tutorial="facility-filters"]'],
  },
  {
    key: 'coreMap',
    title: 'Toggle map layers',
    text: 'Turn major map layers on or off without changing the underlying data.',
    selectors: ['[data-tutorial="section-core-map"]'],
  },
  {
    key: 'providerLocations',
    title: 'Show or hide providers',
    text: 'Provider Locations shows hospital and clinic pins. Red is hospital; blue is clinic.',
    selectors: ['[data-tutorial="toggle-provider-locations"]'],
  },
  {
    key: 'map',
    title: 'Inspect the map',
    text: 'Zoom and pan to inspect clusters, separate nearby markers, and review coverage statewide.',
    selectors: ['[data-tutorial="map-region"]'],
  },
  {
    key: 'detailsPanel',
    title: 'Review selected details',
    text: 'Click a marker or map layer to review its details in this panel.',
    selectors: ['[data-tutorial="details-panel"]'],
    footer: 'Decision tool, not a directory.',
  },
];