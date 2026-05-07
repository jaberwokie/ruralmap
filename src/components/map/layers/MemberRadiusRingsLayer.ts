import L from 'leaflet';

/**
 * Member access radius rings (10 / 25 / 40 mi). Pure factory; adds circles to
 * the provided LayerGroup. Non-interactive, pane-assigned, Nevada clipping
 * handled upstream by the member-rings pane mask.
 *
 * Colors mirror the existing operational distance tiers so the rings act as a
 * visual key for the same thresholds shown in the member access badges:
 *   - 10 mi  → Local         → service-presence  (green)
 *   - 25 mi  → Managed       → tier1             (amber)
 *   - 40 mi  → High Friction → access-gap-border (red)
 *
 * Subtle by design: low-opacity strokes, near-zero fill, dashed outer rings —
 * the member pin stays visually primary.
 */
export type MemberDistanceRingTier = 'local' | 'managed' | 'highFriction';

export interface MemberDistanceRingStyle {
  mi: number;
  /** CSS variable name (with `--` prefix) — MUST resolve to an HSL triplet
   *  (e.g. `220 90% 50%`) so it composes with `hsla(var(--x) / a)`. */
  hslVar: string;
  strokeAlpha: number;
  fillAlpha: number;
  weight: number;
  dash?: string;
}

export const MEMBER_DISTANCE_RING_STYLES: Record<MemberDistanceRingTier, MemberDistanceRingStyle> = {
  local:        { mi: 10, hslVar: '--service-presence',  strokeAlpha: 0.55, fillAlpha: 0.04,  weight: 2 },
  managed:      { mi: 25, hslVar: '--tier1',             strokeAlpha: 0.45, fillAlpha: 0.025, weight: 1.5,  dash: '6 4' },
  highFriction: { mi: 40, hslVar: '--access-gap-border', strokeAlpha: 0.40, fillAlpha: 0.02,  weight: 1.25, dash: '4 4' },
};

/** Render order: largest first so smaller rings stay visually crisp on top. */
export const MEMBER_DISTANCE_RING_ORDER: MemberDistanceRingTier[] = ['highFriction', 'managed', 'local'];

/** Back-compat export — preserves prior consumers; built from ordered array. */
export const MEMBER_RING_DEFS: MemberDistanceRingStyle[] =
  MEMBER_DISTANCE_RING_ORDER.map((k) => MEMBER_DISTANCE_RING_STYLES[k]);

const milesToMeters = (mi: number) => mi * 1609.344;

/** Build hsla() from a CSS variable holding an HSL triplet (`H S% L%`). */
const hsla = (cssVar: string, alpha: number) => `hsla(var(${cssVar}) / ${alpha})`;

export const addMemberRadiusRings = (
  group: L.LayerGroup,
  lat: number,
  lng: number,
  paneId: string,
): void => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  for (const tier of MEMBER_DISTANCE_RING_ORDER) {
    const { mi, hslVar, strokeAlpha, fillAlpha, weight, dash } = MEMBER_DISTANCE_RING_STYLES[tier];
    if (mi <= 0) continue;

    const circle = L.circle([lat, lng], {
      radius: milesToMeters(mi),
      color: hsla(hslVar, strokeAlpha),
      weight,
      fillColor: hsla(hslVar, fillAlpha),
      fillOpacity: 1, // alpha baked into fill color so token chain stays declarative
      dashArray: dash,
      interactive: false,
      pane: paneId,
    });
    group.addLayer(circle);
  }
};
