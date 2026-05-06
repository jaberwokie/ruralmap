# Pre-Publish Smoke Test Checklist

## Member Address / Pin

- [ ] Member address search places pin
- [ ] Member pin can be dragged
- [ ] Dragging member pin does not refit or reset the map
- [ ] Member distance badges update after drag

## Map Pins

- [ ] Provider pins visible
- [ ] Behavioral Health pins visible
- [ ] Service pins visible
- [ ] Cluster stacks visible
- [ ] Spiderfy works on clustered stacks
- [ ] Marker click opens correct detail panel

## County Interaction

- [ ] County hover works
- [ ] County click opens county detail
- [ ] County detail panel does not overlap or shift unpredictably

## Access Gaps / Coverage

- [ ] Access gaps align with active provider radii
- [ ] Access gaps respect active layer toggles
- [ ] Provider radius rings remain clipped to Nevada boundary
- [ ] Behavioral Health coverage behaves according to active BH layer state

## FTE Coverage

- [ ] FTE hubs render
- [ ] FTE field zones render
- [ ] FTE response strain line still appears
- [ ] Remote/scheduled/field coverage classifications still make operational sense
- [ ] Toggle Response Capability OFF and confirm planned/scheduled/remote response-capability county pins disappear
- [ ] Toggle Response Capability ON and confirm they return

## Modes

- [ ] Public safe mode hides protected metrics/counts/admin-only controls
- [ ] Presentation mode behavior is unchanged
- [ ] Map Explainer still behaves correctly in public mode

## Search / Navigation

- [ ] Sidebar search opens results
- [ ] Clicking a result navigates to the correct map item
- [ ] Filters do not clear member pin unintentionally

## Final Checks

- [ ] No new TypeScript errors
- [ ] No new lint errors in touched files
- [ ] No unexpected console errors
- [ ] Manual smoke test completed before publish
