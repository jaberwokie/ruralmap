-- Add 'ops' to the app_role enum, positioned between admin and staff in hierarchy.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ops';

-- Update admin_set_user_role to accept the new 'ops' role.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _was_admin boolean;
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
$function$;