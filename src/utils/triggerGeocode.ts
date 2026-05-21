/**
 * Fire-and-forget trigger for the `geocode-address` edge function.
 *
 * Called after a successful insert/update on `facilities` or `staging_providers`
 * where `street_address` is present (insert) or changed (update). Never blocks
 * the caller — geocoding is a background enrichment.
 */
import { supabase } from '@/integrations/supabase/client';

type GeocodeTable = 'facilities' | 'staging_providers';

export const triggerGeocodeAddress = (table: GeocodeTable, id: string): void => {
  // Intentionally not awaited.
  void supabase.functions
    .invoke('geocode-address', { body: { table, id } })
    .then(({ error }) => {
      if (error) {
        // Background enrichment failure — log only, do not surface to user.
        // eslint-disable-next-line no-console
        console.warn(`[geocode-address] ${table}/${id} failed:`, error.message ?? error);
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[geocode-address] ${table}/${id} threw:`, err);
    });
};
