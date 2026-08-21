UPDATE public.data_sources
SET
  source_name = 'FCC Broadband Data Collection — fixed availability (Nevada)',
  authority_name = 'Federal Communications Commission',
  source_url = 'https://broadbandmap.fcc.gov/api/public/map',
  source_type = 'api',
  refresh_method = 'Server-side authenticated acquisition via FCC BDC Public Data API (release discovery -> Nevada availability manifest -> file download). Edge function: ingest-fcc-broadband.',
  requires_credentials = true,
  credential_reference = 'FCC_BDC_API_USERNAME, FCC_BDC_API_HASH_VALUE (Supabase edge function secrets; names only)',
  fallback_available = true,
  fallback_description = 'public/data/nevada_broadband.json static 17-county dataset (unchanged; automatic fallback when the normalized table is empty or unusable).',
  notes = 'Phase 2A.1 evidence: https://broadbandmap.fcc.gov/api/public/map/listAsOfDates returns HTTP 401 {"status":"fail","status_code":401,"message":"Unauthorized"} without credentials, while an unknown route on the same API returns 405 "Method Not Available" — proving the documented routes exist and are credential-gated. Phase 1 metadata claiming no credentials were required is corrected. Provenance audit: docs/fcc-broadband-provenance.md. Current static values are editorial estimates (all four technology shares and all three speed tiers sum to exactly 100.0 in every county, which FCC availability data cannot produce); they are NOT attributable to any FCC release.',
  updated_at = now()
WHERE source_key = 'fcc_broadband';