UPDATE public.data_sources
SET
  source_url = 'https://broadbandmap.fcc.gov/api/public/map',
  source_type = 'api',
  refresh_method = 'Server-side authenticated ingestion via edge function ingest-fcc-broadband (FCC BDC Public Data API: listAsOfDates -> downloads/listAvailabilityData/{as_of_date} -> downloads/downloadFile/availability/{file_id}); artifact used: Fixed Broadband Summary by Geography Type',
  refresh_cadence = 'Per FCC release (approximately semiannual as-of dates)',
  requires_credentials = true,
  credential_reference = 'FCC_BDC_API_USERNAME, FCC_BDC_API_HASH_VALUE (edge runtime secrets; values never stored in the database)',
  transformation_version = 'fcc-bdc-summary-county-v1',
  internalization_target = 'fully_internal',
  failure_impact = 'degraded',
  fallback_available = true,
  fallback_description = 'Previous normalized broadband_county_coverage dataset, then public/data/nevada_broadband.json. The application falls back automatically; a failed run never mutates the normalized table.',
  notes = 'Phase 2A.1: bound to the FCC BDC Public Data API. Speed-tier percentages are FCC-derived with satellite (technology codes 60/61) excluded and total_units (Broadband Serviceable Location units) as the denominator. The fiber/cable/fixed-wireless/satellite share values remain Rural Tool interpretation and are carried forward, not FCC measurements. Live ingestion is blocked until the two FCC credential secrets are configured; the run fails closed with failure_code fcc_credentials_missing.',
  updated_at = now()
WHERE source_key = 'fcc_broadband';