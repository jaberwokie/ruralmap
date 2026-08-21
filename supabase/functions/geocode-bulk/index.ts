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

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const NV_VIEWBOX = '-120.0064,42.0022,-114.0396,35.0019';
const NV_BOUNDS = { minLat: 35.0019, maxLat: 42.0022, minLng: -120.0064, maxLng: -114.0396 };

const isInNevada = (lat: number, lng: number) =>
  lat >= NV_BOUNDS.minLat && lat <= NV_BOUNDS.maxLat &&
  lng >= NV_BOUNDS.minLng && lng <= NV_BOUNDS.maxLng;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const normalizeAddress = (street: string): string => {
  return street
    // Strip suite/unit with optional # and alphanumeric identifier
    .replace(/\b(suite|ste\.?|unit|apt\.?|apartment|bldg\.?|building|room|rm\.?)\s*#?\s*[\w-]*/gi, '')
    // Strip standalone # followed by identifier
    .replace(/#\s*[\w-]+/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Phase 2C — approved public-resource external providers, unchanged in scope:
 * Nominatim (bounded → unbounded) and the Census onelineaddress geocoder.
 * Only reached on an internal resource-cache MISS.
 */
const nominatimPort = (bounded: boolean): ResourceExternalPort => ({
  name: 'nominatim',
  run: async (address): Promise<ResourceExternalHit | null> => {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=${NV_VIEWBOX}${bounded ? '&bounded=1' : ''}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NovumHealth-RuralMap/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data as Array<{ lat: string; lon: string }>).find((r) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
    });
    if (!hit) return null;
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      confidence: bounded ? 'high' : 'low',
      match_type: bounded ? 'address_full' : 'city_county_fallback',
      precision: bounded ? 'street' : 'approximate',
    };
  },
});

const censusPort: ResourceExternalPort = {
  name: 'census',
  run: async (address): Promise<ResourceExternalHit | null> => {
    const res = await fetch(`${CENSUS_URL}?address=${encodeURIComponent(address)}&benchmark=2020&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    const lat = match?.coordinates?.y;
    const lng = match?.coordinates?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      confidence: 'low',
      match_type: 'census_onelineaddress',
      precision: 'approximate',
    };
  },
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Require an authenticated caller with an active admin/sysop role.
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!token) return jsonRes({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleRow?.is_active || (roleRow.role !== 'admin' && roleRow.role !== 'sysop')) {
      return jsonRes({ error: 'Admin access required' }, 403);
    }

    const payload = await req.json().catch(() => null) as
      | { table?: string; limit?: number; offset?: number }
      | null;
    const table = payload?.table;
    // Cap per-call work so a single request cannot loop the paid geocoders indefinitely.
    const limit = Math.min(Math.max(Number(payload?.limit ?? 80) || 80, 1), 100);
    const offset = Math.max(Number(payload?.offset ?? 0) || 0, 0);

    if (table !== 'facilities' && table !== 'rural_services') {
      return jsonRes({ error: 'invalid table' }, 400);
    }


    const { data: rows } = await supabase
      .from(table)
      .select('*')
      .is('lat', null)
      .is('lng', null)
      .range(offset, offset + limit - 1);
    const targets = rows ?? [];

    const secret = Deno.env.get('GEOCODE_CACHE_HMAC_SECRET');
    if (!secret) return jsonRes({ error: 'geocode_cache_secret_missing' }, 500);

    // Single shared internal resource cache — identical to geocode-address.
    const ports = createResourceCachePorts(supabase, secret, [
      nominatimPort(true),
      censusPort,
      nominatimPort(false),
    ]);

    let geocoded = 0, failed = 0, skipped = 0, cacheHits = 0, externalCalls = 0;

    for (const row of targets) {
      if (!row.street_address) { skipped++; continue; }

      const resolution = await resolveResourceAddress(ports, {
        address: buildResourceAddress(row),
        requireNevada: true,
      });

      const now = new Date().toISOString().slice(0, 10);
      externalCalls += resolution.external_calls;

      if (resolution.resolved && resolution.lat !== null && resolution.lng !== null) {
        const strategy = resolution.cache_hit
          ? 'internal_cache'
          : (resolution.match_type ?? resolution.geocode_provider ?? 'external');
        const confidence = resolution.confidence ?? 'low';
        const tag = `[geocode:${strategy}|${confidence}|${now}]`;
        const update: Record<string, unknown> = { access_notes: tag };
        if (!row.coordinate_locked) {
          update.lat = resolution.lat;
          update.lng = resolution.lng;
        }
        await supabase.from(table).update(update).eq('id', row.id);
        geocoded++;
        if (resolution.cache_hit) cacheHits++;
      } else {
        const tag = `[geocode:failed|low|${now}]`;
        await supabase.from(table).update({ access_notes: tag }).eq('id', row.id);
        failed++;
      }

      // Provider courtesy delay applies only when an external call happened.
      if (resolution.external_calls > 0) await delay(1100);
    }

    return new Response(
      JSON.stringify({
        geocoded, failed, skipped, total: targets.length, offset, limit,
        cache_hits: cacheHits, external_calls: externalCalls,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
