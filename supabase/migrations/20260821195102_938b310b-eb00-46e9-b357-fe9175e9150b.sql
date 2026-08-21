CREATE TABLE public.geocode_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_key text NOT NULL,
  location_class text NOT NULL,
  latitude double precision,
  longitude double precision,
  geocode_source text NOT NULL,
  confidence text,
  precision text,
  county_name text,
  county_fips text,
  state text,
  postal_code text,
  is_manual boolean NOT NULL DEFAULT false,
  is_coordinate_locked boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  use_count integer NOT NULL DEFAULT 1,
  cache_hit_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geocode_resolutions_key_class_unique UNIQUE (lookup_key, location_class),
  CONSTRAINT geocode_resolutions_location_class_check CHECK (
    location_class IN ('member_address','facility','rural_service','provider','known_place','manual')
  ),
  CONSTRAINT geocode_resolutions_source_check CHECK (
    geocode_source IN ('manual_verified','canonical_resource','internal_cache','google','census','nominatim','known_provider','legacy_static','unresolved')
  ),
  CONSTRAINT geocode_resolutions_coords_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  CONSTRAINT geocode_resolutions_key_format CHECK (lookup_key ~ '^v[0-9]+:[0-9a-f]{64}$')
);

COMMENT ON TABLE public.geocode_resolutions IS 'Phase 2B internal geocode authority/cache. lookup_key is a server-side HMAC-SHA-256 digest of the canonical normalized address (secret: GEOCODE_CACHE_HMAC_SECRET). Raw member address text is NEVER stored here.';
COMMENT ON COLUMN public.geocode_resolutions.lookup_key IS 'Keyed HMAC digest only. Not reversible without the server secret.';
COMMENT ON COLUMN public.geocode_resolutions.expires_at IS 'Nullable: no Rural Tool geocode expiration policy exists yet (Phase 2B spec s9).';

CREATE INDEX idx_geocode_resolutions_class ON public.geocode_resolutions (location_class);
CREATE INDEX idx_geocode_resolutions_source ON public.geocode_resolutions (geocode_source);
CREATE INDEX idx_geocode_resolutions_county ON public.geocode_resolutions (county_name);
CREATE INDEX idx_geocode_resolutions_last_used ON public.geocode_resolutions (last_used_at DESC);

GRANT SELECT ON public.geocode_resolutions TO authenticated;
GRANT UPDATE ON public.geocode_resolutions TO authenticated;
GRANT ALL ON public.geocode_resolutions TO service_role;

ALTER TABLE public.geocode_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops, admin and sysop can read geocode resolutions"
  ON public.geocode_resolutions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'ops'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE POLICY "Admin and sysop can maintain geocode resolutions"
  ON public.geocode_resolutions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sysop'::public.app_role)
  );

CREATE TRIGGER geocode_resolutions_set_updated_at
  BEFORE UPDATE ON public.geocode_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Guard: a locked or manually verified resolution can never be silently
-- overwritten by an automated geocode result.
CREATE OR REPLACE FUNCTION public.geocode_resolutions_protect_locked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.is_coordinate_locked OR OLD.is_manual)
     AND NEW.geocode_source IN ('google','census','nominatim','internal_cache','known_provider','legacy_static','unresolved')
     AND (NEW.latitude IS DISTINCT FROM OLD.latitude OR NEW.longitude IS DISTINCT FROM OLD.longitude)
  THEN
    NEW.latitude := OLD.latitude;
    NEW.longitude := OLD.longitude;
    NEW.geocode_source := OLD.geocode_source;
    NEW.confidence := OLD.confidence;
    NEW.precision := OLD.precision;
    NEW.is_manual := OLD.is_manual;
    NEW.is_coordinate_locked := OLD.is_coordinate_locked;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER geocode_resolutions_protect_locked
  BEFORE UPDATE ON public.geocode_resolutions
  FOR EACH ROW EXECUTE FUNCTION public.geocode_resolutions_protect_locked();

REVOKE EXECUTE ON FUNCTION public.geocode_resolutions_protect_locked() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.geocode_resolutions_protect_locked() FROM anon;