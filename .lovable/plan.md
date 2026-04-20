

## Center the "Manage Map Data | Sign Out" row

Currently the footer row in `src/components/map/Sidebar.tsx` (lines 689–714) uses `justify-between`, which pushes "Manage Map Data" to the far left and "Sign Out" to the far right of the sidebar. The user wants the pair centered as a single visual unit with the divider between them.

### Change

In `src/components/map/Sidebar.tsx`, update the footer row so the link, divider, and button form one centered group.

**Before (line 690):**
```tsx
<div className="mt-1.5 flex w-full items-center justify-between whitespace-nowrap text-muted-foreground/70">
```

**After:**
```tsx
<div className="mt-1.5 flex w-full items-center justify-center gap-2 whitespace-nowrap text-muted-foreground/70">
```

Then collapse the inner structure so all three elements (link, divider, button) are siblings of the centered flex container, removing the empty `<span />` fallback and the nested `flex items-center gap-2` wrapper:

```tsx
{isAdmin ? (
  <Link to="/admin/mapping" className="font-normal transition-colors hover:text-foreground" title="...">
    Manage Map Data
  </Link>
) : null}
{isAdmin && isAuthenticated ? (
  <span aria-hidden className="h-3 w-px bg-[#4a92c9]" />
) : null}
{isAuthenticated ? (
  <button type="button" onClick={() => { void signOut(); }} className="font-normal transition-colors hover:text-foreground" title={user?.email ?? undefined}>
    Sign Out
  </button>
) : null}
```

### Result

- Both labels and the divider sit centered as one group beneath the Admin badge.
- Divider remains visually balanced between the two items.
- Non-admin signed-in users see only "Sign Out" centered (no empty left slot pushing it off-center).
- No changes to typography, click behavior, mobile layout, or the Admin badge above.

### Validation

- Desktop, signed in as admin: "Manage Map Data | Sign Out" centered in the sidebar column.
- Desktop, signed in as non-admin: "Sign Out" centered alone.
- Signed out: row does not render (unchanged).
- Mobile: unchanged.

