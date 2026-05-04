ALTER TABLE public.staging_bh
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS category_mapped text;

ALTER TABLE public.verified_bh
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS category_mapped text;