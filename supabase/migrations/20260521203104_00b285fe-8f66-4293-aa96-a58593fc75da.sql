ALTER TABLE public.facilities
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

ALTER TABLE public.staging_providers
  ADD COLUMN IF NOT EXISTS geocoded_lat double precision,
  ADD COLUMN IF NOT EXISTS geocoded_lng double precision,
  ADD COLUMN IF NOT EXISTS coordinate_source text,
  ADD COLUMN IF NOT EXISTS coordinate_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinate_confidence text,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_match_type text,
  ADD COLUMN IF NOT EXISTS last_geocoded_at timestamptz;