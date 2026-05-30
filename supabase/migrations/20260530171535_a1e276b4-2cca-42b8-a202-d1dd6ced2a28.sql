-- Allow sysop callers to use admin management RPCs (sysop > admin).
-- SysOp exclusion from listed results and protection from role/active changes is preserved.

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, email text, role app_role, is_active boolean, created_at timestamp with time zone, role_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'sysop'::public.app_role)) THEN
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
  IF _caller IS NULL OR NOT (public.has_role(_caller, 'admin'::public.app_role)
                          OR public.has_role(_caller, 'sysop'::public.app_role)) THEN
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
  IF _caller IS NULL OR NOT (public.has_role(_caller, 'admin'::public.app_role)
                          OR public.has_role(_caller, 'sysop'::public.app_role)) THEN
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

CREATE OR REPLACE FUNCTION public.admin_invite_user(_email text, _role app_role DEFAULT 'viewer'::app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'sysop'::public.app_role)) THEN
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