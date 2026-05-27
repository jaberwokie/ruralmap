
-- Remove anon access to the email column on verified_services while preserving
-- anonymous read access to all other columns for active rows.
REVOKE SELECT ON public.verified_services FROM anon;
GRANT SELECT (
  id, staging_id, name, service_category, service_subcategory, organization_name,
  description, target_population, eligibility_notes, street_address, city, state,
  zip, county, latitude, longitude, phone, website,
  referral_required, walk_in_allowed, appointment_required, hours_of_operation,
  languages_supported, active_status, verification_status, verification_confidence,
  verification_source, verification_date, last_reviewed_at, access_notes,
  transportation_notes, medicaid_relevance, source_file_name, source_row_number,
  import_batch_id, promoted_at, promoted_by, created_at, updated_at, service_tags,
  resource_class, mappable, geocode_match_type, geocode_provider,
  coordinate_confidence, coordinate_locked, coordinate_source, manual_lng,
  manual_lat, category_raw, category_mapped, geocoded_lat, geocoded_lng,
  last_geocoded_at
) ON public.verified_services TO anon;
