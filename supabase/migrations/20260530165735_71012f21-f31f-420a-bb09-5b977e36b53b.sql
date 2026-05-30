
-- =========================================================================
-- PART A: Soft-delete columns on all 7 affected tables
-- =========================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'facilities','rural_services','verified_bh','verified_services',
    'staging_bh','staging_services','staging_providers'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_reason TEXT DEFAULT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NOT NULL',
                   t || '_deleted_at_idx', t);
  END LOOP;
END $$;

-- =========================================================================
-- PART B: Update RLS — hide soft-deleted from non-sysop; sysop sees all
-- =========================================================================

-- facilities
DROP POLICY IF EXISTS "Authenticated users can read facilities" ON public.facilities;
CREATE POLICY "Authenticated users can read facilities" ON public.facilities
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role));
DROP POLICY IF EXISTS "sysop manage facilities" ON public.facilities;
CREATE POLICY "sysop manage facilities" ON public.facilities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- rural_services
DROP POLICY IF EXISTS "Authenticated users can read rural_services" ON public.rural_services;
CREATE POLICY "Authenticated users can read rural_services" ON public.rural_services
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role));
DROP POLICY IF EXISTS "sysop manage rural_services" ON public.rural_services;
CREATE POLICY "sysop manage rural_services" ON public.rural_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- verified_bh
DROP POLICY IF EXISTS "auth read verified_bh" ON public.verified_bh;
CREATE POLICY "auth read verified_bh" ON public.verified_bh
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role));
DROP POLICY IF EXISTS "anon read active verified_bh" ON public.verified_bh;
CREATE POLICY "anon read active verified_bh" ON public.verified_bh
  FOR SELECT TO anon
  USING (active_status = true AND deleted_at IS NULL);
DROP POLICY IF EXISTS "sysop manage verified_bh" ON public.verified_bh;
CREATE POLICY "sysop manage verified_bh" ON public.verified_bh
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- verified_services
DROP POLICY IF EXISTS "auth read verified_services" ON public.verified_services;
CREATE POLICY "auth read verified_services" ON public.verified_services
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role));
DROP POLICY IF EXISTS "anon read active verified_services" ON public.verified_services;
CREATE POLICY "anon read active verified_services" ON public.verified_services
  FOR SELECT TO anon
  USING (active_status = true AND deleted_at IS NULL);
DROP POLICY IF EXISTS "sysop manage verified_services" ON public.verified_services;
CREATE POLICY "sysop manage verified_services" ON public.verified_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- staging_bh
DROP POLICY IF EXISTS "Admins and staff can read staging_bh" ON public.staging_bh;
CREATE POLICY "Admins and staff can read staging_bh" ON public.staging_bh
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role))
    AND (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role))
  );
DROP POLICY IF EXISTS "sysop manage staging_bh" ON public.staging_bh;
CREATE POLICY "sysop manage staging_bh" ON public.staging_bh
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- staging_services
DROP POLICY IF EXISTS "Admins and staff can read staging_services" ON public.staging_services;
CREATE POLICY "Admins and staff can read staging_services" ON public.staging_services
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role))
    AND (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role))
  );
DROP POLICY IF EXISTS "sysop manage staging_services" ON public.staging_services;
CREATE POLICY "sysop manage staging_services" ON public.staging_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- staging_providers
DROP POLICY IF EXISTS "Admins and staff can read staging_providers" ON public.staging_providers;
CREATE POLICY "Admins and staff can read staging_providers" ON public.staging_providers
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'staff'::public.app_role))
    AND (deleted_at IS NULL OR public.has_role(auth.uid(),'sysop'::public.app_role))
  );
DROP POLICY IF EXISTS "sysop manage staging_providers" ON public.staging_providers;
CREATE POLICY "sysop manage staging_providers" ON public.staging_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sysop'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'sysop'::public.app_role));

-- =========================================================================
-- PART C: handle_new_user — auto-assign sysop to hardcoded emails
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(new.email, ''));
  _pending_role public.app_role;
  _initial_role public.app_role := 'viewer';
BEGIN
  IF _email IN ('mcloutier@nvbhs.com', 'mcloutier@protonmail.com') THEN
    _initial_role := 'sysop';
  ELSIF _email <> '' THEN
    SELECT role INTO _pending_role
    FROM public.pending_admin_emails
    WHERE lower(email) = _email
    LIMIT 1;

    IF found THEN
      _initial_role := _pending_role;
      DELETE FROM public.pending_admin_emails WHERE lower(email) = _email;
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (new.id, _initial_role, true)
  ON CONFLICT (user_id) DO UPDATE
    SET role = excluded.role,
        is_active = true,
        updated_at = now();

  RETURN new;
END;
$function$;

-- Promote any existing matching users to sysop if they're already signed up.
UPDATE public.user_roles ur
SET role = 'sysop', is_active = true, updated_at = now()
FROM auth.users u
WHERE ur.user_id = u.id
  AND lower(u.email) IN ('mcloutier@nvbhs.com','mcloutier@protonmail.com')
  AND ur.role <> 'sysop';

-- Create user_roles rows for those emails if missing.
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT u.id, 'sysop'::public.app_role, true
FROM auth.users u
WHERE lower(u.email) IN ('mcloutier@nvbhs.com','mcloutier@protonmail.com')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);

-- =========================================================================
-- PART D: Admin RPCs — refuse to assign/modify sysop; hide from list
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _was_admin boolean;
  _target_role public.app_role;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _role NOT IN ('viewer','staff','ops','admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF _user_id = _caller THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _user_id;
  IF _target_role = 'sysop' THEN
    RAISE EXCEPTION 'Cannot modify sysop accounts';
  END IF;

  SELECT (role = 'admin' AND is_active = true)
  INTO _was_admin
  FROM public.user_roles WHERE user_id = _user_id;

  IF COALESCE(_was_admin, false) AND _role <> 'admin' AND public.active_admin_count() <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active, updated_by)
  VALUES (_user_id, _role, true, _caller)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        updated_by = _caller,
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(_user_id uuid, _is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _is_admin_target boolean;
  _target_role public.app_role;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF _user_id = _caller THEN
    RAISE EXCEPTION 'You cannot change your own active status';
  END IF;

  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _user_id;
  IF _target_role = 'sysop' THEN
    RAISE EXCEPTION 'Cannot modify sysop accounts';
  END IF;

  IF _is_active = false THEN
    SELECT (role = 'admin' AND is_active = true)
    INTO _is_admin_target
    FROM public.user_roles WHERE user_id = _user_id;

    IF COALESCE(_is_admin_target, false) AND public.active_admin_count() <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active admin';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active, updated_by)
  VALUES (_user_id, 'viewer', _is_active, _caller)
  ON CONFLICT (user_id) DO UPDATE
    SET is_active = _is_active,
        updated_by = _caller,
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, role app_role, is_active boolean, created_at timestamp with time zone, role_updated_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    COALESCE(ur.role, 'viewer'::public.app_role) AS role,
    COALESCE(ur.is_active, false) AS is_active,
    u.created_at,
    ur.updated_at AS role_updated_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE COALESCE(ur.role, 'viewer'::public.app_role) <> 'sysop'
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_invite_user(_email text, _role app_role DEFAULT 'viewer'::app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can invite users';
  END IF;

  IF _role = 'sysop' THEN
    RAISE EXCEPTION 'Cannot invite users as sysop';
  END IF;

  INSERT INTO public.pending_admin_emails (email, role)
  VALUES (lower(trim(_email)), _role)
  ON CONFLICT (email) DO UPDATE SET role = excluded.role;
END;
$function$;

-- =========================================================================
-- PART E: SysOp RPCs — list + restore soft-deleted records
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sysop_list_deleted()
RETURNS TABLE(
  source_table text,
  record_id text,
  record_name text,
  deleted_at timestamptz,
  deleted_by text,
  deleted_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'sysop'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT 'facilities'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.facilities WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'rural_services'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.rural_services WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'verified_bh'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.verified_bh WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'verified_services'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.verified_services WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'staging_bh'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.staging_bh WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'staging_services'::text, id::text, name, deleted_at, deleted_by, deleted_reason
      FROM public.staging_services WHERE deleted_at IS NOT NULL
    UNION ALL
    SELECT 'staging_providers'::text, id::text, COALESCE(name, provider_name), deleted_at, deleted_by, deleted_reason
      FROM public.staging_providers WHERE deleted_at IS NOT NULL
    ORDER BY 4 DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sysop_restore_record(_table text, _id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _caller_email text;
  _affected int;
BEGIN
  IF NOT public.has_role(_caller, 'sysop'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _table NOT IN (
    'facilities','rural_services','verified_bh','verified_services',
    'staging_bh','staging_services','staging_providers'
  ) THEN
    RAISE EXCEPTION 'invalid table';
  END IF;

  SELECT email INTO _caller_email FROM auth.users WHERE id = _caller;

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL WHERE id::text = $1 AND deleted_at IS NOT NULL',
    _table
  ) USING _id;

  GET DIAGNOSTICS _affected = ROW_COUNT;
  IF _affected = 0 THEN
    RAISE EXCEPTION 'record not found or not deleted';
  END IF;

  INSERT INTO public.mapping_audit_log (pipeline, action, target_table, actor_id, actor_email, details)
  VALUES (
    'sysop',
    'record_restored',
    _table,
    _caller,
    _caller_email,
    jsonb_build_object('record_id', _id)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sysop_list_deleted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sysop_restore_record(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sysop_list_deleted() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sysop_restore_record(text, text) FROM PUBLIC, anon;
