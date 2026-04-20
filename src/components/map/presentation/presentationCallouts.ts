import type { PresentationPhase } from '@/hooks/usePresentationMode';

/**
 * Static callout config for Presentation Mode.
 *
 * Zones map to layout regions, NOT viewport coordinates:
 *  - 'sidebar'  → left column (matches sidebar width); hidden on mobile collapse
 *  - 'map-tl' / 'map-tr' / 'map-bl' / 'map-br' → quadrants of the map canvas only
 *  - 'panel'    → right column (rendered only when a detail panel is open)
 *
 * Each phase guarantees no two callouts share a zone — prevents stacking.
 * Max 4 callouts per phase. No callout has a viewport pixel coordinate.
 */
export type CalloutZone = 'sidebar' | 'map-tl' | 'map-tr' | 'map-bl' | 'map-br' | 'panel';

export interface PresentationCallout {
  id: string;
  phase: PresentationPhase;
  zone: CalloutZone;
  title: string;
  body: string;
}

export const PRESENTATION_CALLOUTS: PresentationCallout[] = [
  // Phase 1 — Orientation: what this is
  {
    id: 'p1-operational',
    phase: 1,
    zone: 'map-tl',
    title: 'Operational Map, Not a Directory',
    body: 'Built for field deployment and care coordination — not a searchable provider list.',
  },
  {
    id: 'p1-listed-vs-usable',
    phase: 1,
    zone: 'sidebar',
    title: 'Listed Resources ≠ Usable Options',
    body: 'A pin on the map does not mean a member can actually be served there today.',
  },
  {
    id: 'p1-geography',
    phase: 1,
    zone: 'map-bl',
    title: 'Geography Drives Constraints',
    body: 'Distance, terrain, and connectivity decide what coordination is realistic in rural Nevada.',
  },

  // Phase 2 — Member Reality
  {
    id: 'p2-member-reality',
    phase: 2,
    zone: 'sidebar',
    title: 'Member-Level Reality',
    body: 'Place a member to see what access actually looks like from their address — not the county average.',
  },
  {
    id: 'p2-distance',
    phase: 2,
    zone: 'panel',
    title: 'Distance ≠ Access',
    body: 'Closest provider is not the same as a usable provider. Tiers reflect viability, not just miles.',
  },

  // Phase 3 — Ownership & Trust
  {
    id: 'p3-chw-ownership',
    phase: 3,
    zone: 'sidebar',
    title: 'CHW Ownership Model',
    body: 'Every county is owned by either a Primary CHW (in-person) or a Remote CHW (coordination only).',
  },
  {
    id: 'p3-verified',
    phase: 3,
    zone: 'panel',
    title: 'Verified vs Assumed Access',
    body: 'Verified resources have been confirmed operational. Unverified means we have not validated capacity.',
  },

  // Phase 4 — Feasibility & Limits
  {
    id: 'p4-connectivity',
    phase: 4,
    zone: 'sidebar',
    title: 'Connectivity Defines Feasibility',
    body: 'Broadband and cellular tiers determine whether telehealth or remote coordination is realistic at all.',
  },
  {
    id: 'p4-decisions',
    phase: 4,
    zone: 'map-bl',
    title: "This Informs Decisions, It Doesn't Make Them",
    body: 'The map surfaces constraints and gaps. Routing and assignment decisions still belong to humans.',
  },
  {
    id: 'p4-limits',
    phase: 4,
    zone: 'map-br',
    title: 'Known Limits',
    body: 'Verification lags real-world change. Treat unverified data as a starting point, not ground truth.',
  },
];

export const getCalloutsForPhase = (phase: PresentationPhase): PresentationCallout[] =>
  PRESENTATION_CALLOUTS.filter((c) => c.phase === phase);
