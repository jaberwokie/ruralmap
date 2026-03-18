

## Plan: Link Service Locations toggle to Coverage Radius

When the **Service Locations** toggle is turned OFF, the **Coverage Radius** toggle should also be turned OFF automatically, since radius circles are meaningless without the underlying facilities.

### Changes

**`src/pages/Index.tsx`** — Update `handleToggleLayer`:
- When `serviceLocations` is toggled OFF, also set `coverageRadius` to `false`.
- Optionally, disable the Coverage Radius toggle in the sidebar when Service Locations is OFF.

**`src/components/map/Sidebar.tsx`** — Disable the Coverage Radius toggle when `layers.serviceLocations` is `false`, with reduced opacity to indicate it's unavailable.

