/**
 * Test-side re-export of the server ingestion pipeline plus the in-memory
 * state shape used by the harness. Keeps the edge-function path out of the
 * application bundle while letting vitest exercise the real orchestration.
 */
export {
  runBroadbandIngestion,
  SOURCE_KEY,
} from '../../../supabase/functions/ingest-fcc-broadband/pipeline';
export type {
  IngestionPorts,
  IngestionResult,
  FetchResult,
} from '../../../supabase/functions/ingest-fcc-broadband/pipeline';

export interface NormalizedShim {
  normalized: unknown[];
  runs: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  sourceHealth: Record<string, unknown>;
}
