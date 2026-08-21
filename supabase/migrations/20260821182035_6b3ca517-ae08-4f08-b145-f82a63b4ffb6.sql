-- ============================================================
-- Source Registry (Phase 1 of the self-reliance architecture)
-- Governance metadata only. No application rendering depends on it.
-- ============================================================

CREATE TABLE public.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_name text NOT NULL,
  source_category text NOT NULL DEFAULT 'other'
    CHECK (source_category IN ('provider','service','behavioral_health','geographic','connectivity','transportation','tribal','payer','utilization','staffing','geocoding','mapping','platform','other')),
  authority_name text,
  source_url text,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('api','public_endpoint','web_page','csv','json','geojson','spreadsheet','database','static_code','manual','service')),
  data_classification text NOT NULL DEFAULT 'internal'
    CHECK (data_classification IN ('public','internal','sensitive_internal')),
  runtime_dependency boolean NOT NULL DEFAULT false,
  internalization_target text NOT NULL DEFAULT 'undecided'
    CHECK (internalization_target IN ('remain_external','cache_internal','ingest_internal','fully_internal','undecided')),
  refresh_method text,
  refresh_cadence text,
  effective_date date,
  last_retrieved_at timestamptz,
  last_verified_at timestamptz,
  next_review_at timestamptz,
  last_successful_ingestion_at timestamptz,
  last_failed_ingestion_at timestamptz,
  last_record_count integer,
  source_version text,
  content_hash text,
  transformation_version text,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('current','due_for_review','stale','failing','disabled','unknown')),
  stale_after_days integer CHECK (stale_after_days IS NULL OR stale_after_days > 0),
  is_stale boolean NOT NULL DEFAULT false,
  is_public_safe boolean NOT NULL DEFAULT false,
  requires_credentials boolean NOT NULL DEFAULT false,
  -- Logical reference ONLY (e.g. 'GOOGLE_GEOCODING_API_KEY'). Never a secret value.
  credential_reference text,
  failure_impact text
    CHECK (failure_impact IS NULL OR failure_impact IN ('none','cosmetic','degraded','feature_unavailable','app_breaking')),
  fallback_available boolean NOT NULL DEFAULT false,
  fallback_description text,
  owner_role text CHECK (owner_role IS NULL OR owner_role IN ('viewer','staff','ops','admin','sysop')),
  owner_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.data_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  run_type text NOT NULL
    CHECK (run_type IN ('retrieve','import','validate','normalize','ingest','verify','manual_review')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','success','partial','failed','skipped')),
  records_received integer,
  records_accepted integer,
  records_rejected integer,
  records_created integer,
  records_updated integer,
  records_unchanged integer,
  error_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  content_hash text,
  source_version text,
  transformation_version text,
  error_summary text,
  run_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_source_runs_source_started ON public.data_source_runs (source_id, started_at DESC);

-- Data API grants. No anon access at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources TO authenticated;
GRANT ALL ON public.data_sources TO service_role;
GRANT SELECT, INSERT ON public.data_source_runs TO authenticated;
GRANT ALL ON public.data_source_runs TO service_role;

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_source_runs ENABLE ROW LEVEL SECURITY;

-- data_sources: ops read-only; admin/sysop read-write.
CREATE POLICY "data_sources_select_ops_admin_sysop"
  ON public.data_sources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ops'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "data_sources_insert_admin_sysop"
  ON public.data_sources FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "data_sources_update_admin_sysop"
  ON public.data_sources FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "data_sources_delete_admin_sysop"
  ON public.data_sources FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

-- data_source_runs: append-only. Ops read-only; admin/sysop read + append.
CREATE POLICY "data_source_runs_select_ops_admin_sysop"
  ON public.data_source_runs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ops'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "data_source_runs_insert_admin_sysop"
  ON public.data_source_runs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE TRIGGER data_sources_set_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Seed: only what repository evidence supports.
-- Unknown provenance fields are left NULL so they surface as gaps.
-- ============================================================
INSERT INTO public.data_sources
  (source_key, source_name, source_category, authority_name, source_url, source_type,
   data_classification, runtime_dependency, internalization_target, refresh_method,
   effective_date, source_version, status, is_public_safe, requires_credentials,
   credential_reference, failure_impact, fallback_available, fallback_description, notes)
VALUES
  ('carto_basemap','CARTO light_all basemap tiles','mapping','CARTO','https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png','service',
   'public', true, 'remain_external', NULL, NULL, NULL, 'unknown', true, false,
   NULL, 'app_breaking', false, NULL,
   'Evidence: src/components/map/MapView.tsx L1232 L.tileLayer(...). Runtime tile dependency; no fallback basemap configured.'),

  ('osm_nominatim','OpenStreetMap Nominatim geocoding','geocoding','OpenStreetMap Foundation','https://nominatim.openstreetmap.org/search','public_endpoint',
   'public', true, 'remain_external', NULL, NULL, NULL, 'unknown', true, false,
   NULL, 'feature_unavailable', true, 'Census Geocoder proxy is attempted when Nominatim returns no usable match.',
   'Evidence: src/hooks/useMemberAccess.ts L242/L310/L328, src/utils/serviceGeocode.ts L58-59, supabase/functions/geocode-bulk/index.ts L9. Used for member address placement and service geocoding.'),

  ('census_geocoder','U.S. Census Geocoder (onelineaddress)','geocoding','U.S. Census Bureau','https://geocoding.geo.census.gov/geocoder/locations/onelineaddress','public_endpoint',
   'public', true, 'remain_external', NULL, NULL, NULL, 'unknown', true, false,
   NULL, 'degraded', true, 'Secondary geocoder behind Nominatim; failure degrades match rate only.',
   'Evidence: supabase/functions/census-geocode/index.ts L3, supabase/functions/geocode-bulk/index.ts L10, src/utils/serviceGeocode.ts. Called through an edge-function proxy from the client.'),

  ('google_geocoding','Google Geocoding API','geocoding','Google','https://maps.googleapis.com/maps/api/geocode/json','api',
   'public', false, 'remain_external', NULL, NULL, NULL, 'unknown', false, true,
   'GOOGLE_GEOCODING_API_KEY', 'feature_unavailable', true, 'Admin-only geocode workflows; map rendering uses stored coordinates.',
   'Evidence: supabase/functions/geocode-address/index.ts L9 and L54. Admin/sysop-gated edge function. Credential reference only — key value is never stored here.'),

  ('fcc_broadband','FCC-derived Nevada county broadband coverage','connectivity','Federal Communications Commission',NULL,'json',
   'public', true, 'ingest_internal', 'Manual replacement of public/data/nevada_broadband.json', NULL, NULL, 'unknown', true, false,
   NULL, 'degraded', true, 'Broadband layer degrades to unavailable; rest of the map is unaffected.',
   'Evidence: src/data/broadband-coverage.ts L127 fetch(''/data/nevada_broadband.json''), public/data/nevada_broadband.json. Effective date not recorded in repository.'),

  ('fcc_cellular','FCC BDC Nevada mobile availability (4G LTE / 5G-NR)','connectivity','Federal Communications Commission',NULL,'static_code',
   'public', false, 'ingest_internal', 'Manual replacement of src/data/cellular-coverage.ts', NULL, 'J25 31mar2026', 'unknown', true, false,
   NULL, 'degraded', false, NULL,
   'Evidence: src/data/cellular-coverage.ts header + per-row dataSource "FCC BDC Nevada mobile availability geometry (4G LTE and 5G-NR, J25 31mar2026)". County-level only; no carrier breakdown.'),

  ('nv_tribal_directory','Nevada tribal nation directory','tribal',NULL,NULL,'static_code',
   'public', false, 'ingest_internal', 'Manual edit of src/data/tribal-nations.ts', NULL, NULL, 'unknown', true, false,
   NULL, 'degraded', false, NULL,
   'Evidence: src/data/tribal-nations.ts — 28 nation entries with individual outbound URLs. No single authority or retrieval date documented in the repository.'),

  ('tribal_boundaries_geojson','Tribal nation boundary geometry','tribal',NULL,NULL,'geojson',
   'public', true, 'ingest_internal', 'Manual replacement of public/data/tribal_nations_boundaries.json', NULL, NULL, 'unknown', true, false,
   NULL, 'degraded', true, 'Tribal boundary layer silently omits geometry when the fetch fails.',
   'Evidence: src/data/tribal-nations.ts L739 fetch(''/data/tribal_nations_boundaries.json''). Source authority and vintage not documented.'),

  ('ndot_public_transit','NDOT Public Transit / Mobility Managers','transportation','Nevada Department of Transportation','https://www.dot.nv.gov/mobility/transit','web_page',
   'public', false, 'ingest_internal', 'Manual edit of src/data/mobility-managers.ts', NULL, NULL, 'unknown', true, false,
   NULL, 'cosmetic', false, NULL,
   'Evidence: src/data/mobility-managers.ts header "Source: NDOT Public Transit (https://www.dot.nv.gov/mobility/transit)". Contextual only — never rendered as pins.'),

  ('local_transit_zones','Local transit zone geometry (approximate)','transportation',NULL,NULL,'static_code',
   'internal', false, 'ingest_internal', 'Manual edit of src/data/local-transit-zones.ts', NULL, NULL, 'unknown', true, false,
   NULL, 'cosmetic', false, NULL,
   'Evidence: src/data/local-transit-zones.ts header — polygons are explicitly documented as conservative approximations, not authoritative service areas.'),

  ('passenger_rail_zephyr','California Zephyr passenger rail corridor','transportation',NULL,NULL,'static_code',
   'public', false, 'cache_internal', 'Manual edit of src/data/rail-corridors.ts', NULL, NULL, 'unknown', true, false,
   NULL, 'cosmetic', false, NULL,
   'Evidence: src/data/rail-corridors.ts header. Simplified waypoints; additive overlay only.'),

  ('rural_resource_directory','Rural Nevada resource directory (enriched rural services)','service',NULL,NULL,'static_code',
   'internal', true, 'fully_internal', 'Supabase rural_services table with static fallback', NULL, NULL, 'unknown', true, false,
   NULL, 'degraded', true, 'src/data/enriched-rural-services.ts is used when the database returns no rows.',
   'Evidence: src/hooks/useRuralServiceData.ts (DB first, static fallback), src/data/enriched-rural-services.ts. Original directory provenance not documented in the repository.'),

  ('sshp_payer_pathways','SilverSummit rural catchments payer-pathway overlay','payer',NULL,NULL,'static_code',
   'internal', false, 'ingest_internal', 'Manual edit of src/data/sshpCatchments.ts', NULL, NULL, 'unknown', false, false,
   NULL, 'cosmetic', false, NULL,
   'Evidence: src/data/sshpCatchments.ts header — strictly additive/informational, explicitly non-scoring. Must stay non-scoring.'),

  ('provider_utilization','Provider utilization / claims-derived rankings','utilization',NULL,NULL,'static_code',
   'sensitive_internal', false, 'ingest_internal', 'Manual edit of src/data/provider-utilization.ts', NULL, NULL, 'unknown', false, false,
   NULL, 'degraded', false, NULL,
   'Evidence: src/data/provider-utilization.ts — named providers with member and visit counts. Claims-derived; suppressed in Public Safe Mode.'),

  ('utilization_json_datasets','County / ZIP / tribal utilization datasets','utilization',NULL,NULL,'json',
   'sensitive_internal', true, 'ingest_internal', 'Manual replacement of public/data/utilization/*.json', NULL, NULL, 'unknown', false, false,
   NULL, 'degraded', true, 'Utilization panels are display-only and lazy-loaded; failure hides those panels.',
   'Evidence: src/data/utilization.ts L26 BASE=''/data/utilization'' + L269 fetch, public/data/utilization/{county_gap_summary,zip_member_demand,zip_provider_rollup,tribal_provider_summary}.json.'),

  ('fte_staffing_capacity','FTE / staffing capacity model','staffing',NULL,NULL,'static_code',
   'internal', false, 'ingest_internal', 'Manual edit of src/data/fte-capacity.ts', NULL, NULL, 'unknown', false, false,
   NULL, 'degraded', false, NULL,
   'Evidence: src/data/fte-capacity.ts header states baseline capacity and current load are placeholder values to be replaced with real data.'),

  ('member_volume','County member and engaged-member volume','utilization',NULL,NULL,'static_code',
   'sensitive_internal', false, 'ingest_internal', 'Manual edit of src/data/member-volume.ts and engaged-member-volume.ts', NULL, NULL, 'unknown', false, false,
   NULL, 'degraded', false, NULL,
   'Evidence: src/data/member-volume.ts, src/data/engaged-member-volume.ts. No effective date or extract identifier in the repository. Suppressed in Public Safe Mode.'),

  ('census_county_boundaries','Nevada county and state boundary geometry','geographic','U.S. Census Bureau',NULL,'static_code',
   'public', true, 'cache_internal', 'Manual edit of src/data/nevada-counties.ts', NULL, NULL, 'unknown', true, false,
   NULL, 'app_breaking', false, NULL,
   'Evidence: src/data/nevada-counties.ts L1 comment "real GeoJSON from US Census FIPS dataset"; src/data/nevada-boundary.ts. Vintage/year not recorded.'),

  ('lovable_cloud_backend','Application backend (Postgres, auth, edge functions)','platform',NULL,NULL,'database',
   'sensitive_internal', true, 'remain_external', NULL, NULL, NULL, 'unknown', false, true,
   'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY', 'app_breaking', true, 'Static datasets under src/data provide degraded read-only map rendering when the backend is unreachable.',
   'Evidence: src/integrations/supabase/client.ts, all hooks under src/hooks, supabase/functions/*. Auth, roles, verified records, metrics and audit all depend on it.')
ON CONFLICT (source_key) DO NOTHING;