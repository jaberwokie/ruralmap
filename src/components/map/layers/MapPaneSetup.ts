import L from 'leaflet';
import { DEBUG_CLICKS } from '@/components/map/debugClickOverlay';

export const PANE_CONFIG = {
  // Passive base polygons — never interactive
  basePolygons:    { id: 'base-polygons-pane',    zIndex: 200, interactive: false },
  // Visual-only coverage overlays — never interactive
  coverage:        { id: 'coverage-pane',          zIndex: 300, interactive: false },
  // County hit areas — interactive for click/hover
  countyInteractive: { id: 'county-interactive-pane', zIndex: 350, interactive: true },
  // Tribal Nation polygons — interactive, ABOVE county layer
  tribalNations:   { id: 'tribal-nations-pane',    zIndex: 450, interactive: true },
  // Provider radius circles — above gap overlays and tribal polygons,
  // below state mask and all marker panes. Non-interactive.
  driveRadiiAbove: { id: 'drive-radii-above-pane', zIndex: 500, interactive: false },
  // State boundary mask — covers outside Nevada, below markers so border-adjacent pins stay visible
  stateMask:       { id: 'state-mask-pane',        zIndex: 640, interactive: false },
  // All clickable non-provider markers
  markers:         { id: 'markers-pane',           zIndex: 650, interactive: true },
  // Provider markers — highest marker layer
  providerMarkers: { id: 'provider-markers-pane',  zIndex: 660, interactive: true },
  // Popup pane for tooltips
  uiPopups:        { id: 'ui-popups-pane',         zIndex: 700, interactive: true },
  // Member access radius rings — above all content layers, non-interactive
  memberRings:     { id: 'member-rings-pane',      zIndex: 710, interactive: false },
  // Member pin — absolute top interactive layer
  memberPin:       { id: 'member-pin-pane',        zIndex: 720, interactive: true },
  // FTE labels — conditionally populated only when Staffing Capacity & Load is ON.
  // Sits above member pin so anchored field labels are never clipped by overlays,
  // coverage polygons, dashed county boundaries, or cluster markers.
  fteLabels:       { id: 'fte-label-pane',         zIndex: 730, interactive: true },
} as const;

// Backward-compat mapping — maps OLD semantic names to NEW pane IDs
export const MAP_PANES = {
  stateOutline:              PANE_CONFIG.basePolygons.id,
  countyPolygons:            PANE_CONFIG.countyInteractive.id,
  broadbandOverlay:          PANE_CONFIG.coverage.id,
  cellularOverlay:           PANE_CONFIG.coverage.id,
  countyBorders:             PANE_CONFIG.basePolygons.id,
  operationalAreas:          PANE_CONFIG.basePolygons.id,
  driveRadii:                PANE_CONFIG.driveRadiiAbove.id,
  gapOverlays:               PANE_CONFIG.countyInteractive.id,
  groupedMarkers:            PANE_CONFIG.markers.id,
  servicePresence:           PANE_CONFIG.markers.id,
  behavioralHealth:          PANE_CONFIG.markers.id,
  responseCapabilityMarkers: PANE_CONFIG.markers.id,
  facilityMarkers:           PANE_CONFIG.providerMarkers.id,
  labels:                    PANE_CONFIG.basePolygons.id,
  highlights:                PANE_CONFIG.basePolygons.id,
  tribalNations:             PANE_CONFIG.tribalNations.id,
} as const;

// Centralized pane initializer — called once during map setup
export function initializeAllPanes(map: L.Map) {
  Object.entries(PANE_CONFIG).forEach(([key, cfg]) => {
    const pane = map.createPane(cfg.id);
    pane.style.zIndex = String(cfg.zIndex);
    // ALL pane divs use pointer-events: none. This prevents higher-z pane
    // divs from blocking clicks on elements in lower-z panes. Individual
    // interactive elements (marker icons, SVG paths) opt in at the element
    // level via CSS (.leaflet-marker-icon, .leaflet-interactive).
    pane.style.pointerEvents = 'none';
    if (DEBUG_CLICKS) {
      pane.addEventListener('click', () => {
        console.debug('[Pane Click]', { pane: key, id: cfg.id, interactive: cfg.interactive });
      }, true);
    }
  });
}

export const LEAFLET_UI_PANE_Z_INDEX = {
  markerPane: 190,   // below all custom panes so it never blocks
  tooltipPane: 820,
  popupPane: 830,
} as const;
