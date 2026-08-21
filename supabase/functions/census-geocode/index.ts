/**
 * DECOMMISSIONED (Phase 2D).
 *
 * This endpoint was an unauthenticated public proxy to the U.S. Census
 * Geocoder. All resource geocoding now runs inside the authenticated
 * `geocode-bulk` / `geocode-address` functions, which call Census directly
 * server-side and write validated results into the internal
 * `resource_address` authority.
 *
 * This handler makes ZERO Census calls and accepts no address proxy behavior.
 * It exists only so any stale deployed client receives a stable, explicit
 * "gone" answer instead of silently reaching an open geocoding proxy.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'deprecated_endpoint',
      detail:
        'census-geocode is decommissioned. Resource geocoding runs server-side in the authenticated geocode-bulk / geocode-address functions.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
