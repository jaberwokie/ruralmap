/**
 * Debug click overlay — activated by ?debugClicks=1 query param.
 * Provides visual + console feedback for marker/county/clear events.
 */

const isDebugEnabled = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('debugClicks') === '1';
  } catch {
    return false;
  }
};

export const DEBUG_CLICKS = isDebugEnabled();

interface DebugClickState {
  type: string;
  name: string;
  timestamp: number;
}

let lastClick: DebugClickState | null = null;
let debugPanel: HTMLDivElement | null = null;

function ensureDebugPanel(): HTMLDivElement {
  if (debugPanel && document.body.contains(debugPanel)) return debugPanel;
  debugPanel = document.createElement('div');
  debugPanel.id = 'debug-click-panel';
  Object.assign(debugPanel.style, {
    position: 'fixed',
    bottom: '8px',
    left: '8px',
    zIndex: '10000',
    background: 'rgba(0,0,0,0.85)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '6px 10px',
    borderRadius: '4px',
    pointerEvents: 'none',
    maxWidth: '320px',
    lineHeight: '1.4',
  });
  document.body.appendChild(debugPanel);
  return debugPanel;
}

function updatePanel(state: DebugClickState) {
  const panel = ensureDebugPanel();
  const time = new Date(state.timestamp).toLocaleTimeString();
  panel.innerHTML = `<b>Last click:</b> ${state.type}<br/><b>Name:</b> ${state.name}<br/><b>Time:</b> ${time}`;
}

function showPulse(marker?: any) {
  if (!marker) return;
  const el = marker.getElement?.() ?? marker._icon;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${rect.left + rect.width / 2 - 18}px`,
    top: `${rect.top + rect.height / 2 - 18}px`,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid #0f0',
    pointerEvents: 'none',
    zIndex: '10001',
    animation: 'debug-pulse 0.6s ease-out forwards',
  });
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);
}

// Inject pulse keyframes once
if (DEBUG_CLICKS && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes debug-pulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function debugMarkerClick(type: string, name: string, marker?: any) {
  if (!DEBUG_CLICKS) return;
  console.log(`[marker-click] type=${type} name=${name}`);
  lastClick = { type, name, timestamp: Date.now() };
  updatePanel(lastClick);
  showPulse(marker);
}

export function debugCountyClick(county: string) {
  if (!DEBUG_CLICKS) return;
  console.log(`[county-click] county=${county}`);
  lastClick = { type: 'county', name: county, timestamp: Date.now() };
  updatePanel(lastClick);
}

export function debugMapClear() {
  if (!DEBUG_CLICKS) return;
  console.log(`[map-clear]`);
  lastClick = { type: 'clear', name: '—', timestamp: Date.now() };
  updatePanel(lastClick);
}
