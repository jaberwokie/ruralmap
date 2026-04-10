export type MapTutorialStepKey =
  | 'search'
  | 'facilityFilters'
  | 'coreMap'
  | 'providerLocations'
  | 'map'
  | 'detailsPanel'
  | 'routingTiers'
  | 'connectivity'
  | 'tooltipBehavior';

export interface MapTutorialStep {
  key: MapTutorialStepKey;
  title: string;
  text: string;
  selectors: string[];
  footer?: string;
}

export const MAP_TUTORIAL_STORAGE_KEY = 'rural-operations-map-tutorial-complete';
export const MAP_TUTORIAL_STORAGE_VERSION = 'v5';
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
    text: 'Turn major map layers on or off. Only Core Map is open by default — expand other sections (Operations, Utilization, Access, Connectivity) as needed.',
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
    text: 'Zoom and pan to explore. Hover over a county or marker to see a summary — it appears in a fixed area at the top-left of the map, not under the cursor.',
    selectors: ['[data-tutorial="map-region"]'],
  },
  {
    key: 'detailsPanel',
    title: 'Review selected details',
    text: 'Click any marker or county to lock its details here. Look for Routing Tier and Verification Signal to guide decisions.',
    selectors: ['[data-tutorial="details-panel"]'],
  },
  {
    key: 'routingTiers',
    title: 'Understand routing tiers',
    text: 'Each provider or service shows a Routing Tier: "Recommended" means verified Medicaid access. "Available (Unverified)" means the provider exists but access is not confirmed. "Fallback Option" means limited confidence — use only when no better option exists. A Verification Signal tells you why: "Medicaid Verified" is confirmed via the state directory, "Provider Identified" means identity is confirmed but access is not, and "Unverified" means neither is confirmed.',
    selectors: ['[data-tutorial="details-panel"]'],
    footer: 'Recommended > Available > Fallback.',
  },
  {
    key: 'connectivity',
    title: 'Check connectivity layers',
    text: 'Under Connectivity, toggle Broadband Access and Cellular Coverage. These are county-level aggregate grades — not address-level guarantees. When both are on, a single combined legend appears at the bottom-left showing Broadband first, then Cellular.',
    selectors: ['[data-tutorial="section-core-map"]'],
    footer: 'Broad patterns, not exact service availability.',
  },
  {
    key: 'tooltipBehavior',
    title: 'Where to find hover info',
    text: 'When you hover over a county or marker, the summary appears in a fixed card at the top-left of the map — it does not follow your cursor. This keeps the view stable while you scan.',
    selectors: ['[data-tutorial="map-region"]'],
    footer: 'Decision tool, not a directory.',
  },
];
