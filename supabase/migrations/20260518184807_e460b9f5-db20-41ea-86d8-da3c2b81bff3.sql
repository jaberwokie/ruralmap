-- Tighten write access on previously-permissive mapping tables to admin only.
-- Authenticated reads stay open; only admins can insert/update going forward.

-- facilities
DROP POLICY IF EXISTS "Authenticated users can insert facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can update facilities" ON public.facilities;
CREATE POLICY "Admins can insert facilities"
  ON public.facilities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update facilities"
  ON public.facilities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- rural_services
DROP POLICY IF EXISTS "Authenticated users can insert rural_services" ON public.rural_services;
DROP POLICY IF EXISTS "Authenticated users can update rural_services" ON public.rural_services;
CREATE POLICY "Admins can insert rural_services"
  ON public.rural_services FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update rural_services"
  ON public.rural_services FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- staging_facilities
DROP POLICY IF EXISTS "Authenticated users can insert staging_facilities" ON public.staging_facilities;
DROP POLICY IF EXISTS "Authenticated users can update staging_facilities" ON public.staging_facilities;
CREATE POLICY "Admins can insert staging_facilities"
  ON public.staging_facilities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update staging_facilities"
  ON public.staging_facilities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- staging_rural_services
DROP POLICY IF EXISTS "Authenticated users can insert staging_rural_services" ON public.staging_rural_services;
DROP POLICY IF EXISTS "Authenticated users can update staging_rural_services" ON public.staging_rural_services;
CREATE POLICY "Admins can insert staging_rural_services"
  ON public.staging_rural_services FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update staging_rural_services"
  ON public.staging_rural_services FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));