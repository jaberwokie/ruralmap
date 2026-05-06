
CREATE TABLE public.staging_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type text,
  provider_name text,
  npi text,
  organization_name text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  notes text,
  access_notes text,
  review_status text NOT NULL DEFAULT 'pending',
  validation_severity text,
  validation_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_status boolean NOT NULL DEFAULT true,
  source_file_name text,
  source_row_number integer,
  import_batch_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.staging_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read staging_providers"
  ON public.staging_providers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin insert staging_providers"
  ON public.staging_providers FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin update staging_providers"
  ON public.staging_providers FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin delete staging_providers"
  ON public.staging_providers FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_updated_at_staging_providers
  BEFORE UPDATE ON public.staging_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
