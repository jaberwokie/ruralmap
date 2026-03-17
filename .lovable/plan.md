

## Plan: Add Coverage Gaps Explanation

Add a small info/help description below the Coverage Gaps layer toggle that explains what it does, similar to how the radius layer shows a slider when active.

**Changes:**

1. **`src/components/map/Sidebar.tsx`** — When the `gaps` layer is toggled on, render an explanatory note beneath its toggle row (same pattern as the radius slider). The text will explain: "Counties highlighted in red have no hospital within the current coverage radius. Adjust the radius slider to change the threshold."

This keeps the UI consistent with the existing radius-slider pattern and gives users immediate context for what the red highlights mean.

