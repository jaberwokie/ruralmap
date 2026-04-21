-- ============================================================
-- Service Mapping + Behavioral Health Mapping pipelines
-- ============================================================

-- ---------- staging_services ----------
CREATE TABLE public.staging_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_category text,
  service_subcategory text,
  organization_name text,
  description text,
  target_population text,
  eligibility_notes text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  email text,
  referral_required boolean,
  walk_in_allowed boolean,
  appointment_required boolean,
  hours_of_operation text,
  languages_supported text,
  active_status boolean NOT NULL DEFAULT true,
  access_notes text,
  transportation_notes text,
  medicaid_relevance text,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_confidence text,
  verification_source text,
  verification_date date,
  last_reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending',
  validation_severity text,
  validation_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_file_name text,
  source_row_number integer,
  import_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_services_batch ON public.staging_services(import_batch_id);
CREATE INDEX idx_staging_services_review ON public.staging_services(review_status);
CREATE INDEX idx_staging_services_county ON public.staging_services(county);

-- ---------- verified_services ----------
CREATE TABLE public.verified_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id uuid,
  name text NOT NULL,
  service_category text,
  service_subcategory text,
  organization_name text,
  description text,
  target_population text,
  eligibility_notes text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  email text,
  referral_required boolean,
  walk_in_allowed boolean,
  appointment_required boolean,
  hours_of_operation text,
  languages_supported text,
  active_status boolean NOT NULL DEFAULT true,
  access_notes text,
  transportation_notes text,
  medicaid_relevance text,
  verification_status text NOT NULL DEFAULT 'verified',
  verification_confidence text,
  verification_source text,
  verification_date date,
  last_reviewed_at timestamptz,
  source_file_name text,
  source_row_number integer,
  import_batch_id uuid,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  promoted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verified_services_active ON public.verified_services(active_status);
CREATE INDEX idx_verified_services_county ON public.verified_services(county);
CREATE INDEX idx_verified_services_verification ON public.verified_services(verification_status);

-- ---------- staging_bh ----------
CREATE TABLE public.staging_bh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bh_entity_type text,
  bh_service_type text,
  organization_name text,
  facility_type text,
  description text,
  npi text,
  license_type text,
  specialties text,
  age_groups_served text,
  populations_served text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  fax text,
  referral_required boolean,
  walk_in_allowed boolean,
  appointment_required boolean,
  accepts_new_patients boolean,
  telehealth_available boolean,
  hours_of_operation text,
  languages_supported text,
  medicaid_participation_status text,
  payer_notes text,
  crisis_capable boolean,
  detox_capable boolean,
  residential_capable boolean,
  outpatient_capable boolean,
  mat_capable boolean,
  active_status boolean NOT NULL DEFAULT true,
  access_notes text,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_confidence text,
  verification_source text,
  verification_date date,
  last_reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending',
  validation_severity text,
  validation_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_file_name text,
  source_row_number integer,
  import_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_bh_batch ON public.staging_bh(import_batch_id);
CREATE INDEX idx_staging_bh_review ON public.staging_bh(review_status);
CREATE INDEX idx_staging_bh_county ON public.staging_bh(county);

-- ---------- verified_bh ----------
CREATE TABLE public.verified_bh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id uuid,
  name text NOT NULL,
  bh_entity_type text,
  bh_service_type text,
  organization_name text,
  facility_type text,
  description text,
  npi text,
  license_type text,
  specialties text,
  age_groups_served text,
  populations_served text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  fax text,
  referral_required boolean,
  walk_in_allowed boolean,
  appointment_required boolean,
  accepts_new_patients boolean,
  telehealth_available boolean,
  hours_of_operation text,
  languages_supported text,
  medicaid_participation_status text,
  payer_notes text,
  crisis_capable boolean,
  detox_capable boolean,
  residential_capable boolean,
  outpatient_capable boolean,
  mat_capable boolean,
  active_status boolean NOT NULL DEFAULT true,
  access_notes text,
  verification_status text NOT NULL DEFAULT 'verified',
  verification_confidence text,
  verification_source text,
  verification_date date,
  last_reviewed_at timestamptz,
  source_file_name text,
  source_row_number integer,
  import_batch_id uuid,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  promoted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verified_bh_active ON public.verified_bh(active_status);
CREATE INDEX idx_verified_bh_county ON public.verified_bh(county);
CREATE INDEX idx_verified_bh_verification ON public.verified_bh(verification_status);

-- ---------- mapping_audit_log ----------
CREATE TABLE public.mapping_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  action text NOT NULL,
  target_table text,
  target_row_id uuid,
  import_batch_id uuid,
  actor_id uuid,
  actor_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mapping_audit_pipeline ON public.mapping_audit_log(pipeline);
CREATE INDEX idx_mapping_audit_created ON public.mapping_audit_log(created_at DESC);
CREATE INDEX idx_mapping_audit_batch ON public.mapping_audit_log(import_batch_id);

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_staging_services_updated_at
  BEFORE UPDATE ON public.staging_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_verified_services_updated_at
  BEFORE UPDATE ON public.verified_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_staging_bh_updated_at
  BEFORE UPDATE ON public.staging_bh
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_verified_bh_updated_at
  BEFORE UPDATE ON public.verified_bh
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS: admin write, authenticated read, anon denied
-- ============================================================

ALTER TABLE public.staging_services   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_bh         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_bh        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_audit_log  ENABLE ROW LEVEL SECURITY;

-- staging_services
CREATE POLICY "auth read staging_services" ON public.staging_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert staging_services" ON public.staging_services
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update staging_services" ON public.staging_services
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete staging_services" ON public.staging_services
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- verified_services
CREATE POLICY "auth read verified_services" ON public.verified_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert verified_services" ON public.verified_services
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update verified_services" ON public.verified_services
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete verified_services" ON public.verified_services
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- staging_bh
CREATE POLICY "auth read staging_bh" ON public.staging_bh
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert staging_bh" ON public.staging_bh
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update staging_bh" ON public.staging_bh
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete staging_bh" ON public.staging_bh
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- verified_bh
CREATE POLICY "auth read verified_bh" ON public.verified_bh
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert verified_bh" ON public.verified_bh
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update verified_bh" ON public.verified_bh
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete verified_bh" ON public.verified_bh
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- mapping_audit_log
CREATE POLICY "auth read mapping_audit_log" ON public.mapping_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert mapping_audit_log" ON public.mapping_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update mapping_audit_log" ON public.mapping_audit_log
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete mapping_audit_log" ON public.mapping_audit_log
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));