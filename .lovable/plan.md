# Plan — Preview Breakpoint Debug Badge

Scope: instrumentation only. No changes to responsive logic, breakpoints, `useIsMobile`, MobileEntry, map, or Decision Assist.

## 1. New component: `src/components/dev/ViewportDebugBadge.tsx`

A small fixed-position badge, bottom-right, `z-[9999]`, semi-transparent dark chip with mono text.

Displays live:
- `window.innerWidth` × `window.innerHeight` (updated on `resize`)
- Responsive mode derived from width:
  - `< 768` → `mobile`
  - `768–1279` → `tablet/laptop`
  - `≥ 1280` → `desktop`
- `useIsMobile()` boolean
- `MobileEntry mounted: yes/no` — read via a prop passed from `Index.tsx` (no global state, no context)

Gating (must satisfy ALL):
- `import.meta.env.DEV === true`, OR hostname matches `localhost` / `*.lovable.app` / `*.lovable.dev`
- Never renders when `import.meta.env.PROD` and hostname is the published custom domain (`ruralmap.lovable.app`, `ruralmap.opsframe.io`)

Implementation detail: a single `isPreviewEnvironment()` helper inside the component returns `false` for production hostnames. Returns `null` early when gated off so it tree-shakes cleanly at runtime.

## 2. Mount point: `src/pages/Index.tsx`

Add one import and one render line at the root of the returned tree, passing `mobileEntryMounted={isMobile}` (or whatever variable already controls MobileEntry rendering — read the file first to match the exact flag). No other Index.tsx changes.

## 3. Verification pass (manual, via browser tool)

Resize the sandbox to each width and screenshot the badge + layout:
- 375 (sanity mobile)
- 768, 820, 912, 1024, 1180 (tablet/laptop band)
- 1280, 1440 (desktop)

For each, record in the final chat reply:
- badge-reported `innerWidth`
- `useIsMobile()` value
- whether MobileEntry mounted
- which layout actually rendered

## 4. Lovable preview frame note

Compare the Lovable preview chrome width (reported as 768 in current `client_state`) against `window.innerWidth` at the same moment. If they diverge, document in the final reply that Lovable's preview frame is cosmetic only and real responsive validation requires browser devtools device emulation or a resized browser window.

## 5. Disposition of the badge

Keep the component checked in but **gated to dev/preview only** (per §1). Production builds on the custom domain will not render it. No removal step required; the gate is the ship-safe behavior the prompt asked for.

## Files touched
- `src/components/dev/ViewportDebugBadge.tsx` (new)
- `src/pages/Index.tsx` (1 import + 1 JSX line)

## Out of scope (unchanged)
Breakpoints, `useIsMobile`, MobileEntry layout, tablet/laptop layout, map logic, Decision Assist, routing, auth.
