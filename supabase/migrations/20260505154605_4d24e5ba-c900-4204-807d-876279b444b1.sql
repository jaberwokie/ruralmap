ALTER TABLE public.staging_bh ADD COLUMN IF NOT EXISTS service_tags text;
ALTER TABLE public.verified_bh ADD COLUMN IF NOT EXISTS service_tags text;