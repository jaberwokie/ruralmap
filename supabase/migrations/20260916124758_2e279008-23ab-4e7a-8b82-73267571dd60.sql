CREATE OR REPLACE FUNCTION public.tiger_street_exists(
  _street_key text,
  _street_core text DEFAULT NULL,
  _zip text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tiger_street_ranges r
    WHERE (
        r.street_key = _street_key
        OR (_street_core IS NOT NULL AND length(_street_core) > 0 AND r.street_core = _street_core)
      )
      AND (_zip IS NULL OR r.zip = _zip)
    LIMIT 1
  );
$$;

REVOKE ALL ON FUNCTION public.tiger_street_exists(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tiger_street_exists(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.tiger_street_exists(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tiger_street_exists(text, text, text) TO service_role;