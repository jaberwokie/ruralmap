ALTER TABLE public.data_source_snapshots
  ALTER COLUMN raw_payload DROP NOT NULL,
  ALTER COLUMN raw_payload SET DEFAULT '{}'::jsonb;

ALTER TABLE public.data_source_snapshots
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS source_file_name text,
  ADD COLUMN IF NOT EXISTS source_file_id text,
  ADD COLUMN IF NOT EXISTS byte_size bigint,
  ADD COLUMN IF NOT EXISTS source_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acquisition_protocol jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transformation_version text;

COMMENT ON COLUMN public.data_source_snapshots.source_artifacts IS
  'Per-artifact provenance: sha256 of the exact retrieved bytes, storage path, upstream file identifier. Never credentials.';

ALTER TABLE public.data_source_snapshots
  ADD CONSTRAINT data_source_snapshots_evidence_present
  CHECK (
    raw_payload IS NOT NULL
    OR storage_path IS NOT NULL
    OR jsonb_array_length(source_artifacts) > 0
  );

ALTER TABLE public.data_source_runs
  ADD COLUMN IF NOT EXISTS failure_code text;

COMMENT ON COLUMN public.data_source_runs.failure_code IS
  'Machine-readable failure taxonomy (e.g. fcc_credentials_missing, fcc_manifest_failed). NULL on success.';