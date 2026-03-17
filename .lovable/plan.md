

## Plan: Separate Coverage Radius/Gaps State

Extract `radius` and `gaps` from the `LayerState` object into two standalone `useState` hooks with dedicated handlers, matching the user's exact React logic.

### `src/pages/Index.tsx`
1. Remove `radius` and `gaps` from `LayerState` interface and initial state.
2. Add standalone state:
   ```ts
   const [coverageRadius, setCoverageRadius] = useState(true);
   const [coverageGaps, setCoverageGaps] = useState(false);
   ```
3. Add dedicated handlers matching user's exact logic (radius off forces gaps off).
4. Remove the radius/gaps branches from `handleToggleLayer`.
5. Pass `coverageRadius`, `coverageGaps`, `handleCoverageRadiusChange`, `handleCoverageGapsChange` as separate props to `Sidebar` and `MapView`.

### `src/components/map/Sidebar.tsx`
1. Add new props: `coverageRadius`, `coverageGaps`, `onCoverageRadiusChange`, `onCoverageGapsChange`.
2. Handle the `radius` and `gaps` layer rows separately from the generic `LAYER_CONFIG` loop — use `Switch` components with `checked`/`onCheckedChange`/`disabled` matching user's exact JSX pattern.
3. Gaps toggle: `disabled={!coverageRadius}` with `opacity-40` when disabled.
4. Helper text under gaps: "Coverage gaps are calculated from the active coverage radius."

### `src/components/map/MapView.tsx`
1. Add `coverageRadius` and `coverageGaps` boolean props.
2. Replace `layers.radius` with `coverageRadius` in the radius circles `useEffect`.
3. Replace `layers.gaps` with `coverageGaps` in the gap overlay `useEffect`.

