ALTER TABLE public.geocode_resolutions
  DROP CONSTRAINT geocode_resolutions_location_class_check;

ALTER TABLE public.geocode_resolutions
  ADD CONSTRAINT geocode_resolutions_location_class_check CHECK (
    location_class IN ('member_address','resource_address','facility','rural_service','provider','known_place','manual')
  );

COMMENT ON COLUMN public.geocode_resolutions.location_class IS 'Cache namespace. member_address = Phase 2B private member resolution (no approved external provider). resource_address = Phase 2C public facility/service/provider address reuse. Namespaces never cross.';