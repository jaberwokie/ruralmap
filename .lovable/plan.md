

## Fix: Hope Floats Animal Foundation row collapses to vertical letters

**Root cause**
In the Local Resource Network drill-down list (`CoverageDetailPanel.tsx` lines 1303–1327), each row is a flex container with two columns:
- Left: name + city (`min-w-0 flex-1`, `overflowWrap: 'anywhere'`)
- Right: `ContactPhoneAction variant="inline"` with `whitespace-nowrap`

For Hope Floats Animal Foundation the `phone` field contains a **multi-number string** (`"775-482-4678 / 775-482-4699 / 775-2…"`). The inline phone link is `whitespace-nowrap` and `flex-shrink-0`, so the right column claims nearly all row width. The left column shrinks to ~1 character wide, and `overflowWrap: 'anywhere'` then wraps the name one letter per line.

This affects any resource whose `phone` field holds multiple numbers, not just Hope Floats.

**Fix scope** — `src/components/map/CoverageDetailPanel.tsx`, drill-down row only (~lines 1308–1324). No data changes, no map changes, no panel layout changes elsewhere.

**Changes**
1. Constrain the phone column so it cannot starve the name column:
   - Remove `flex-shrink-0` from the right wrapper; add `max-w-[45%]` and `min-w-0`.
2. Normalize multi-phone strings before passing to `ContactPhoneAction`:
   - If `service.phone` contains a separator (`/`, `;`, or `,`), use the first number as the call target and show a small `+N` indicator (e.g. `775-482-4678 +2`). The full original string remains in the `title` tooltip.
3. Floor the name column width so wrapping behaves normally:
   - Add `basis-0` and keep `min-w-0 flex-1`; soften `overflowWrap: 'anywhere'` to `'break-word'` so it only breaks truly unbreakable tokens, not normal names.

**Validation**
- Nye County → Family Services → Hope Floats Animal Foundation row: name renders on 1–2 normal lines, first phone number shown with `+2` indicator, tap-to-call still works.
- Other Family Services rows with single phone numbers render unchanged.
- No regression to category-list view, map pins, or county scoping.

