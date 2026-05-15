-- Seed staging_facilities from existing facilities table
-- All existing records are pre-approved (already live on the map)
insert into public.staging_facilities (
  name, type, classification, data_confidence,
  city, county, street_address, state, zip,
  phone, website,
  latitude, longitude,
  notes, tier, service, volume, access_type,
  operational, psychiatric, inpatient,
  access_notes,
  review_status, verification_status, mappable,
  created_at, updated_at
)
select
  name, type, classification, data_confidence,
  city, county, street_address, state, zip,
  phone, website,
  lat, lng,
  notes, tier, service, volume, access_type,
  operational, psychiatric, inpatient,
  access_notes,
  'approved', verification_status, mappable,
  created_at, updated_at
from public.facilities;

-- Seed staging_rural_services from existing rural_services table
-- All existing records are pre-approved (already live on the map)
insert into public.staging_rural_services (
  name, category,
  city, county, street_address, state, zip,
  phone, website,
  latitude, longitude,
  notes, access_notes,
  operational, operational_service_class,
  bh_category_mapped, bh_entity_type, bh_service_type,
  service_tags,
  review_status, verification_status, mappable,
  created_at, updated_at
)
select
  name, category,
  city, county, street_address, state, zip,
  phone, website,
  lat, lng,
  notes, access_notes,
  operational, operational_service_class,
  bh_category_mapped, bh_entity_type, bh_service_type,
  service_tags,
  'approved', verification_status, mappable,
  created_at, updated_at
from public.rural_services;