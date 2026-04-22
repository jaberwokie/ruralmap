ALTER TABLE public.staging_services
  ADD COLUMN IF NOT EXISTS service_tags text,
  ADD COLUMN IF NOT EXISTS resource_class text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS mappable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS match_conflict boolean NOT NULL DEFAULT false;

ALTER TABLE public.verified_services
  ADD COLUMN IF NOT EXISTS service_tags text,
  ADD COLUMN IF NOT EXISTS resource_class text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS mappable boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_staging_services_match_conflict
  ON public.staging_services (match_conflict) WHERE match_conflict = true;

CREATE INDEX IF NOT EXISTS idx_verified_services_resource_class
  ON public.verified_services (resource_class);