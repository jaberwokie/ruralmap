import L from 'leaflet';

/**
 * Build the member-pin Leaflet marker (icon + handlers). Pure factory; does not
 * touch React state. The marker is added to a LayerGroup by the caller.
 *
 * Behavior notes (preserved from MapView inline implementation):
 * - Distinct white/black design with pulse keyframes injected once on demand.
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
  const memberIcon = L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    html: `<div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.08);animation:member-pulse 3s ease-in-out infinite;"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(0,0,0,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.25));position:relative;z-index:1;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5" fill="#1a1a1a"/></svg>
      </div>`,
  });

  // Inject pulse keyframes once
  if (!document.getElementById('member-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'member-pulse-style';
    style.textContent = `@keyframes member-pulse { 0%,100% { transform:scale(1);opacity:0.5; } 50% { transform:scale(2.2);opacity:0; } }`;
    document.head.appendChild(style);
  }

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
