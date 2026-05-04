ALTER TABLE public.staging_services
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS category_mapped text;

ALTER TABLE public.verified_services
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS category_mapped text;