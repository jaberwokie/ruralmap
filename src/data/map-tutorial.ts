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
}

export const MAP_TUTORIAL_STORAGE_KEY = 'rural-operations-map-tutorial-complete';

export const MAP_TUTORIAL_STEPS: MapTutorialStep[] = [
  {
    key: 'map',
    title: 'What you’re looking at',
    text: 'This map shows where services exist, how far they reach, and where people are not being reached across the system.',
    selectors: ['[data-tutorial="map-region"]'],
  },
  {
    key: 'legend',
    title: 'Facility types',
    text: 'Red = Hospitals. Blue = Clinics and community-based providers.',
    selectors: ['[data-tutorial="legend"]'],
  },
  {
    key: 'coverageRadius',
    title: 'Coverage radius',
    text: 'These circles show how far providers can realistically reach. Outside them, access drops off quickly.',
    selectors: ['[data-tutorial="toggle-coverage-radius"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'engagementGap',
    title: 'Engagement gaps',
    text: 'These areas show where people are not being reached, even when services exist nearby.',
    selectors: ['[data-tutorial="toggle-engagement-gap"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'serviceNetwork',
    title: 'Service network',
    text: 'This shows how providers are connected. Strong networks support coordination. Weak ones create gaps.',
    selectors: ['[data-tutorial="toggle-services"]', '[data-tutorial="map-region"]'],
  },
  {
    key: 'usingMap',
    title: 'Using the map',
    text: 'Use this to decide where to deploy staff, expand services, or fix access gaps.',
    selectors: ['[data-tutorial="sidebar"]', '[data-tutorial="map-region"]'],
  },
];