
-- rural_services, verified_services, verified_bh (with manual_lat/lng)
ALTER TABLE public.rural_services
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS manual_lat double precision,
  ADD COLUMN IF NOT EXISTS manual_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

ALTER TABLE public.verified_services
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS manual_lat double precision,
  ADD COLUMN IF NOT EXISTS manual_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

ALTER TABLE public.verified_bh
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS manual_lat double precision,
  ADD COLUMN IF NOT EXISTS manual_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

-- staging tables (no manual_lat/lng)
ALTER TABLE public.staging_facilities
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

ALTER TABLE public.staging_rural_services
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

ALTER TABLE public.staging_services
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

ALTER TABLE public.staging_bh
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;

-- staging_providers (already has geocoded_lat/lng, coordinate_locked, etc.; IF NOT EXISTS is no-op for those)
ALTER TABLE public.staging_providers
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;
