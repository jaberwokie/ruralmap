import L from 'leaflet';

/**
 * Visual-only de-collision between the member pin and overlapping provider
 * markers / clusters. When a provider marker (or visible cluster) renders
 * within a small pixel threshold of the member pin at the current zoom, we
 * append a small CSS translate to its icon element so both symbols remain
 * readable. No coordinates, distances, clustering, popups, or click logic
 * are mutated — this is a pure DOM transform shim.
 *
 * Behavior:
 * - Offset is appended (+8px / -8px diagonal) to the existing leaflet
 *   transform so the marker stays anchored to its real lat/lng baseline.
 * - Leaflet calls `L.DomUtil.setPosition` on every map move/zoom which
 *   rewrites the transform; we re-apply on `move`/`zoomend` and on cluster
 *   `animationend` / `layeradd` so the shift survives those updates.
 * - When the member pin is cleared, the threshold is exceeded, or the
 *   shim is detached, all shifts are removed cleanly.
 */

const SHIFT_ATTR = 'data-member-overlap-shift';
const SHIFT_SUFFIX = ' translate(8px, -8px)';
const OVERLAP_THRESHOLD_PX = 22;

const clearShift = (el: HTMLElement) => {
  if (!el.hasAttribute(SHIFT_ATTR)) return;
  el.style.transform = el.style.transform.replace(SHIFT_SUFFIX, '');
  el.removeAttribute(SHIFT_ATTR);
};

const applyShift = (el: HTMLElement) => {
  if (el.hasAttribute(SHIFT_ATTR)) return;
  el.style.transform = `${el.style.transform}${SHIFT_SUFFIX}`;
  el.setAttribute(SHIFT_ATTR, '1');
};

const collectIcons = (map: L.Map, paneIds: string[]): HTMLElement[] => {
  const icons: HTMLElement[] = [];
  paneIds.forEach((paneId) => {
    const pane = map.getPane(paneId);
    if (!pane) return;
    pane.querySelectorAll<HTMLElement>('.leaflet-marker-icon').forEach((el) => {
      icons.push(el);
    });
  });
  return icons;
};

interface MemberOverlapShiftHandle {
  detach: () => void;
}

export function attachMemberOverlapShift(
  map: L.Map,
  memberLatLng: L.LatLng,
  options: {
    providerPaneIds: string[];
    memberPaneId: string;
    clusterGroups?: Array<L.LayerGroup | null | undefined>;
  },
): MemberOverlapShiftHandle {
  const { providerPaneIds, memberPaneId, clusterGroups = [] } = options;

  const apply = () => {
    const icons = collectIcons(map, providerPaneIds);
    if (icons.length === 0) return;
    const memberPt = map.latLngToLayerPoint(memberLatLng);
    const thresholdSq = OVERLAP_THRESHOLD_PX * OVERLAP_THRESHOLD_PX;

    icons.forEach((el) => {
      const pos = L.DomUtil.getPosition(el);
      if (!pos) {
        clearShift(el);
        return;
      }
      // Strip our suffix before measuring so an already-shifted icon is
      // judged by its real anchor position, not the shifted one.
      const wasShifted = el.hasAttribute(SHIFT_ATTR);
      const dx = pos.x - memberPt.x;
      const dy = pos.y - memberPt.y;
      const overlap = dx * dx + dy * dy <= thresholdSq;
      if (overlap) {
        if (!wasShifted) applyShift(el);
      } else if (wasShifted) {
        clearShift(el);
      }
    });
  };

  // Member pin's own icon must never receive the shift even if it ends up
  // queried by mistake; safeguard by clearing any stray attr in its pane.
  const guardMemberPane = () => {
    const memberPane = map.getPane(memberPaneId);
    if (!memberPane) return;
    memberPane.querySelectorAll<HTMLElement>(`.leaflet-marker-icon[${SHIFT_ATTR}]`).forEach(clearShift);
  };

  const run = () => {
    apply();
    guardMemberPane();
  };

  // Defer initial pass to next frame so freshly added markers have their
  // transforms set by Leaflet first.
  const rafId = requestAnimationFrame(run);

  map.on('move zoomend moveend viewreset', run);
  clusterGroups.forEach((group) => {
    if (!group) return;
    (group as unknown as L.Evented).on?.('animationend layeradd spiderfied unspiderfied', run);
  });

  return {
    detach: () => {
      cancelAnimationFrame(rafId);
      map.off('move zoomend moveend viewreset', run);
      clusterGroups.forEach((group) => {
        if (!group) return;
        (group as unknown as L.Evented).off?.('animationend layeradd spiderfied unspiderfied', run);
      });
      // Clear all current shifts.
      providerPaneIds.forEach((paneId) => {
        const pane = map.getPane(paneId);
        if (!pane) return;
        pane.querySelectorAll<HTMLElement>(`.leaflet-marker-icon[${SHIFT_ATTR}]`).forEach(clearShift);
      });
    },
  };
}
