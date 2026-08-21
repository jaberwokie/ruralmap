import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildResourceAddress,
  resolveResourceAddress,
  type ResourceExternalHit,
  type ResourceExternalPort,
} from '../_shared/resourceGeocodeCache.ts';
import { createResourceCachePorts } from '../_shared/resourceCachePorts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const CONFIDENCE_MAP: Record<string, string> = {
  ROOFTOP: 'rooftop',
  RANGE_INTERPOLATED: 'range',
  GEOMETRIC_CENTER: 'geometric',
  APPROXIMATE: 'approximate',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


/**
 * Verifies the caller's JWT and requires an active admin/sysop role.
 * Returns null when authorized, or a Response to return immediately.
 */
const requireAdmin = async (
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<Response | null> => {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!roleRow?.is_active || (roleRow.role !== 'admin' && roleRow.role !== 'sysop')) {
    return json({ error: 'Admin access required' }, 403);
  }
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
    if (!apiKey) return json({ error: 'GOOGLE_GEOCODING_API_KEY not configured' }, 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const denied = await requireAdmin(req, supabase);
    if (denied) return denied;


    const body = await req.json().catch(() => null) as
      | { table?: string; id?: string; force?: boolean }
      | null;
    if (!body || !body.table || !body.id) {
      return json({ error: 'Missing required fields: table, id' }, 400);
    }
    const { table, id, force } = body;
    const ALLOWED = ['facilities', 'rural_services', 'verified_services', 'verified_bh', 'staging_providers'] as const;
    if (!ALLOWED.includes(table as typeof ALLOWED[number])) {
      return json({ error: `Invalid table. Must be one of: ${ALLOWED.join(', ')}` }, 400);
    }

    // facilities and rural_services use lat/lng; all others use latitude/longitude
    const usesLatLng = table === 'facilities' || table === 'rural_services';
    const latCol = usesLatLng ? 'lat' : 'latitude';
    const lngCol = usesLatLng ? 'lng' : 'longitude';

    const { data: record, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return json({ error: `Lookup failed: ${fetchErr.message}` }, 500);
    if (!record) return json({ error: 'Record not found' }, 404);

    if (record.coordinate_locked && !force) {
      return json({
        success: true,
        locked: true,
        lat: record[latCol],
        lng: record[lngCol],
        confidence: record.coordinate_confidence,
        match_type: record.geocode_match_type,
      });
    }

    if (!record.street_address) {
      return json({ error: 'Record has no street_address' }, 400);
    }

    const addressParts = buildResourceAddress(record);

    // ── Phase 2C: shared internal resource-address authority ───────────────
    const googlePort: ResourceExternalPort = {
      name: 'google',
      run: async (address): Promise<ResourceExternalHit | null> => {
        const url = `${GOOGLE_URL}?address=${encodeURIComponent(address)}&components=administrative_area:NV|country:US&key=${apiKey}`;
        // NOTE: the request URL contains the API key and is never logged or returned.
        const res = await fetch(url);
        const data = await res.json().catch(() => null);
        if (!data || data.status !== 'OK' || !data.results?.length) return null;
        const g = data.results[0];
        const lat = g.geometry?.location?.lat;
        const lng = g.geometry?.location?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        const matchType = g.geometry?.location_type as string | undefined;
        return {
          lat,
          lng,
          confidence: matchType ? (CONFIDENCE_MAP[matchType] ?? 'approximate') : 'approximate',
          match_type: matchType ?? null,
          precision: matchType ? (CONFIDENCE_MAP[matchType] ?? 'approximate') : 'approximate',
          county: null,
          postal_code: record.zip ?? null,
        };
      },
    };

    const secret = Deno.env.get('GEOCODE_CACHE_HMAC_SECRET');
    if (!secret) return json({ error: 'geocode_cache_secret_missing' }, 500);

    const ports = createResourceCachePorts(supabase, secret, [googlePort]);
    const resolution = await resolveResourceAddress(ports, {
      address: addressParts,
      force: !!force,
      requireNevada: true,
    });

    if (!resolution.resolved || resolution.lat === null || resolution.lng === null) {
      await supabase
        .from(table)
        .update({
          coordinate_source: 'failed',
          geocode_provider: 'google',
          geocode_match_type: null,
          last_geocoded_at: new Date().toISOString(),
        })
        .eq('id', id);
      return json({ error: 'geocode_unresolved', failure: resolution.failure }, 422);
    }

    const { lat, lng } = resolution;

    /**
     * Provenance mapping (Phase 2C §9):
     *   coordinate_source  = HOW THIS RECORD received it (google | internal_cache)
     *   geocode_provider   = HOW IT WAS ORIGINALLY resolved (google | census | …)
     *   coordinate_confidence / geocode_match_type preserved from the original.
     */
    const update: Record<string, unknown> = {
      geocoded_lat: lat,
      geocoded_lng: lng,
      coordinate_source: resolution.cache_hit ? 'internal_cache' : 'google',
      coordinate_confidence: resolution.confidence,
      geocode_provider: resolution.geocode_provider,
      geocode_match_type: resolution.match_type,
      last_geocoded_at: new Date().toISOString(),
    };

    if (!record.coordinate_locked) {
      update[latCol] = lat;
      update[lngCol] = lng;
    }

    const { error: updateErr } = await supabase.from(table).update(update).eq('id', id);
    if (updateErr) return json({ error: 'record_update_failed' }, 500);

    return json({
      success: true,
      lat,
      lng,
      confidence: resolution.confidence,
      match_type: resolution.match_type,
      cache_hit: resolution.cache_hit,
      external_calls: resolution.external_calls,
      geocode_provider: resolution.geocode_provider,
      review_required: resolution.review_required,
    });
  } catch {
    // Stable code only — never echo internal errors that could contain the
    // request URL (API key), service-role credentials, or DB internals.
    return json({ error: 'geocode_internal_error' }, 500);
  }
});

