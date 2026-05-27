## NovumHealth Branding — Mobile Header

### Goal
Restructure the `MobileEntry.tsx` header to lead with the NovumHealth brand identity and retitle the surface.

### What changes
**File: `src/components/mobile/MobileEntry.tsx`**

1. **Import the logo**: Add an import for `src/assets/novumhealth-logo.svg` (Vite handles SVG imports as static assets).

2. **Restructure the `<header>` block** (lines 133–145):
   - Replace the current `<h1>` text "Nevada Rural Access Operations" with the NovumHealth SVG logo rendered at `~24–28px` height via an `<img>` tag.
   - Move "Nevada Rural Access Operations" down to a subtitle `<p>` line beneath the logo (replacing the current "Nevada Behavioral Health" text).
   - Remove the standalone "Nevada Behavioral Health" line.
   - Keep the `isPublicSafeModeActive()` badge in the same position and with the same styling.
   - Maintain existing `bg-card`, `px-4`, `pt-2`, `pb-2` classes — no padding or layout changes outside the title swap.

### What stays exactly the same
- All sections below the header (input column, context banner, Decision Assist, collapsible map).
- Desktop/laptop layout in `Index.tsx`.
- Map logic, routing, Decision Assist derivation, county selection, geocoding, layer visibility, responsive breakpoints.

### Out of scope
- Desktop header / `Sidebar.tsx` branding (ask if you want that aligned too).
- Favicon or `index.html` metadata changes.
- Any other pages or components.
