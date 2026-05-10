import type { LayerState } from '@/types/layers';

interface MapLegendProps {
  layers: Partial<LayerState>;
  /** Used to detect a meaningful operational state. County-only stays minimal. */
  hasAccessGaps?: boolean;
  hasTier1?: boolean;
  /**
   * When true, the Decision Assist drawer is mounted (collapsed OR expanded).
   * The legend lifts above the drawer using the measured
   * `--decision-assist-height` CSS variable published by the drawer
   * (ResizeObserver-driven), so the lift tracks both states.
   */
  decisionAssistVisible?: boolean;
}

interface Section {
  key: string;
  title: string;
  rows: { swatch: React.ReactNode; label: string }[];
}

const dot = (cls: string) => (
  <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
);

const square = (style: React.CSSProperties) => (
  <span className="inline-block h-2.5 w-3.5 rounded-sm" style={style} />
);

/**
 * Unified, dynamic on-map legend. Sections appear only for layers the user
 * can currently see, in operational priority order. Reuses already-derived
 * `LayerState` — no extra calculation. Replaces the prior connectivity-only
 * floating block.
 */
const MapLegend = ({ layers, hasAccessGaps, hasTier1, decisionAssistVisible }: MapLegendProps) => {
  const liftStyle: React.CSSProperties = decisionAssistVisible
    ? { bottom: 'calc(var(--decision-assist-height, 96px) + 20px)' }
    : {};

  const sections: Section[] = [];

  // 1. Provider / Facility markers
  if (layers.serviceLocations) {
    sections.push({
      key: 'providers',
      title: 'Provider Locations',
      rows: [
        { swatch: dot('bg-hospital'), label: 'Hospital' },
        { swatch: dot('bg-clinic'), label: 'Clinic' },
      ],
    });
  }

  // 2. FTE hubs + field zones
  if (layers.fteCapacity) {
    sections.push({
      key: 'fte',
      title: 'Field Capacity',
      rows: [
        { swatch: dot('bg-response-active'), label: 'FTE hub' },
        { swatch: square({ border: '1px solid hsla(160,55%,40%,0.6)' }), label: 'Field reach zone' },
      ],
    });
  }

  // 3. Response Capability
  if (layers.operationalCoverage) {
    sections.push({
      key: 'response',
      title: 'Response Capability',
      rows: [
        { swatch: dot('bg-response-active'), label: 'Active field coverage' },
        { swatch: dot('bg-response-scheduled'), label: 'Scheduled outreach' },
        { swatch: dot('bg-response-remote'), label: 'Remote support only' },
      ],
    });
  }

  // 4. Access Gaps — only when overlay actively present
  if (hasAccessGaps) {
    sections.push({
      key: 'gaps',
      title: 'Operational Access Constraints',
      rows: [
        {
          swatch: square({ background: 'hsla(0, 65%, 55%, 0.25)', border: '1px dashed hsla(0,65%,40%,0.7)' }),
          label: 'No reachable in-person care',
        },
      ],
    });
  }

  // 5. Behavioral Health
  if (layers.behavioralHealth) {
    sections.push({
      key: 'bh',
      title: 'Behavioral Health',
      rows: [{ swatch: dot('bg-behavioral-health'), label: 'Behavioral health access points' }],
    });
  }

  // 6. Services
  if (layers.services) {
    sections.push({
      key: 'services',
      title: 'Services',
      rows: [{ swatch: dot('bg-service-presence'), label: 'Community services' }],
    });
  }

  // 7. Connectivity
  if (layers.broadbandAccess) {
    sections.push({
      key: 'broadband',
      title: 'Broadband',
      rows: [
        { swatch: square({ background: 'hsla(160, 50%, 45%, 0.35)' }), label: 'Served' },
        { swatch: square({ background: 'hsla(38, 85%, 52%, 0.35)' }), label: 'Underserved' },
        { swatch: square({ background: 'hsla(0, 65%, 55%, 0.35)' }), label: 'Unserved' },
      ],
    });
  }
  if (layers.cellularCoverage) {
    sections.push({
      key: 'cellular',
      title: 'Cellular',
      rows: [
        { swatch: square({ background: 'hsla(160, 55%, 40%, 0.35)' }), label: 'High' },
        { swatch: square({ background: 'hsla(44, 90%, 50%, 0.35)' }), label: 'Mixed' },
        { swatch: square({ background: 'hsla(20, 85%, 55%, 0.35)' }), label: 'Low' },
      ],
    });
  }

  // 8. Tribal / special overlays
  if (layers.tribalNations) {
    sections.push({
      key: 'tribal',
      title: 'Tribal Nations',
      rows: [
        { swatch: square({ background: 'hsla(280, 40%, 55%, 0.25)', border: '1px solid hsla(280,40%,40%,0.6)' }), label: 'Sovereign boundaries' },
      ],
    });
  }
  if (hasTier1) {
    sections.push({
      key: 'tier1',
      title: 'Tier 1 Providers',
      rows: [{ swatch: dot('bg-tier1 ring-1 ring-foreground/30'), label: 'Highest-priority providers' }],
    });
  }

  // 6. Empty operational state — show nothing OR minimal reference line
  if (sections.length === 0) {
    if (!layers.counties) return null;
    return (
      <div
        style={liftStyle}
        className="pointer-events-none absolute bottom-4 left-4 z-[800] rounded-md border border-border bg-card/85 px-2.5 py-1.5 shadow-sm backdrop-blur-sm transition-[bottom] duration-150"
      >
        <p className="text-[10px] text-muted-foreground">Reference boundaries</p>
      </div>
    );
  }

  return (
    <div
      style={liftStyle}
      className="pointer-events-none absolute bottom-4 left-4 z-[800] max-w-[180px] rounded-md border border-border bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur-sm space-y-2 transition-[bottom] duration-150"
    >
      {sections.map((section, i) => (
        <div key={section.key}>
          {i > 0 && <div className="-mt-1 mb-1.5 border-t border-border/50" />}
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.rows.map((row, j) => (
              <div key={j} className="flex items-center gap-1.5 text-[10px] text-foreground/80">
                {row.swatch}
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MapLegend;
