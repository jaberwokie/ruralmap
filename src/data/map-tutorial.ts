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
    title: 'Find locations quickly',
    text: 'Use search to jump straight to a facility, city, or county without scanning the full map.',
    selectors: ['[data-tutorial="search-bar"]'],
  },
  {
    key: 'facilityFilters',
    title: 'Filter by facility type',
    text: 'Use these chips to narrow the map to Hospital, Clinic, Service, or Behavioral Health locations.',
    selectors: ['[data-tutorial="facility-filters"]'],
  },
  {
    key: 'coreMap',
    title: 'Control what appears on the map',
    text: 'This section turns major map layers on and off without changing the data underneath.',
    selectors: ['[data-tutorial="section-core-map"]'],
  },
  {
    key: 'providerLocations',
    title: 'Turn provider locations on or off',
    text: 'Provider Locations controls hospital and clinic pins. Red marks hospitals and blue marks clinics.',
    selectors: ['[data-tutorial="toggle-provider-locations"]'],
  },
  {
    key: 'map',
    title: 'Explore clusters and locations',
    text: 'Zoom and pan here to inspect clusters, separate nearby markers, and explore coverage across the state.',
    selectors: ['[data-tutorial="map-region"]'],
  },
  {
    key: 'detailsPanel',
    title: 'Open details here',
    text: 'When you click a marker or map layer, its details appear in this panel for closer review.',
    selectors: ['[data-tutorial="details-panel"]'],
    footer: 'This is a decision tool, not a directory.',
  },
];