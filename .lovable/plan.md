## Root cause

`public/share.html` redirects to `/?public=1`, but `usePublicSafeMode` activates **only** when `window.location.pathname === '/public'` (or `/public/*`). Query strings are ignored. So `/share.html` → `/?public=1` lands on the **unprotected** root environment, exposing SilverSummit's gap data and every other suppressed surface (utilization rankings, member counts, verification queue, etc.).

The protective layer (`PUBLIC_SAFE_MODE`) is correctly wired to the `/public` route — that route still exists in `App.tsx` (line 69) and Lovable's SPA fallback serves `index.html` at `/public` with a 200. The `/public` route was never the broken piece; only the earlier attempt to override its **raw HTML metadata** was. Hosting serves `/public` fine for human visitors — it just can't deliver per-route raw `<head>` to crawlers.

## Plan

### 1. Point the share redirect at the protected route

In `public/share.html`, change all three redirect references from `/?public=1` to `/public`:

- `<meta http-equiv="refresh" content="0; url=/public" />`
- `window.location.replace("/public");`
- `<a href="/public">Continue to the application</a>`

This is the entire fix. After redirect, `usePublicSafeMode().isPublicSafe` returns true, and every component already gated on it (Sidebar counts, county panel member volumes, utilization rankings, top providers, verification queue, BuildFingerprint, etc.) hides as designed.

### 2. Nothing else changes

- Raw `/share.html` HTML stays exactly as-is (canonical/og:url/twitter:url all `/share.html`, title, description, og:image unchanged).
- `/share` SPA redirect to `/share.html` stays.
- `/public` route, App.tsx, hooks, components, Supabase, RLS, map, overlays — untouched.

## Verification after publish

1. `curl https://ruralmap.opsframe.io/share.html | grep redirect` → confirms target is `/public`, not `/?public=1`.
2. Visit `https://ruralmap.opsframe.io/share.html` in a browser → lands on `/public` with safe mode active.
3. Spot-check on `/public`: no member counts, no SilverSummit gap data, no utilization rankings, no admin/build fingerprint, no internal terminology — everything `usePublicSafeMode` already suppresses.
4. LinkedIn Post Inspector on `/share.html` still reads correct canonical/OG (raw HTML unchanged).
5. `/`, `/platform`, `/briefing`, `/admin/*` unchanged.

## Files affected

- `public/share.html` — three redirect targets switched from `/?public=1` to `/public`. No other change.

## What this does NOT do

This change alone routes humans to the protected presentation. If `/public` itself is currently leaking data the user doesn't expect to be public (i.e., a gap exists in the suppression rules in `usePublicSafeMode` consumers), that's a separate audit — flag specific surfaces and I'll patch each consumer. But if "SilverSummit gap data" was visible because the user landed on root `/` instead of `/public`, this redirect fix resolves it.
