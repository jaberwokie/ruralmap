

## Fix: Utilization Metrics card missing from most county detail views

### Problem

The `UtilizationMetricsCard` component exists and works, but it's only rendered inside `CountyContent` — the view triggered by clicking a county polygon directly. The two more common county-level views are missing it:

- **MemberVolumeContent** (triggered by clicking the member volume choropleth)
- **RuralServiceGroupContent** (triggered by clicking a rural service cluster)

Since most users interact with the map via the choropleth or service markers rather than raw county boundaries, the card effectively never appears.

### Fix

Add `<UtilizationMetricsCard county={county} />` to both `MemberVolumeContent` and `RuralServiceGroupContent`, placed after their existing `UtilizationEngagementSection` (or after the coverage/engagement content if that section isn't present).

### File Changes

**`src/components/map/CoverageDetailPanel.tsx`**:
1. **MemberVolumeContent** (~line 1164): Add `<UtilizationMetricsCard county={county} />` after the `<UtilizationEngagementSection>` call
2. **RuralServiceGroupContent** (~line 1189): Add `<UtilizationEngagementSection county={county} />` and `<UtilizationMetricsCard county={county} />` after the `MemberVolumeSection` block (before the service count display)

Two single-line additions. No new dependencies, no changes to existing logic.

