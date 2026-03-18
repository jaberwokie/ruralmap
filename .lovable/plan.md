

## Add Nevada State Boundary

**What**: Add a static Nevada state outline polygon rendered beneath all other layers, providing geographic context.

**Data**: Create `src/data/nevada-boundary.ts` with a simplified Nevada state boundary polygon (~20-25 coordinate points tracing the actual state border including the Colorado River jog in the south).

**MapView changes** (`src/components/map/MapView.tsx`):
- Add a new `stateBoundaryRef` layer ref
- Initialize it as the bottom-most layer (added to map before zones)
- Draw it in a new `useEffect` — always visible, no toggle:
  - Stroke: `hsl(240, 5%, 70%)`, weight 2, solid line
  - Fill: transparent
  - No interactivity (no hover/click)

**No sidebar toggle** — the state boundary is always-on reference geometry, similar to the base tile layer.

**Files to create**: `src/data/nevada-boundary.ts`
**Files to edit**: `src/components/map/MapView.tsx`

