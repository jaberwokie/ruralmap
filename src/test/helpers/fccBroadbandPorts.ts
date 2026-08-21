/**
 * Test-side re-export of the Phase 2A.1 FCC acquisition/derivation/pipeline
 * modules. Keeps the edge-function path out of the application bundle while
 * letting vitest exercise the real logic.
 */
export * from '../../../supabase/functions/ingest-fcc-broadband/fccAcquisition';
export * from '../../../supabase/functions/ingest-fcc-broadband/fccDerivation';
export * from '../../../supabase/functions/ingest-fcc-broadband/fccPipeline';
export * from '../../../supabase/functions/ingest-fcc-broadband/failureCodes';
export * from '../../../supabase/functions/ingest-fcc-broadband/nevadaCounties';
