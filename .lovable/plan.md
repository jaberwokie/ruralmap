

## Admin-only build/version label — final plan

Approved as previously scoped, with the mobile refinement below.

### Files

**1. `vite.config.ts`** — bake build metadata at build time:
```ts
define: {
  __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? ''),
}
```

**2. `src/vite-env.d.ts`** — declare globals:
```ts
declare const __APP_BUILD_TIME__: string;
declare const __APP_VERSION__: string;
```

**3. `src/components/AdminVersionBadge.tsx`** (new)
- `usePermissions()` → if `!isAdmin` return `null` (no DOM node).
- Format: `v{version} • {YYYY-MM-DD}` if version set, else `build {YYYY-MM-DD}`.
- Styling: `text-[10px] text-muted-foreground tabular-nums leading-none`.
- Accept optional `className` prop so each placement controls its own layout.

**4. `src/components/map/Sidebar.tsx`** (desktop)
- Insert `<AdminVersionBadge className="mt-1 block text-center" />` directly under the title/description in the existing logo header block. Single line of 10px text inside an already-centered flex column — no layout shift.

**5. `src/pages/Index.tsx`** (mobile header refinement)
- Mobile bar today: left = title block, right = Filters/Map button.
- Place the badge **inside the left title block**, on its own line under the "Nevada Behavioral Health" subtitle — NOT in the right-side cluster next to the button.
- Class: `hidden xs:block` is not needed; instead use `truncate max-w-[55vw]` on the wrapper and `text-[9px]` on mobile to guarantee it cannot push the Filters/Map button.
- Filters/Map button keeps its current `p-2` tap target and right-edge alignment. Badge wraps/truncates within the title column if space is tight; it never sits on the same row as the button.
- For non-admins the component returns `null`, so zero footprint.

### Gating guarantees

- `isAdmin` from `usePermissions()` (server-derived via `current_user_role()` against `user_roles`).
- Component early-returns `null` before rendering any element — not hidden via CSS, not in DOM.
- During auth-loading window, `isAdmin === false`, so no flash for non-admins.

### Validation after build

1. Admin desktop → badge visible in sidebar title block, centered, subtle.
2. Admin mobile (≤768px) → badge appears under "Nevada Behavioral Health" subtitle in the left column; Filters/Map button position and tap area unchanged.
3. Staff/viewer/logged-out → inspect DOM, confirm no version node anywhere.
4. Resize sweep (320, 375, 414, 768, 1024, 1302) → Filters/Map button stays right-aligned and fully tappable at every width.
5. `VITE_APP_VERSION` unset → renders `build YYYY-MM-DD`; set → renders `v{x} • YYYY-MM-DD`.

### Out of scope

- No new dependencies.
- No git hash injection.
- No tooltip, no interaction.
- No changes to map, sidebar logic, or auth.

