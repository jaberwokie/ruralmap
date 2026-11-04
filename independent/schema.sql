-- Winged Wolf independent edition: clean starting schema.
-- Apply ONLY to a newly provisioned empty Supabase project.
-- Do NOT run historical supabase/migrations from ruralmap against this project.
-- No data rows, NBH/SSHP membership, identities or claims are included.
BEGIN;

CREATE TABLE public.facilities (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('hospital', 'clinic')),
  classification text,
  data_confidence text,
  city text,
  county text NOT NULL,
  street_address text,
  state text NOT NULL DEFAULT 'NV',
  zip text,
  phone text,
  website text,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  notes text,
  service text,
  access_type text,
  psychiatric jsonb,
  inpatient jsonb,
  source_url text NOT NULL,
  source_license text NOT NULL,
  last_verified_at date,
  publication_status text NOT NULL DEFAULT 'pending'
    CHECK (publication_status IN ('pending','approved','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_facility_evidence
    CHECK (publication_status <> 'approved' OR
      (length(trim(source_url)) > 0 AND length(trim(source_license)) > 0 AND last_verified_at IS NOT NULL))
);

CREATE TABLE public.rural_services (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  county text NOT NULL,
  city text,
  street_address text,
  state text NOT NULL DEFAULT 'NV',
  zip text,
  phone text,
  website text,
  notes text,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  bh_category_mapped text,
  bh_entity_type text,
  bh_service_type text,
  service_tags text,
  source_url text NOT NULL,
  source_license text NOT NULL,
  last_verified_at date,
  publication_status text NOT NULL DEFAULT 'pending'
    CHECK (publication_status IN ('pending','approved','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_service_evidence
    CHECK (publication_status <> 'approved' OR
      (length(trim(source_url)) > 0 AND length(trim(source_license)) > 0 AND last_verified_at IS NOT NULL))
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rural_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rural_services FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.facilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rural_services FROM PUBLIC, anon, authenticated;

-- Only source-approved, published rows may be returned to the browser.
GRANT SELECT ON TABLE public.facilities TO anon, authenticated;
GRANT SELECT ON TABLE public.rural_services TO anon, authenticated;

CREATE POLICY independent_approved_facilities_read
  ON public.facilities FOR SELECT TO anon, authenticated
  USING (publication_status = 'approved');
CREATE POLICY independent_approved_rural_services_read
  ON public.rural_services FOR SELECT TO anon, authenticated
  USING (publication_status = 'approved');

-- No insert/update/delete policies or client grants. Approved ingestion must
-- use a separately reviewed, privileged, server-side workflow.
-- The admin interface inherited from ruralmap is intentionally NOT enabled here.

COMMIT;
