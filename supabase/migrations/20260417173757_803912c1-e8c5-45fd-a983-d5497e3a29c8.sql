-- List users (admin only). Joins auth.users with user_roles.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  role public.app_role,
  is_active boolean,
  created_at timestamptz,
  role_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    COALESCE(
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.is_active = true
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 0
          WHEN 'staff' THEN 1
          WHEN 'viewer' THEN 2
        END
        LIMIT 1
      ),
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = u.id
        ORDER BY ur.updated_at DESC
        LIMIT 1
      ),
      'viewer'::public.app_role
    ) AS role,
    COALESCE(
      (
        SELECT bool_or(ur.is_active)
        FROM public.user_roles ur
        WHERE ur.user_id = u.id
      ),
      false
    ) AS is_active,
    u.created_at,
    (
      SELECT max(ur.updated_at)
      FROM public.user_roles ur
      WHERE ur.user_id = u.id
    ) AS role_updated_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Helper: count of distinct users that currently have an active admin role.
CREATE OR REPLACE FUNCTION public.active_admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::int
  FROM public.user_roles
  WHERE role = 'admin' AND is_active = true;
$$;

-- Set a user's role. Replaces their active role rows with a single active row
-- of the chosen role. Admin-only. Blocks self-demotion if it would leave no
-- active admins.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _was_admin boolean;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF _role NOT IN ('viewer','staff','admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin' AND is_active = true
  ) INTO _was_admin;

  -- Self-lockout: prevent demoting yourself if you are the last active admin.
  IF _user_id = _caller AND _was_admin AND _role <> 'admin' THEN
    IF public.active_admin_count() <= 1 THEN
      RAISE EXCEPTION 'cannot remove last active admin';
    END IF;
  END IF;

  -- Last-admin guard for any user (not just self): if target is the last
  -- active admin and we're moving them off admin, block.
  IF _was_admin AND _role <> 'admin' AND public.active_admin_count() <= 1 THEN
    RAISE EXCEPTION 'cannot remove last active admin';
  END IF;

  -- Deactivate any existing active rows for this user.
  UPDATE public.user_roles
  SET is_active = false, updated_at = now()
  WHERE user_id = _user_id AND is_active = true;

  -- Upsert target role row as active.
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (_user_id, _role, true)
  ON CONFLICT (user_id, role)
  DO UPDATE SET is_active = true, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;

-- Toggle active status across all of a user's role rows. Admin-only.
-- Blocks self-deactivation and any deactivation that would leave no active admins.
CREATE OR REPLACE FUNCTION public.admin_set_user_active(_user_id uuid, _is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_admin_target boolean;
BEGIN
  IF _caller IS NULL OR NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF _is_active = false THEN
    -- Self-deactivation block
    IF _user_id = _caller THEN
      RAISE EXCEPTION 'cannot deactivate yourself';
    END IF;

    -- Last-admin guard
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'admin' AND is_active = true
    ) INTO _is_admin_target;

    IF _is_admin_target AND public.active_admin_count() <= 1 THEN
      RAISE EXCEPTION 'cannot deactivate last active admin';
    END IF;
  END IF;

  UPDATE public.user_roles
  SET is_active = _is_active, updated_at = now()
  WHERE user_id = _user_id;

  -- If user has no role rows yet and we're activating, create a viewer row.
  IF _is_active = true AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (_user_id, 'viewer', true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) TO authenticated;

-- Ensure user_roles has the unique constraint admin_set_user_role relies on.
-- (Already created in initial migration, but guard with IF NOT EXISTS pattern.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;