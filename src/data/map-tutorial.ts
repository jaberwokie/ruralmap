export type MapTutorialStepKey =
  | 'map'
  | 'legend'
  | 'coverageRadius'
  | 'engagementGap'
  | 'serviceNetwork'
  | 'usingMap';

export interface MapTutorialStep {
  key: MapTutorialStepKey;
  title: string;
  text: string;
  selectors: string[];
  footer?: string;
}

export const MAP_TUTORIAL_STORAGE_KEY = 'rural-operations-map-tutorial-complete';
export const MAP_TUTORIAL_STORAGE_VERSION = 'v3';
export const MAP_TUTORIAL_COMPLETION_VALUE = `completed:${MAP_TUTORIAL_STORAGE_VERSION}`;

export const isMapTutorialCompleted = (value: string | null) => value === MAP_TUTORIAL_COMPLETION_VALUE;

export const MAP_TUTORIAL_STEPS: MapTutorialStep[] = [
  {
    key: 'map',
    title: 'What you’re looking at',
    text: 'This map shows where services exist, how far they reach, and where people are not being reached.',
    selectors: ['[data-tutorial="map-region"]'],
  },
  {
    key: 'legend',
    title: 'Mapped categories',
    text: 'Red = hospital. Blue = clinic. Green = service. Purple = behavioral health.',
    selectors: ['[data-tutorial="legend"]'],
  },
  {
    key: 'coverageRadius',
    title: 'Coverage radius',
    text: 'These circles show how far providers can realistically reach. Outside them, access drops off.',
    selectors: ['[data-tutorial="toggle-coverage-radius"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'engagementGap',
    title: 'Engagement gaps',
    text: 'These areas show where people are not being reached, even when services are nearby.',
    selectors: ['[data-tutorial="toggle-engagement-gap"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'serviceNetwork',
    title: 'Service and behavioral health',
    text: 'Green markers show general community support locations. Purple markers show behavioral health locations drawn separately from the same source database.',
    selectors: ['[data-tutorial="toggle-services"]', '[data-tutorial="toggle-behavioral-health"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'usingMap',
    title: 'Using the map',
    text: 'Use this to decide where to deploy staff, expand services, or fix access gaps.',
    selectors: ['[data-tutorial="sidebar"]', '[data-tutorial="map-region"]'],
    footer: 'This is a decision tool, not a directory.',
  },
];