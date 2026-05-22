
# Rename plan — Nye → Structured/Resolved Import

Scope: identifiers, comments, and UI strings only. No logic changes. The DB value `'nye_ingestion_v5'` is preserved.

## Identifier renames (apply repo-wide in the listed files)

- `nyeMode` → `resolvedImportMode`
- `pendingNye` / `setPendingNye` → `pendingResolvedImport` / `setPendingResolvedImport`
- `PendingNyeImport` → `PendingResolvedImport`
- `NYE_SCHEMA_VERSION` → `RESOLVED_SCHEMA_VERSION` (value `'nye_ingestion_v5'` unchanged)

## File-by-file changes

### `src/utils/mappingPipelineStore.ts`
- L8–9: comment "Nye ingestion v5: every audit entry…" → "Structured Import: every audit entry…"
- L35: `const NYE_SCHEMA_VERSION` → `const RESOLVED_SCHEMA_VERSION`
- L83: comment "tagged with the Nye v5 schema version" → "tagged with the Structured Import schema version"
- L84: `nyeMode?: boolean` → `resolvedImportMode?: boolean`
- L87: `meta.nyeMode` → `meta.resolvedImportMode`; `NYE_SCHEMA_VERSION` → `RESOLVED_SCHEMA_VERSION`
- L142: comment "Called by the Nye-mode upload" → "Called by the Structured Import upload"
- L157: `NYE_SCHEMA_VERSION` → `RESOLVED_SCHEMA_VERSION`
- L404: comment "Controlled upsert (Nye ingestion v5)…" → "Controlled upsert (Structured Import)…"
- L488: `NYE_SCHEMA_VERSION` → `RESOLVED_SCHEMA_VERSION`
- L519: `nyeMode: true` → `resolvedImportMode: true`
- L532: `NYE_SCHEMA_VERSION` → `RESOLVED_SCHEMA_VERSION`
- L547: `nyeMode: true` → `resolvedImportMode: true`

### `src/utils/mappingPipelineCsv.ts`
- L187: comment "Resolver-driven service row mapper (Nye ingestion v5 path)." → "Resolver-driven service row mapper (Structured Import path)."
- L296: comment "If a resolver result is supplied (Nye v5 path)…" → "If a resolver result is supplied (Structured Import path)…"

### `src/utils/serviceHeaderResolver.ts`
- L2: comment "Header Resolution + Import Gate (Nye ingestion v5)." → "Header Resolution + Import Gate (Structured Import)."

### `src/utils/serviceUpsertMatch.ts`
- L2: comment "Controlled upsert matching for the Nye ingestion pipeline (v5)." → "Controlled upsert matching for the Structured Import pipeline."

### `src/utils/serviceNormalize.ts`
- L2: comment "Normalization helpers for the Nye rural ingestion pipeline (v5)." → "Normalization helpers for the Structured Import pipeline."

### `src/types/mappingPipeline.ts`
- L56: comment "// Nye ingestion v5 additions" → "// Structured Import additions"

### `src/hooks/useLiveVerifiedRecords.ts`
- L84: comment "// Nye v5: respect explicit mappable=false…" → "// Structured Import: respect explicit mappable=false…"

### `src/pages/AdminMappingServices.tsx`
- L7: comment "Nye Mode (CSV or XLSX): pre-stage header resolution gate, then" → "Structured Import (CSV or XLSX): pre-stage header resolution gate, then"
- L77: string "Nye Mode: headers resolved via alias map…" → "Structured Import: headers resolved via alias map…"
- L78: string "Nye Mode: rows without location AND contact data…" → "Structured Import: rows without location AND contact data…"
- L126: `interface PendingNyeImport` → `interface PendingResolvedImport`
- L140: `const [nyeMode, setNyeMode] = useState(true);` → `const [resolvedImportMode, setResolvedImportMode] = useState(true);`
- L141: `const [pendingNye, setPendingNye] = useState<PendingNyeImport | null>(null);` → `const [pendingResolvedImport, setPendingResolvedImport] = useState<PendingResolvedImport | null>(null);`
- L179: `if (!nyeMode)` → `if (!resolvedImportMode)`
- L190: comment "Nye v5 path: resolve headers…" → "Structured Import path: resolve headers…"
- L195, L201: `setPendingNye(...)` → `setPendingResolvedImport(...)`
- L459: JSX text "Nye Mode: header resolution gate, controlled upsert, normalization. Default: legacy CSV mapper." → "Structured Import: header resolution gate, controlled upsert, normalization. Default: legacy CSV mapper."
- L463: `variant={nyeMode ? 'default' : 'outline'}` → `variant={resolvedImportMode ? 'default' : 'outline'}`
- L465: `onClick={() => setNyeMode(true)}` → `onClick={() => setResolvedImportMode(true)}`
- L466: button label "Nye Mode (CSV / XLSX)" → "Structured Import (CSV / XLSX)"
- L468: `variant={!nyeMode ? 'default' : 'outline'}` → `variant={!resolvedImportMode ? 'default' : 'outline'}`
- L470: `onClick={() => setNyeMode(false)}` → `onClick={() => setResolvedImportMode(false)}`
- L476, L480, L486, L490, L493, L495, L496, L500, L508, L509, L511, L513, L517, L526: `pendingNye` → `pendingResolvedImport`; `setPendingNye` → `setPendingResolvedImport`

## Intentionally NOT changed

- Database value `'nye_ingestion_v5'` at `mappingPipelineStore.ts:35` (RHS of the constant) — preserved per instructions.
- All occurrences of "Nye" referring to Nye County (data files, county strings, tests, geographic comments) — these are unrelated geographic references.
- "Default (CSV)" button label (not a Nye reference).

## Confirmation requested

Reply to confirm and I will switch to build mode and apply the edits exactly as listed.
