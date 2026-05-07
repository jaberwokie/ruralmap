import L from 'leaflet';

/**
 * Build the member-pin Leaflet marker (icon + handlers). Pure factory; does not
 * touch React state. The marker is added to a LayerGroup by the caller.
 *
 * Behavior notes (preserved from MapView inline implementation):
 * - Deep navy / white design. No pulse or animation.
 * - Draggable; on dragend, calls `onDragEnd` with the new coordinates.
 * - Click and mousedown propagation are stopped so the map's background-click
 *   handler does not clear the member location while the pin is present.
 */
export const createMemberPinMarker = (
  lat: number,
  lng: number,
  paneId: string,
  onDragEnd: (coords: { lat: number; lng: number }) => void,
): L.Marker => {
  const size = 32;
  const half = size / 2;
  const navy = 'hsl(var(--foreground))';

  const memberIcon = L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, size],
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="white" stroke="${navy}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(15,45,92,0.2));position:relative;z-index:1;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="${navy}"/></svg>
      </div>`,
  });

  const marker = L.marker([lat, lng], {
    icon: memberIcon,
    draggable: true,
    zIndexOffset: 10000,
    pane: paneId,
  });

  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    onDragEnd({ lat: pos.lat, lng: pos.lng });
  });

  // Member pin must not propagate clicks to the map's background-click
  // handler. The pin has no detail panel of its own — clicks are a no-op
  // beyond keeping it visible. Pan/zoom/dragend are unaffected.
  marker.on('click', (ev: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(ev);
  });
  marker.on('mousedown', (ev: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(ev);
  });

  return marker;
};
