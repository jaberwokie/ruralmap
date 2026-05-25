
-- 1. Restrict mapping_audit_log SELECT to admins only (contains actor emails)
DROP POLICY IF EXISTS "auth read mapping_audit_log" ON public.mapping_audit_log;
CREATE POLICY "Admins can read mapping_audit_log"
  ON public.mapping_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict staging tables SELECT to admin/staff only
DROP POLICY IF EXISTS "auth read staging_bh" ON public.staging_bh;
CREATE POLICY "Admins and staff can read staging_bh"
  ON public.staging_bh FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "auth read staging_services" ON public.staging_services;
CREATE POLICY "Admins and staff can read staging_services"
  ON public.staging_services FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "auth read staging_providers" ON public.staging_providers;
CREATE POLICY "Admins and staff can read staging_providers"
  ON public.staging_providers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read staging_facilities" ON public.staging_facilities;
CREATE POLICY "Admins and staff can read staging_facilities"
  ON public.staging_facilities FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

DROP POLICY IF EXISTS "Authenticated users can read staging_rural_services" ON public.staging_rural_services;
CREATE POLICY "Admins and staff can read staging_rural_services"
  ON public.staging_rural_services FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- 3. Revoke EXECUTE on admin-only SECURITY DEFINER functions from anon/authenticated.
-- These functions perform their own admin check, but should not be callable by anon at all.
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_invite_user(text, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.active_admin_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;

-- handle_new_user is a trigger function and should never be called directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4. Fix mutable search_path on handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
