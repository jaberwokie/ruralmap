

## Fix Top 20 Providers as Exclusive Map Mode

### Problem
The current toggle handlers (`handleToggleLayer`, `handleCoverageRadiusChange`, `handleCoverageGapsChange`) don't check whether Top 20 mode is active. Users can turn on conflicting layers while in Top 20 mode, breaking the exclusive display intent.

### Changes (all in `src/pages/Index.tsx`)

**1. Remove snapshot/restore pattern**
The user explicitly wants "do not automatically restore prior toggle states" on OFF. Remove `topProvidersSnapshotRef` entirely. When Top 20 turns OFF, conflicting layers stay off until the user manually re-enables them.

**2. Define conflicting layers as a constant**
```typescript
const TOP20_CONFLICTING_LAYERS: (keyof LayerState)[] = [
  'services', 'behavioralHealth', 'operationalCoverage',
  'fteCapacity', 'utilizationIntensity', 'engagementGap'
];
```

**3. Simplify `handleTopProvidersOnlyChange`**
- ON: set all conflicting layers to `false`, set `coverageRadius` and `coverageGaps` to `false`, clear filters, keep `counties` and `serviceLocations` on.
- OFF: just set `topProvidersOnly = false`. Leave all other state as-is.

**4. Gate conflicting toggle handlers**
Modify `handleToggleLayer` so that if `topProvidersOnly` is active and the user turns ON a conflicting layer, it first sets `topProvidersOnly = false`, then applies the layer toggle. Non-conflicting layers pass through normally.

Same for `handleCoverageRadiusChange` and `handleCoverageGapsChange` — if enabling while Top 20 is on, turn Top 20 off first.

**5. No changes to**
- MapView rendering logic (it already respects `layers` state)
- Sidebar layout/styling
- Marker styling or Top 20 ranking logic
- Tutorial, zoom, county metrics

### Acceptance test coverage
- Turn on Service/BH/Coverage → Turn on Top 20 → all conflicting toggles go OFF in state, only Top 20 markers render
- While Top 20 active, turn on Coverage Radius → Top 20 turns OFF, Coverage Radius turns ON, normal rendering resumes

