## Findings

I curled the published host directly. Status:

```
/share              → 200, but body is the SPA index.html (root canonical)
/share/             → 200, SPA index.html (root canonical)
/share.html         → 200, RAW static file with correct /share canonical ✓
/share/index.html   → 200, RAW static file with correct /share canonical ✓
```

The 404 you saw in Safari is React's `NotFound` page — the SPA loaded, but `App.tsx` has no `<Route path="/share">`, so React Router fell through to `*`. That's why the page looks like a blank 404 instead of a download or hosting error.

**Root cause:** Lovable's static host applies SPA fallback to extensionless paths (`/share`, `/share/`) **before** resolving the static file at `dist/share/index.html`. Only paths with a file extension (`/share.html`) bypass the SPA fallback and serve the raw static file. This is hosting behavior — not fixable from app code without runtime JS (which you've forbidden) or a hosting plugin (also forbidden).

## Decision required

Given the constraints (raw HTML only, no runtime JS, no React Helmet, no Vite plugin), the share URL **must include the `.html` extension** to be served as raw HTML on Lovable's host. The clean target is:

```
https://ruralmap.opsframe.io/share.html
```

This is the URL you submit to LinkedIn. The bare `/share` path cannot deliver raw per-route metadata under the stated constraints.

## Plan

### 1. Make `/share.html` self-canonical

Currently `public/share.html` declares its canonical as `/share`. LinkedIn requires Fetched URL == Canonical URL. Update the three URL tags so LinkedIn's check passes when you submit `/share.html`:

```
<link rel="canonical" href="https://ruralmap.opsframe.io/share.html" />
<meta property="og:url" content="https://ruralmap.opsframe.io/share.html" />
<meta name="twitter:url" content="https://ruralmap.opsframe.io/share.html" />
```

All other metadata (title, description, og:image, twitter:image, twitter:card) stays exactly as it is. No design or copy changes.

### 2. Stop emitting the unreachable `/share` directory file

Delete `public/share/index.html`. It was an attempt to serve `/share` via directory index, which Lovable's host doesn't honor. Removing it eliminates the inconsistency where `/share/index.html` advertises a different canonical than `/share.html`.

### 3. Make bare `/share` redirect to `/share.html` for humans

Right now anyone typing `https://ruralmap.opsframe.io/share` sees React's 404 page. Add a one-line redirect inside `App.tsx`:

```tsx
<Route path="/share" element={<Navigate to="/share.html" replace />} />
```

`Navigate` is already imported. This is a routing one-liner — it does not touch React components, app logic, overlays, state, Supabase, the map, or any operational behavior. It only prevents the 404 page when a human types `/share` directly. Crawlers don't execute this; they read `/share.html` directly.

If you'd rather keep `App.tsx` untouched, skip step 3 and accept that bare `/share` shows the React 404 page. LinkedIn scraping is unaffected either way — that flow runs entirely against `/share.html`.

## Verification after publish

1. `curl -sI https://ruralmap.opsframe.io/share.html` → `200`, `Content-Type: text/html`
2. `curl -s https://ruralmap.opsframe.io/share.html | grep canonical` → `<link rel="canonical" href="https://ruralmap.opsframe.io/share.html" />`
3. LinkedIn Post Inspector on `https://ruralmap.opsframe.io/share.html`: Fetched URL == Canonical URL == `/share.html`
4. (If step 3 is included) `https://ruralmap.opsframe.io/share` redirects in-browser to `/share.html` and renders correctly
5. `/`, `/platform`, `/briefing` unchanged

## Files affected

- `public/share.html` — canonical/og:url/twitter:url switched from `/share` to `/share.html`
- `public/share/index.html` — deleted (unreachable, conflicting canonical)
- `src/App.tsx` — one-line redirect route added (optional; skip if you want zero app code changes)

## What I will NOT touch

Routing config beyond the optional one-line redirect, hosting, Vite config, OG image, copy, React components, app logic, Supabase, overlays, map, state, runtime metadata mutation, React Helmet.
