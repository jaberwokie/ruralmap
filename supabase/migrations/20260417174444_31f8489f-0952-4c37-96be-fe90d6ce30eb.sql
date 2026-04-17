-- 1. Collapse to one row per user. First pick the highest active role per user
-- (admin > staff > viewer), preserving is_active flag.
WITH ranked AS (
  SELECT
    user_id,
    role,
    is_active,
    created_at,
    updated_at,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        is_active DESC,
        CASE role
          WHEN 'admin' THEN 0
          WHEN 'staff' THEN 1
          WHEN 'viewer' THEN 2
        END,
        updated_at DESC
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

-- 2. Replace (user_id, role) unique with a unique on user_id alone.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 3. Add updated_by audit column.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 4. Rewrite handle_new_user to upsert a single row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT := lower(coalesce(NEW.email, ''));
  _is_pending_admin BOOLEAN := false;
  _initial_role public.app_role := 'viewer';
BEGIN
  IF _email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pending_admin_emails WHERE lower(email) = _email
    ) INTO _is_pending_admin;

    IF _is_pending_admin THEN
      _initial_role := 'admin';
      DELETE FROM public.pending_admin_emails WHERE lower(email) = _email;
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, _initial_role, true)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        updated_at = now();

  RETURN NEW;
END;
$$;

-- 5. has_role already requires is_active=true; reaffirm.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  );
$$;

-- 6. current_user_role returns NULL when inactive (effective viewer/no access).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- 7. active_admin_count unchanged in spirit; rewrite for clarity.
CREATE OR REPLACE FUNCTION public.active_admin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.user_roles
  WHERE role = 'admin' AND is_active = true;
$$;

-- 8. admin_list_users: one row per user, joined to auth.users.
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
    COALESCE(ur.role, 'viewer'::public.app_role) AS role,
    COALESCE(ur.is_active, false) AS is_active,
    u.created_at,
    ur.updated_at AS role_updated_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- 9. admin_set_user_role: always block self role change. Block last-admin demotion.
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

  -- Hard block: admin can never change their own role via this RPC.
  IF _user_id = _caller THEN
    RAISE EXCEPTION 'You cannot change your own role';
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
$$;

-- 10. admin_set_user_active: always block self-deactivation. Block last-admin deactivation.
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

  -- Hard block: admin can never change their own active state via this RPC.
  IF _user_id = _caller THEN
    RAISE EXCEPTION 'You cannot change your own active status';
  END IF;

  IF _is_active = false THEN
    SELECT (role = 'admin' AND is_active = true)
    INTO _is_admin_target
    FROM public.user_roles WHERE user_id = _user_id;

    IF COALESCE(_is_admin_target, false) AND public.active_admin_count() <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active admin';
    END IF;
  END IF;

  -- Upsert single row, default to viewer if none exists.
  INSERT INTO public.user_roles (user_id, role, is_active, updated_by)
  VALUES (_user_id, 'viewer', _is_active, _caller)
  ON CONFLICT (user_id) DO UPDATE
    SET is_active = _is_active,
        updated_by = _caller,
        updated_at = now();
END;
$$;