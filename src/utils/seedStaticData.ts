import { supabase } from '@/integrations/supabase/client';
import { defaultFacilities } from '@/data/facilities';
import { ruralServices } from '@/data/rural-services';

export const seedFacilities = async (): Promise<{
  inserted: number;
  skipped: number;
  errors: string[];
}> => {
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (const f of defaultFacilities) {
    const row = {
      id: f.id,
      name: f.name,
      type: f.type,
      classification: f.classification ?? null,
      data_confidence: f.dataConfidence ?? null,
      city: f.city,
      county: f.county,
      street_address: f.address ?? null,
      state: 'NV',
      zip: null,
      phone: f.phone ?? null,
      website: f.website ?? null,
      lat: f.lat,
      lng: f.lng,
      notes: f.notes ?? null,
      tier: f.tier ?? null,
      service: f.service ?? null,
      volume: f.volume ?? null,
      access_type: f.accessType ?? null,
      operational: f.operational ?? null,
      psychiatric: f.psychiatric ?? null,
      inpatient: f.inpatient ?? null,
      access_notes: null,
      review_status: 'pending',
      verification_status: 'unverified',
    };

    const { error } = await (supabase as any)
      .from('facilities')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      results.errors.push(`${f.id}: ${error.message}`);
    } else {
      results.inserted++;
    }
  }

  return results;
};

export const seedRuralServices = async (): Promise<{
  inserted: number;
  skipped: number;
  errors: string[];
}> => {
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (const s of ruralServices) {
    // Extract zip from address string if present
    const zipMatch = s.address?.match(/\b(\d{5})\b/);
    const zip = zipMatch ? zipMatch[1] : null;

    // Strip zip and state from address to get clean street address
    const streetAddress = s.address
      ?.replace(/,?\s*(NV|Nevada)\s*\d{5}/, '')
      .replace(/,?\s*\d{5}$/, '')
      .trim() ?? null;

    const row = {
      id: s.id,
      name: s.name,
      category: s.category,
      county: s.county,
      city: s.city,
      street_address: streetAddress,
      state: 'NV',
      zip,
      phone: s.phone ?? null,
      website: s.website ?? null,
      notes: s.notes ?? null,
      lat: s.lat,
      lng: s.lng,
      bh_category_mapped: s.bhCategoryMapped ?? null,
      bh_entity_type: s.bhEntityType ?? null,
      bh_service_type: s.bhServiceType ?? null,
      service_tags: s.serviceTags ?? null,
      operational: s.operational ?? null,
      operational_service_class: s.operationalServiceClass ?? null,
      access_notes: null,
      review_status: 'pending',
      verification_status: 'unverified',
    };

    const { error } = await (supabase as any)
      .from('rural_services')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      results.errors.push(`${s.id}: ${error.message}`);
    } else {
      results.inserted++;
    }
  }

  return results;
};
