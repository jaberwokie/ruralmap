
Goal: make Behavioral Health visible as a true first-class category. Right now it is missing because the codebase has not actually implemented that feature yet.

What I found
- The current map still has only 3 point categories in code:
  - Provider Locations
  - Service Presence
  - County Boundaries
- There are no Behavioral Health tokens or marker definitions in the repo right now.
- `MapView.tsx` renders all `ruralServices` as the same green `servicePresence` marker.
- The Type filter only has `hospital`, `clinic`, and `service`.
- Sidebar legend/toggles still show only Service Presence + Provider Locations.
- Help text and tutorial are still on the older 3-color model.
- So your report is correct: Behavioral Health is currently neither added to the UI nor separated on the map.

Plan to implement
1. Add Behavioral Health classification layer
- Create a small utility that classifies `ruralServices` into:
  - general Service
  - Behavioral Health
- Use explicit source-based rules from the existing data:
  - `Mental Health`
  - `Substance Use`
- Keep the remaining rural service categories as green Service.

2. Extend the shared visual system
- Add a purple Behavioral Health color token to the existing design token system.
- Extend `pinVisuals.ts` so shared marker visuals support:
  - hospital = red
  - clinic = blue
  - service = green
  - behavioral health = purple
- Keep shape language consistent across sidebar, legend, map, and grouped states.

3. Update sidebar controls
- In Core Map, add a distinct Behavioral Health row/toggle alongside:
  - Provider Locations
  - Service Presence / Service
  - Behavioral Health
- Update the Type filter chips to:
  - Hospital
  - Clinic
  - Service
  - Behavioral Health
- Make each chip filter only its own category.

4. Update map rendering logic
- Split current `filteredRuralServices` into two filtered sets:
  - community services
  - behavioral health services
- Render community services in green.
- Render behavioral health in purple.
- Ensure the existing layer behavior remains intact:
  - Provider Locations toggle still gates hospitals/clinics
  - Service toggle still gates green services
  - Behavioral Health toggle gates purple BH points

5. Preserve grouped/cluster meaning
- Update cluster composition logic so purple BH markers are represented distinctly in mixed groups.
- Prevent clusters from collapsing BH back into generic green service semantics.
- Keep hover/selected emphasis while preserving base category identity.

6. Update legend, help, and tutorial
- Inline legend becomes:
  - County Boundaries
  - Service (green)
  - Behavioral Health (purple)
  - Provider Locations → Hospital (red) + Clinic (blue)
- Update help tooltip copy so Service and Behavioral Health are clearly separated.
- Update tutorial text and likely bump tutorial storage version so returning users see the new 4-color explanation.

7. Fix the related sidebar popover warning
- There is also a current runtime warning in `HelpIconTooltip` about refs with the popover trigger/content path.
- I would clean that up during this pass so the updated help UI stays stable while adding the new Behavioral Health explanations.

Files likely involved
- `src/components/map/MapView.tsx`
- `src/components/map/Sidebar.tsx`
- `src/pages/Index.tsx`
- `src/components/map/pinVisuals.ts`
- `src/data/help-tooltips.ts`
- `src/data/map-tutorial.ts`
- `src/index.css`
- `tailwind.config.ts`
- new utility such as `src/utils/ruralServiceClassification.ts`

QA checklist
- Behavioral Health appears as purple on the map.
- Behavioral Health has its own sidebar toggle.
- Behavioral Health has its own Type chip.
- Green Service no longer includes purple Behavioral Health visually.
- Mixed filter combinations work correctly.
- Legend exactly matches live markers.
- Grouped/clustered states still preserve category meaning.
- Tutorial/help text matches the final 4-color system.

Technical note
The main reason you cannot see Behavioral Health now is not a small bug; it is that the current code still routes all rural-service points through one green “service presence” pathway and has no BH-specific token, filter, legend entry, or render branch yet.
