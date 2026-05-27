# Responsive Layout Plan — Mobile, Laptop, Desktop

Scope: layout/presentation only. No changes to data, coverage tier logic, Decision Assist derivation, or map behavior.

## 1. Mobile (<768px) — input-first

Replace today's mobile chrome (header + Controls/Operations toggle + map+sidebar split) with a single-column, input-first surface implemented as a new component `src/components/mobile/MobileEntry.tsx`, rendered by `Index.tsx` when `useIsMobile()` returns true and **before** any address/county has been selected.

Layout, top to bottom:

1. Minimal header — "Nevada Rural Access Operations" title, NBH subtitle. No nav, no menu button.
2. Single-line instruction: "Enter member address to begin".
3. Address input (full width) — reuses the existing `useMemberAccess` hook (`geocodeAddress` / `placeMember`) so geocoding, county resolution, and the existing `address_searched` county-only event remain identical.
4. County selector fallback — full-width `<select>` populated from `nevada-counties` data; selecting one calls the existing `selection.actions.selectCounty(...)`.
5. CTA button: "Get Access Pathway" — triggers address geocode if input has text, otherwise applies the selected county.

After submission:

- Decision Assist result renders below the input, **full width, stacked**, by reusing `deriveDecisionAssist` + `DecisionAssistResult` directly (no drawer chrome — drawer stays desktop-only per its existing `isMobile` guard).
- Below the result: a collapsed toggle "View Coverage Map" that, when tapped, mounts the existing `MapView` + `CoverageDetailPanel` inline at ~50vh, centered on the resolved county via `focusBounds`.
- A "Start over" link clears the member pin and county selection and returns to the input view.

The existing mobile sidebar/Controls toggle, the `md:hidden` header block, and the `mobileSidebarOpen` flow are **removed** on <768px. Desktop and laptop paths are untouched.

### County tier rendering on mobile

The choropleth lives in `src/components/map/layers/` (county polygon fill). Verify by:
- Running the preview at 402px width after a county is selected.
- Inspecting that the county GeoJSON pane is not clipped by a parent `overflow-hidden` with 0 height, and that the map container has an explicit `h-[50vh]` (or computed pixel height) when expanded — Leaflet renders blank when its container has 0 height at init.
- If blank, call `map.invalidateSize()` on the expand transition (same pattern already used in `toggleDesktopSidebar`).

## 2. Laptop (768–1279px)

In `Index.tsx`:
- Sidebar width: already 320px when expanded — confirm and keep. No change needed if already 320.
- Add a Tailwind clamp so the sidebar does not grow on this range and the map fills remaining width with `flex-1 min-w-0` (already present; verify no `min-w` regression).
- Scale down panel/county-detail text one step within `lg:` breakpoint: in `CoverageDetailPanel.tsx` add `text-[11px] lg:text-xs xl:text-sm` style adjustments on the top-level wrapper class set (single-line CSS change, no structural edits).
- `DecisionAssistDrawer` already uses `right-[17.5rem]` to clear the 16rem details panel — verify it doesn't overflow at 1024px. If it does, switch to `right-[calc(16rem+0.75rem)]` (no visual change, just safer math).

## 3. Desktop (≥1280px)

No changes.

## 4. Regression checks

After implementation, manually verify in preview at 402px, 1024px, 1440px:
- Nye County address (northern + southern) returns the correct Decision Assist tier — unchanged because derivation logic is untouched.
- County fill colors visible on mobile after county selection or address entry.
- Map never renders as a blank white box at any breakpoint.

## Files

**New**
- `src/components/mobile/MobileEntry.tsx`

**Edited**
- `src/pages/Index.tsx` — mount `<MobileEntry>` when `isMobileLayout` and no address/county yet; keep existing desktop/laptop tree otherwise.
- `src/components/map/CoverageDetailPanel.tsx` — one wrapper class change for laptop font scaling.
- `src/components/map/decision-assist/DecisionAssistDrawer.tsx` — only if 1024px overflow is observed.
- `CONTEXT.md` — add a short "Responsive layout" section noting the mobile input-first surface and laptop sizing.

## Out of scope

- No changes to filters, layer logic, coverage radius, Decision Assist taxonomy/derivation, metrics events, or auth.
- Mobile Decision Assist reuses the existing derive function; the desktop drawer's `isMobile` guard stays.
