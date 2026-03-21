
Goal

Make the tutorial prompt appear reliably again, and change completion behavior so skipping does not suppress future prompts.

What’s happening now

- `src/pages/Index.tsx` opens the intro only when `localStorage.getItem(MAP_TUTORIAL_STORAGE_KEY) !== 'true'`.
- The current skip wiring marks the tutorial as complete:
  - intro skip uses `onSkip={() => closeTutorial(true)}`
  - walkthrough skip also uses `closeTutorial(true)`
- Result: if the tutorial was ever skipped or finished in this browser, the prompt will not appear again.
- There is also no versioning/reset path for older stored values, so prior behavior keeps blocking the prompt.

Plan

1. Replace the boolean completion model with explicit tutorial status
- In `src/data/map-tutorial.ts`, add a small storage model:
  - version constant
  - statuses like `completed` and `dismissed`/`seen` only if needed
- Keep the stored value simple and stable so it can be checked safely from `Index.tsx`.

2. Change prompt logic so only Finish counts as complete
- In `src/pages/Index.tsx`:
  - only write completion state when the user reaches Finish
  - do not write completion state when the user skips from intro or walkthrough
- Keep skip as a close action only.

3. Re-show the tutorial for users affected by the old behavior
- Add a versioned storage key or versioned payload so old `true` values do not permanently suppress the prompt.
- On load:
  - if current version is not marked `completed`, open the intro
  - this cleanly resets browsers that were marked complete by the old skip behavior

4. Keep replay behavior unchanged
- The sidebar replay control should still open the walkthrough directly.
- Replay should not overwrite completion unless the user actually finishes.

5. Preserve current overlay and positioning work
- No changes to the portal, spotlight, sizing, or clipping fix in `MapTutorialOverlay.tsx`
- This is a state/trigger fix, not a layout rewrite

Likely file changes

- `src/data/map-tutorial.ts`
  - add tutorial storage version/status helpers
- `src/pages/Index.tsx`
  - replace the current boolean localStorage check
  - change skip vs finish behavior
  - wire Finish to mark complete, Skip to close only

Acceptance criteria

- On a browser without a current completed tutorial state, the intro prompt appears on page load
- Clicking Skip closes the tutorial but does not prevent it from appearing next visit
- Clicking Finish prevents it from auto-opening again
- Older browsers previously suppressed by the old skip logic are prompted again once under the new versioned state
- Replay from the sidebar still works
