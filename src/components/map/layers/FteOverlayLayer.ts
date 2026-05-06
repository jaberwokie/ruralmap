import L from 'leaflet';
import { fteCapacityData, FTE_ROLE_COLORS, getLoadStatus } from '@/data/fte-capacity';

interface RenderFteHubsOptions {
  group: L.LayerGroup;
  pane: string;
  selectedFteId: string | null | undefined;
  onClick: (fteId: string, event: L.LeafletEvent) => void;
}

// Subtle strain-derived border accent. Maps existing load status (no new math)
// to a quiet visual cue so high-strain hubs read as constrained at a glance.
// Low → no extra emphasis. Moderate → soft amber halo. High → subtle red halo.
const STRAIN_HALO: Record<'low' | 'moderate' | 'high', string> = {
  low: '',
  moderate: '0 0 0 3px hsla(38, 92%, 50%, 0.18)',
  high: '0 0 0 3px hsla(0, 75%, 55%, 0.22)',
};
const STRAIN_DOT: Record<'low' | 'moderate' | 'high', string> = {
  low: '',
  moderate: 'hsl(38, 92%, 50%)',
  high: 'hsl(0, 75%, 55%)',
};

export function renderFteHubs({ group, pane, selectedFteId, onClick }: RenderFteHubsOptions) {
  group.clearLayers();

  fteCapacityData.forEach((fte) => {
    if (!fte.hubLocation) return;

    const roleColor = FTE_ROLE_COLORS[fte.id]?.primary ?? 'hsl(0,0%,50%)';
    const isSelected = selectedFteId === fte.id;
    const anchorName = fte.anchorSite?.name;
    const coverageLabel = anchorName ? `Field · ${anchorName}` : 'Field';

    const load = getLoadStatus(fte.currentLoad, fte.capacity);
    const tier: 'low' | 'moderate' | 'high' = load === 'available' ? 'low' : load === 'near' ? 'moderate' : 'high';
    const haloShadow = STRAIN_HALO[tier];
    const baseShadow = isSelected
      ? `0 0 0 3px ${roleColor}40, 0 1px 4px hsla(0,0%,0%,0.15)`
      : '0 1px 4px hsla(0,0%,0%,0.15)';
    const boxShadow = haloShadow ? `${haloShadow}, ${baseShadow}` : baseShadow;
    const strainDotColor = STRAIN_DOT[tier];
    const strainDot = strainDotColor
      ? `<div title="Strain: ${tier}" style="position:absolute;top:-3px;left:-3px;width:6px;height:6px;border-radius:50%;background:${strainDotColor};border:1.5px solid white;"></div>`
      : '';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        display:flex; align-items:center; gap:5px;
        background:white; border:2px solid ${roleColor};
        border-radius:14px; padding:4px 10px 4px 6px;
        box-shadow:${boxShadow};
        cursor:pointer; white-space:nowrap;
        min-width:44px; min-height:28px;
        position:relative;
        ${isSelected ? 'animation: fte-pulse 1.5s ease-in-out infinite;' : ''}
      ">
        <div style="position:relative;width:10px;height:10px;flex-shrink:0;">
          <div style="width:10px;height:10px;border-radius:50%;background:${roleColor};border:1.5px solid white;box-shadow:0 0 0 1px ${roleColor};"></div>
          ${anchorName ? `<div title="Anchored site" style="position:absolute;top:-3px;right:-3px;width:6px;height:6px;border-radius:50%;background:white;border:1.5px solid ${roleColor};"></div>` : ''}
          ${strainDot}
        </div>
        <span style="font-size:10px;font-weight:600;color:${roleColor};">${fte.label}</span>
        <span style="font-size:9px;color:hsl(0,0%,50%);">${coverageLabel}</span>
      </div>`,
      iconSize: [170, 28],
      iconAnchor: [0, 14],
    });

    const marker = L.marker([fte.hubLocation.lat, fte.hubLocation.lng], {
      icon,
      interactive: true,
      // Selected FTE rides above other FTE labels in the same top pane.
      zIndexOffset: isSelected ? 2000 : 1000,
      // Top-priority pane is populated ONLY while the FTE toggle is on
      // (this whole effect early-returns when the toggle is off, so the
      // pane stays visually empty and reserves no marker space).
      pane,
    });
    marker.on('click', (e: L.LeafletEvent) => {
      onClick(fte.id, e);
    });
    group.addLayer(marker);
  });
}
