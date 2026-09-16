ALTER TABLE public.geocode_resolutions
  DROP CONSTRAINT IF EXISTS geocode_resolutions_source_check;

ALTER TABLE public.geocode_resolutions
  ADD CONSTRAINT geocode_resolutions_source_check CHECK (
    geocode_source IN (
      'manual_verified','canonical_resource','internal_cache','google','census',
      'nominatim','known_provider','legacy_static','private_member_geocoder','unresolved'
    )
  );

CREATE OR REPLACE FUNCTION public.geocode_resolutions_protect_locked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.is_coordinate_locked OR OLD.is_manual)
     AND NEW.geocode_source IN ('google','census','nominatim','internal_cache','known_provider','legacy_static','private_member_geocoder','unresolved')
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