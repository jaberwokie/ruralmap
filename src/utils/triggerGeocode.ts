/**
 * Fire-and-forget trigger for the `geocode-address` edge function.
 *
 * Two distinct caller intents, and the difference matters:
 *
 * A. NEW RECORD / BACKGROUND ENRICHMENT (default, non-force) — insert,
 *    import, promotion. The server skips any record that already has
 *    coordinates (`already_has_coordinates`): imported coordinates are
 *    preserved and never silently replaced by Census.
 * B. ADDRESS DELIBERATELY CHANGED (`{ force: true }`) — the stored coordinate
 *    now describes the wrong place, so an automated coordinate may be
 *    re-resolved. Manual and `coordinate_locked` coordinates stay protected
 *    server-side regardless of force.
 *
 * Never blocks the caller — geocoding is a background enrichment.
 */
import { supabase } from '@/integrations/supabase/client';

type GeocodeTable = 'facilities' | 'staging_providers';

export const triggerGeocodeAddress = (
  table: GeocodeTable,
  id: string,
  opts: { force?: boolean } = {},
): void => {
  const force = opts.force === true;
  // Intentionally not awaited.
  void supabase.functions
    .invoke('geocode-address', { body: force ? { table, id, force: true } : { table, id } })
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
