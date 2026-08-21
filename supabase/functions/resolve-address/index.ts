/**
 * Phase 2B — `resolve-address` edge function.
 *
 * Server boundary for address resolution. Moves member-address geocoding off
 * the browser and puts the internal geocode cache in front of the external
 * geocoder chain.
 *
 * Flow: normalize → HMAC lookup key → internal cache → external chain
 *       (Nominatim bounded → Nominatim unbounded → Census) → validate →
 *       privacy-safe persistence → application-compatible response.
 *
 * Secrets NEVER leave this function: GEOCODE_CACHE_HMAC_SECRET,
 * SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GEOCODING_API_KEY.
 *
 * This endpoint is intentionally callable by the app (including anonymous
 * public map users) because member-address search is a core map feature and
 * this function replaces direct browser calls to the same public geocoders.
 * It returns coordinates only — no cache internals, no keys, no address echo.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { canonicalizeAddress, isInNevada, type LocationClass } from '../_shared/geocodeNormalize.ts';
import { resolveAddress, type CachedResolution, type ExternalHit, type GeocoderPort, type ResolverPorts } from './resolver.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const NV_VIEWBOX = '-120.0064,42.0022,-114.0396,35.0019';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

const precisionFromNominatim = (r: Record<string, unknown>): string => {
  const cls = String(r.class ?? '');
  const type = String(r.type ?? '');
  if (cls === 'building' || type === 'house') return 'rooftop';
  if (cls === 'highway') return 'street';
  if (cls === 'place' || cls === 'boundary') return 'locality';
  return 'approximate';
};

const nominatimPort = (bounded: boolean): GeocoderPort => ({
  name: 'nominatim',
  failureCode: 'nominatim_failed',
  run: async (canonical) => {
    const url = `${NOMINATIM}?q=${encodeURIComponent(canonical)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=${NV_VIEWBOX}${bounded ? '&bounded=1' : ''}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'NovumHealth-RuralMap/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const hit = data.find((r: Record<string, unknown>) =>
      isInNevada(parseFloat(String(r.lat)), parseFloat(String(r.lon))));
    if (!hit) return null;
    const addr = (hit.address ?? {}) as Record<string, string>;
    const precision = precisionFromNominatim(hit);
    return {
      lat: parseFloat(String(hit.lat)),
      lng: parseFloat(String(hit.lon)),
      confidence: precision === 'rooftop' ? 'high' : precision === 'street' ? 'medium' : 'low',
      precision,
      county: addr.county ?? null,
      postal_code: addr.postcode ?? null,
      label: String(hit.display_name ?? ''),
    } satisfies ExternalHit;
  },
});

const censusPort: GeocoderPort = {
  name: 'census',
  failureCode: 'census_failed',
  run: async (canonical) => {
    const url = `${CENSUS}?address=${encodeURIComponent(canonical)}&benchmark=2020&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    const lat = match.coordinates?.y;
    const lng = match.coordinates?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      confidence: 'medium',
      precision: 'range',
      county: null,
      postal_code: match.addressComponents?.zip ?? null,
      label: String(match.matchedAddress ?? ''),
    } satisfies ExternalHit;
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('GEOCODE_CACHE_HMAC_SECRET');
    if (!secret) return json({ error: 'geocode_cache_secret_missing' }, 500);

    const body = await req.json().catch(() => null) as
      | { address?: string; location_class?: string }
      | null;
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (!address || address.length > 300) {
      return json({ error: 'invalid_address' }, 400);
    }
    const ALLOWED_CLASSES = ['member_address', 'facility', 'rural_service', 'provider', 'known_place', 'manual'];
    const locationClass = (ALLOWED_CLASSES.includes(String(body?.location_class))
      ? body!.location_class
      : 'member_address') as LocationClass;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ports: ResolverPorts = {
      secret,
      cacheLookup: async (lookupKey) => {
        const { data } = await admin
          .from('geocode_resolutions')
          .select('*')
          .eq('lookup_key', lookupKey)
          .eq('location_class', locationClass)
          .maybeSingle();
        return (data as CachedResolution | null) ?? null;
      },
      cacheUpsert: async (record) => {
        const { data: existing } = await admin
          .from('geocode_resolutions')
          .select('id, is_manual, is_coordinate_locked, use_count')
          .eq('lookup_key', record.lookup_key)
          .eq('location_class', record.location_class)
          .maybeSingle();

        if (existing) {
          // Never overwrite a locked/manual record's coordinates.
          if (existing.is_manual || existing.is_coordinate_locked) return;
          await admin
            .from('geocode_resolutions')
            .update({
              ...record,
              last_used_at: new Date().toISOString(),
              use_count: (existing.use_count ?? 1) + 1,
            })
            .eq('id', existing.id);
          return;
        }
        await admin.from('geocode_resolutions').insert([record]);
      },
      cacheTouch: async (lookupKey, cacheHit) => {
        const { data: row } = await admin
          .from('geocode_resolutions')
          .select('id, use_count, cache_hit_count')
          .eq('lookup_key', lookupKey)
          .eq('location_class', locationClass)
          .maybeSingle();
        if (!row) return;
        await admin
          .from('geocode_resolutions')
          .update({
            last_used_at: new Date().toISOString(),
            use_count: (row.use_count ?? 0) + 1,
            cache_hit_count: (row.cache_hit_count ?? 0) + (cacheHit ? 1 : 0),
          })
          .eq('id', row.id);
      },
      geocoders: [nominatimPort(true), nominatimPort(false), censusPort],
      // Safe metadata only: never the address, never a secret, never a credential.
      logEvent: (event) => {
        console.log(JSON.stringify({ scope: 'geocode', ...event }));
      },
      now: () => new Date().toISOString(),
    };

    const result = await resolveAddress(ports, { address, locationClass });
    const canon = canonicalizeAddress(address);

    return json({
      resolved: result.resolved,
      lat: result.lat,
      lng: result.lng,
      source: result.source,
      confidence: result.confidence,
      precision: result.precision,
      county_name: result.county_name,
      county_fips: result.county_fips,
      cache_hit: result.cache_hit,
      external_calls: result.external_calls,
      is_coordinate_locked: result.is_coordinate_locked,
      is_manual: result.is_manual,
      failures: result.failures,
      // Approximate flag preserves the existing member-access UI contract.
      is_approximate: result.resolved
        ? canon.hasStreet && result.precision !== 'rooftop'
        : false,
    });
  } catch (err) {
    return json({ error: 'resolver_error', detail: String(err instanceof Error ? err.message : err) }, 500);
  }
});
