import L from 'leaflet';

/**
 * Member access radius rings (10 / 25 / 40 mi). Pure factory; adds circles to
 * the provided LayerGroup. Non-interactive, pane-assigned, Nevada clipping
 * handled upstream by the member-rings pane mask.
 *
 * Colors mirror the existing operational distance tiers so the rings act as a
 * visual key for the same thresholds shown in the member access badges:
 *   - 10 mi  → Local         → service-presence (green)
 *   - 25 mi  → Managed       → tier1            (amber)
 *   - 40 mi  → High Friction → access-gap       (red)
 * No 40+ ring is rendered (Non-Viable is implicit beyond the outer ring).
 *
 * Subtle by design: low-opacity strokes, near-zero fill, dashed outer rings —
 * the member pin stays visually primary.
 */
type RingKey = 'local' | 'managed' | 'highFriction';

interface RingStyle {
  mi: number;
  /** HSL var name (without `--`) — resolved at render via getComputedStyle-free CSS hsla(). */
  hslVar: string;
  strokeAlpha: number;
  fillAlpha: number;
  weight: number;
  dash: string;
}

export const MEMBER_DISTANCE_RING_STYLES: Record<RingKey, RingStyle> = {
  local:        { mi: 10, hslVar: '--service-presence',  strokeAlpha: 0.55, fillAlpha: 0.04,  weight: 2,   dash: '' },
  managed:      { mi: 25, hslVar: '--tier1',             strokeAlpha: 0.45, fillAlpha: 0.025, weight: 1.5, dash: '6 4' },
  highFriction: { mi: 40, hslVar: '--access-gap-border', strokeAlpha: 0.40, fillAlpha: 0.02,  weight: 1.25, dash: '4 4' },
};

/** Back-compat export — array form preserves prior consumers. */
export const MEMBER_RING_DEFS = Object.values(MEMBER_DISTANCE_RING_STYLES);

const milesToMeters = (mi: number) => mi * 1609.344;

/** Build an hsla() string from a CSS variable that holds `H S% L%` (or `H S% L% / A`). */
const hsla = (cssVar: string, alpha: number) =>
  `hsla(var(${cssVar}) / ${alpha})`;

export const addMemberRadiusRings = (
  group: L.LayerGroup,
  lat: number,
  lng: number,
  paneId: string,
): void => {
  Object.values(MEMBER_DISTANCE_RING_STYLES).forEach(({ mi, hslVar, strokeAlpha, fillAlpha, weight, dash }) => {
    const stroke = hsla(hslVar, strokeAlpha);
    const fill = hsla(hslVar, fillAlpha);
    const circle = L.circle([lat, lng], {
      radius: milesToMeters(mi),
      color: stroke,
      weight,
      fillColor: fill,
      fillOpacity: 1, // alpha is baked into fill color so token chain stays declarative
      dashArray: dash || undefined,
      interactive: false,
      pane: paneId,
    });
    group.addLayer(circle);
  });
};
