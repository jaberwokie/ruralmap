import { supabase } from '@/integrations/supabase/client';
import { Facility } from '@/data/facilities';
import { RuralService } from '@/data/rural-services';

export const listFacilitiesFromDb = async (): Promise<Facility[]> => {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error || !data) return [];

  return data.map((r): Facility => ({
    id: r.id,
    name: r.name,
    type: r.type as Facility['type'],
    classification: (r.classification as Facility['classification']) ?? undefined,
    dataConfidence: (r.data_confidence as Facility['dataConfidence']) ?? undefined,
    city: r.city ?? '',
    county: r.county ?? '',
    address: r.street_address ?? undefined,
    phone: r.phone ?? undefined,
    website: r.website ?? undefined,
    lat: r.lat!,
    lng: r.lng!,
    notes: r.notes ?? undefined,
    tier: (r.tier as Facility['tier']) ?? undefined,
    service: r.service ?? undefined,
    volume: r.volume ?? undefined,
    accessType: (r.access_type as Facility['accessType']) ?? undefined,
    operational: (r.operational as Facility['operational']) ?? undefined,
    psychiatric: (r.psychiatric as Facility['psychiatric']) ?? undefined,
    inpatient: (r.inpatient as Facility['inpatient']) ?? undefined,
  }));
};

export const listRuralServicesFromDb = async (): Promise<RuralService[]> => {
  const { data, error } = await supabase
    .from('rural_services')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error || !data) return [];

  return data.map((r): RuralService => ({
    id: r.id,
    name: r.name,
    category: r.category as RuralService['category'],
    county: r.county ?? '',
    city: r.city ?? '',
    address: r.street_address ?? undefined,
    phone: r.phone ?? undefined,
    website: r.website ?? undefined,
    notes: r.notes ?? undefined,
    lat: r.lat!,
    lng: r.lng!,
    bhCategoryMapped: r.bh_category_mapped ?? undefined,
    bhEntityType: r.bh_entity_type ?? undefined,
    bhServiceType: r.bh_service_type ?? undefined,
    serviceTags: r.service_tags ?? undefined,
    operational: (r.operational as RuralService['operational']) ?? undefined,
    operationalServiceClass: (r.operational_service_class as RuralService['operationalServiceClass']) ?? undefined,
  }));
};
