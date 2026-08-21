CREATE TABLE public.data_source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  source_url text,
  http_status integer,
  content_type text,
  raw_payload jsonb NOT NULL,
  content_hash text NOT NULL,
  record_count integer,
  source_version text,
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_source_snapshots_source_retrieved
  ON public.data_source_snapshots (source_id, retrieved_at DESC);

GRANT SELECT, INSERT ON public.data_source_snapshots TO authenticated;
GRANT ALL ON public.data_source_snapshots TO service_role;

ALTER TABLE public.data_source_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_source_snapshots_select_ops_admin_sysop"
  ON public.data_source_snapshots FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ops'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "data_source_snapshots_insert_admin_sysop"
  ON public.data_source_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE TABLE public.broadband_county_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county_key text NOT NULL UNIQUE,
  county_name text NOT NULL,
  pct_100_20_plus double precision NOT NULL,
  pct_25_3_to_100_20 double precision NOT NULL,
  pct_below_25_3 double precision NOT NULL,
  fiber_share double precision NOT NULL,
  cable_share double precision NOT NULL,
  fixed_wireless_share double precision NOT NULL,
  satellite_share double precision NOT NULL,
  coverage_unevenness boolean NOT NULL DEFAULT false,
  notes text,
  source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE RESTRICT,
  snapshot_id uuid NOT NULL REFERENCES public.data_source_snapshots(id) ON DELETE RESTRICT,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  effective_date date,
  source_version text
);

CREATE INDEX idx_broadband_county_coverage_snapshot
  ON public.broadband_county_coverage (snapshot_id);

GRANT SELECT ON public.broadband_county_coverage TO anon;
GRANT SELECT ON public.broadband_county_coverage TO authenticated;
GRANT ALL ON public.broadband_county_coverage TO service_role;

ALTER TABLE public.broadband_county_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadband_county_coverage_select_public"
  ON public.broadband_county_coverage FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.replace_broadband_county_coverage(
  _source_id uuid,
  _snapshot_id uuid,
  _rows jsonb,
  _effective_date date DEFAULT NULL,
  _source_version text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _inserted integer;
BEGIN
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'replace_broadband_county_coverage: refusing to replace with an empty dataset';
  END IF;

  DELETE FROM public.broadband_county_coverage;

  INSERT INTO public.broadband_county_coverage (
    county_key, county_name,
    pct_100_20_plus, pct_25_3_to_100_20, pct_below_25_3,
    fiber_share, cable_share, fixed_wireless_share, satellite_share,
    coverage_unevenness, notes,
    source_id, snapshot_id, ingested_at, effective_date, source_version
  )
  SELECT
    r.county_key, r.county_name,
    r.pct_100_20_plus, r.pct_25_3_to_100_20, r.pct_below_25_3,
    r.fiber_share, r.cable_share, r.fixed_wireless_share, r.satellite_share,
    COALESCE(r.coverage_unevenness, false), r.notes,
    _source_id, _snapshot_id, now(), _effective_date, _source_version
  FROM jsonb_to_recordset(_rows) AS r(
    county_key text, county_name text,
    pct_100_20_plus double precision, pct_25_3_to_100_20 double precision, pct_below_25_3 double precision,
    fiber_share double precision, cable_share double precision,
    fixed_wireless_share double precision, satellite_share double precision,
    coverage_unevenness boolean, notes text
  );

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_broadband_county_coverage(uuid, uuid, jsonb, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_broadband_county_coverage(uuid, uuid, jsonb, date, text) FROM anon;
REVOKE ALL ON FUNCTION public.replace_broadband_county_coverage(uuid, uuid, jsonb, date, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_broadband_county_coverage(uuid, uuid, jsonb, date, text) TO service_role;