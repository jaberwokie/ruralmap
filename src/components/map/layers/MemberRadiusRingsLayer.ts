import L from 'leaflet';

/**
 * Member access radius rings (10 / 25 / 40 mi). Pure factory; adds circles to
 * the provided LayerGroup. Behavior preserved verbatim from the inline
 * implementation in MapView (colors, weights, dash patterns, fill opacities,
 * pane assignment, non-interactive).
 */
export const MEMBER_RING_DEFS = [
  { mi: 10, color: 'hsla(0, 0%, 30%, 0.52)', weight: 3,   dash: '',    fillOpacity: 0.032 },
  { mi: 25, color: 'hsla(0, 0%, 30%, 0.22)', weight: 1.5, dash: '8 5', fillOpacity: 0.015 },
  { mi: 40, color: 'hsla(0, 0%, 30%, 0.10)', weight: 1,   dash: '4 4', fillOpacity: 0.008 },
] as const;

const milesToMeters = (mi: number) => mi * 1609.344;

export const addMemberRadiusRings = (
  group: L.LayerGroup,
  lat: number,
  lng: number,
  paneId: string,
): void => {
  MEMBER_RING_DEFS.forEach(({ mi, color, weight, dash, fillOpacity }) => {
    const circle = L.circle([lat, lng], {
      radius: milesToMeters(mi),
      color,
      weight,
      fillColor: color,
      fillOpacity,
      dashArray: dash || undefined,
      interactive: false,
      pane: paneId,
    });
    group.addLayer(circle);
  });
};
