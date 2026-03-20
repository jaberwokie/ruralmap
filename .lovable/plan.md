
Goal: keep the current utilization-based Engagement Gap view, and add a second operational decision-support layer within that same feature so NBH can quickly see where the largest unengaged populations live and prioritize outreach.

1. Extend the engagement-gap data model
- Update `src/utils/utilizationAggregation.ts` to add a county engagement metrics pipeline based on:
  - `memberVolumeData` = Total Members
  - `engagedMemberVolumeData` = Engaged Members
  - `Unengaged Members = Total - Engaged`
  - `Engagement Rate = Engaged / Total`
- Limit ranking scope to mapped Nevada counties only.
- Add rank logic:
  - primary sort: highest unengaged members
  - secondary sort: lowest engagement rate
- Add flags:
  - `isTop5Unengaged`
  - `showBelow20PercentOnly`
- Keep the existing utilization-based tiering (`gap`, `watchlist`, `early-signal`) intact as a separate signal.

2. Add reusable selectors/helpers
- Create helpers such as:
  - `getCountyEngagementMetrics(county)`
  - `getCountyEngagementRankings()`
  - `getTopUnengagedCounties(limit = 5)`
  - `getFilteredEngagementPriorityCounties({ belowRateThreshold: 0.2 })`
- Use memoized maps so calculations stay lightweight and do not impact performance when the layer is off.

3. Refine the Engagement Gap map rendering
- In `src/components/map/MapView.tsx`, keep the current engagement-gap overlay behavior, but change styling so the new operational priority signal is visible when the layer is on.
- Use stronger red emphasis for counties with the largest unengaged populations, with the darkest/strongest treatment for top-ranked counties.
- Preserve clear distinction between:
  - existing utilization-based engagement warning logic
  - new member-based outreach priority intensity
- Keep this county-only and Nevada-only so the map remains operationally readable.

4. Add the new filter toggle
- Add a new sidebar control under the Engagement Gap section in `src/components/map/Sidebar.tsx`:
  - “Show only counties with Engagement Rate < 20%”
- This should only affect the engagement-priority rendering/filtering, not the rest of the map.
- Wire the state from `src/pages/Index.tsx` into `Sidebar` and `MapView`.

5. Upgrade the engagement-gap sidebar summary
- Expand the existing Engagement Gap section in `Sidebar.tsx` so it also shows:
  - Top 5 counties with largest unengaged populations
  - count of counties below 20% engagement
  - clear explanation that this is outreach/deployment prioritization
- Keep the current utilization-gap summary copy, but visually separate the new “population engagement priority” summary from the old tier summary.

6. Add county detail-panel metrics
- In `src/components/map/CoverageDetailPanel.tsx`, add an “Engagement Gap” or “Engagement Priority” card for county-based views.
- Include exactly:
  - Rank (`#1 highest gap`)
  - Total Members
  - Engaged Members
  - Unengaged Members
  - Engagement Rate
- Show a stronger alert style for Top 5 unengaged counties.
- Reuse the same card in all county interaction paths (`CountyContent`, `MemberVolumeContent`, `RuralServiceGroupContent`) to maintain panel parity.

7. Interaction behavior
- When a county is clicked from the engagement-gap layer, the detail panel should reflect the new ranking metrics immediately.
- If the `<20%` filter is active, counties outside the threshold should not be emphasized/rendered in the engagement-priority view.
- Do not add any extra visible public UI beyond the requested toggle and panel/map updates.

8. QA after implementation
- Verify sort order manually for several counties to confirm:
  - unengaged count drives ranking
  - engagement rate correctly breaks ties
- Verify Top 5 counties receive the strongest red treatment.
- Verify county details are identical whether opened from county boundary, member-volume, or rural-service interactions.
- Verify the `<20%` filter updates both map emphasis and sidebar summaries.
- Test end-to-end on desktop with the current viewport and confirm no regressions in the existing utilization-based engagement tiers.

Technical notes
- Best fit is to evolve `utilizationAggregation.ts` into a shared county intelligence module for both utilization and member-engagement metrics, rather than scattering logic across components.
- Current code already centralizes:
  - engagement-gap summaries in `Sidebar.tsx`
  - overlay rendering in `MapView.tsx`
  - county details in `CoverageDetailPanel.tsx`
  so this can be added cleanly without changing the app structure.
- Existing data already supports this directly:
  - `src/data/member-volume.ts`
  - `src/data/engaged-member-volume.ts`
- Out-of-state rows in the member baseline (`Mohave`, `Salt Lake`) should be excluded from the new ranking because you selected Nevada-only scope and the map only renders Nevada counties.
