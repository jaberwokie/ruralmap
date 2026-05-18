## Finding

You are on `/admin/mapping/facilities`, which renders `src/pages/AdminMappingFacilities.tsx`.

That page currently passes no-op callbacks into `PipelineWorkspace`:

```tsx
onPromote={async () => {}}
onReject={async () => {}}
```

So the button click is reaching `PipelineWorkspace.wrap()` — confirmed by the console logs — but it resolves immediately because the Facility Mapping page is not bound to any promote/reject store function.

## Plan

1. Update `src/pages/AdminMappingFacilities.tsx` only.
2. Import the facility staging actions already available in `mappingPipelineStore`:
   - `promoteStagingFacility`
   - `rejectStagingFacility`
3. Replace the no-op `onPromote` with:
   - call `promoteStagingFacility(id)`
   - show success toast
   - refresh the Facility Mapping rows
   - catch and toast errors
4. Replace the no-op `onReject` with:
   - call `rejectStagingFacility(id)`
   - show success toast
   - refresh the Facility Mapping rows
   - catch and toast errors
5. Leave the existing instrumentation in place unless you want it removed in the same pass.

## Expected result

- Clicking Promote in Facility Mapping will actually call the store function.
- The staging row should move out of the pending queue after promotion.
- Success/failure feedback will be visible through toast messages.
- Reject will mark the row rejected and remove it from the pending queue.

## Validation

- Verify TypeScript via the project’s normal check pipeline.
- Use the existing `[PROMOTE-DEBUG]` console logs to confirm the click path now reaches the page/store handler instead of only `wrap()`.