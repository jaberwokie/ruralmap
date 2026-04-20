import type { PresentationPhase } from '@/hooks/usePresentationMode';
import { getCalloutsForPhase, type CalloutZone, type PresentationCallout } from './presentationCallouts';

/**
 * Passive callout overlay for Presentation Mode.
 *
 * Constraints:
 *  - Renders nothing when isPresenting is false.
 *  - pointer-events-none wrapper: never blocks map interaction.
 *  - Layout-aware via fixed CSS offsets relative to the app shell.
 *    No DOM queries, no refs, no observers, no measurement.
 *  - Each phase guarantees one callout per zone — no stacking.
 *
 * Layout assumptions (match Index.tsx shell):
 *  - Sidebar is fixed 320px (md:w-80) on md+. Hidden on mobile (<md).
 *  - Detail panel renders inside the map column when an entity is selected.
 *  - We approximate the panel zone with a right-edge offset; if no panel is
 *    open we still render the 'panel' callout near the right edge as a fallback.
 */
interface Props {
  isPresenting: boolean;
  phase: PresentationPhase;
  /** Whether a detail panel is currently visible (controls 'panel' zone placement). */
  hasDetailPanel: boolean;
}

// Sidebar width matches md:w-80 in Index.tsx.
const SIDEBAR_W = 320;
// Approximate detail panel width when open.
const PANEL_W = 380;
// Fixed inset gap from each region edge.
const GAP = 16;

const calloutBaseClass =
  'pointer-events-auto absolute max-w-[260px] rounded-lg border border-primary/30 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm';

const renderCallout = (c: PresentationCallout, style: React.CSSProperties) => (
  <div key={c.id} style={style} className={calloutBaseClass}>
    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">{c.title}</div>
    <div className="mt-1 text-[12px] leading-snug text-foreground">{c.body}</div>
  </div>
);

const positionForZone = (zone: CalloutZone, hasDetailPanel: boolean): React.CSSProperties => {
  // Right-edge offset increases when the detail panel is occupying the right column.
  const rightEdge = hasDetailPanel ? PANEL_W + GAP : GAP;

  switch (zone) {
    case 'sidebar':
      // Anchored inside the sidebar column on md+, top of the column.
      return { top: GAP, left: GAP, maxWidth: SIDEBAR_W - GAP * 2 };
    case 'map-tl':
      return { top: GAP, left: SIDEBAR_W + GAP };
    case 'map-tr':
      // Stays clear of the toggle pill (top-3 right-3).
      return { top: 56, right: rightEdge };
    case 'map-bl':
      return { bottom: GAP, left: SIDEBAR_W + GAP };
    case 'map-br':
      return { bottom: GAP, right: rightEdge };
    case 'panel':
      // Anchored to the right column; if no panel is open, hugs the right edge.
      return { top: 80, right: GAP, maxWidth: hasDetailPanel ? PANEL_W - GAP * 2 : 260 };
    default:
      return { top: GAP, left: GAP };
  }
};

const PresentationOverlay = ({ isPresenting, phase, hasDetailPanel }: Props) => {
  if (!isPresenting) return null;

  const callouts = getCalloutsForPhase(phase);

  return (
    <div className="pointer-events-none fixed inset-0 z-[815]" aria-hidden={false}>
      {callouts.map((c) => renderCallout(c, positionForZone(c.zone, hasDetailPanel)))}
    </div>
  );
};

export default PresentationOverlay;
