

## Add help tooltip to "Tier 1 Providers" toggle

Reuse the existing sidebar help system (no new component needed). Other toggles already render a `?` icon via the `helpKey` prop on `renderLayerToggleRow`, which looks up an entry in `HELP_TOOLTIPS` and renders a `HelpCircle` button with a Popover. The Tier 1 row currently doesn't pass `helpKey`.

### Changes

1. `src/data/help-tooltips.ts`
   - Add a new entry:
     ```
     tier1Providers: {
       label: 'Tier 1 Providers',
       explanation: 'Top providers by Medicaid member visit volume.',
     }
     ```

2. `src/components/map/Sidebar.tsx` (Tier 1 row, ~line 1021)
   - Add `helpKey: 'tier1Providers'` to the `renderLayerToggleRow({...})` call for Tier 1 Providers.

That's it — the existing `renderHelpIcon` already provides:
- inline placement to the right of the label (before the Switch)
- `HelpCircle` icon at `w-3 h-3` with muted color and pointer cursor
- click/hover/keyboard-accessible Popover (works on desktop and mobile tap)
- `aria-label` and `aria-haspopup` already wired
- styling consistent with every other sidebar tooltip

### Validation

- "Tier 1 Providers" row shows a `?` icon between the label and the toggle switch.
- Hover/click/tap opens a popover with title "Tier 1 Providers" and body "Top providers by Medicaid member visit volume."
- Toggle behavior, layout, indentation, and dependency subtitle are unchanged.
- Keyboard focus + Enter/Space opens the tooltip.

