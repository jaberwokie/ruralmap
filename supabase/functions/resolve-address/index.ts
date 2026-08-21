/**
 * Phase 2B / 2B.1 — `resolve-address` edge function.
 *
 * HARD PRIVACY BOUNDARY. All external geocoding for member addresses happens
 * here. The browser never calls Nominatim or Census directly and never sees
 * cache internals, keys, or credentials.
 *
 * Flow: normalize → HMAC lookup key → canonical Rural Tool resource match →
 *       internal cache → server-side retry-variant chain across the approved
 *       external geocoders (Nominatim bounded → unbounded → Census) →
 *       Nevada validation → privacy-safe persistence → response.
 *
 * Secrets NEVER leave this function: GEOCODE_CACHE_HMAC_SECRET,
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Anonymous callers are supported because member-address search is a core
 * public map feature — but they are hard-pinned to `location_class =
 * 'member_address'`. Only admin/ops/sysop callers may request another class.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  canonicalizeAddress,
  isInNevada,
  type LocationClass,
} from '../_shared/geocodeNormalize.ts';
import {
  resolveAddress,
  type CachedResolution,
  type ExternalHit,
  type GeocoderPort,
  type ResolverPorts,
} from './resolver.ts';

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

/** Elevated classes may only be requested by internal operational roles. */
const ELEVATED_CLASSES: LocationClass[] = [
  'facility',
  'rural_service',
  'provider',
  'known_place',
  'manual',
];

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
  run: async (query) => {
    const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=${NV_VIEWBOX}${bounded ? '&bounded=1' : ''}`;
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
  run: async (query) => {
    const url = `${CENSUS}?address=${encodeURIComponent(query)}&benchmark=2020&format=json`;
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

    const raw = await req.text();
    // Abuse resistance: a Nevada address is never this long.
    if (raw.length > 2000) return json({ error: 'payload_too_large' }, 413);

    const body = (() => {
      try {
        return JSON.parse(raw) as { address?: string; location_class?: string } | null;
      } catch {
        return null;
      }
    })();

    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (!address || address.length > 300) return json({ error: 'invalid_address' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── location_class authorization ────────────────────────────────────
    // Public/anonymous callers are pinned to member_address. Elevated classes
    // write into the shared internal geocode authority, so they require an
    // internal operational role.
    const requested = String(body?.location_class ?? 'member_address') as LocationClass;
    let locationClass: LocationClass = 'member_address';

    if (ELEVATED_CLASSES.includes(requested)) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
      let allowed = false;
      if (token) {
        const { data: userData } = await admin.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userId) {
          const { data: roles } = await admin
            .from('user_roles')
            .select('role')
            .eq('user_id', userId);
          allowed = (roles ?? []).some((r: { role: string }) =>
            ['admin', 'ops', 'sysop'].includes(r.role));
        }
      }
      if (!allowed) return json({ error: 'location_class_forbidden' }, 403);
      locationClass = requested;
    }

    const ports: ResolverPorts = {
      secret,
      // ── Canonical Rural Tool resource coordinates ─────────────────────
      // Exact canonical-address equality only. No fuzzy matching: a wrong
      // canonical match would place a member at the wrong location.
      canonicalMatch: async (canonical) => {
        const canon = canonicalizeAddress(canonical);
        if (!canon.street) return null;

        const tables = ['verified_services', 'verified_bh'] as const;
        for (const table of tables) {
          let query = admin
            .from(table)
            .select('street_address, city, state, zip, county, latitude, longitude, coordinate_locked, coordinate_confidence')
            .is('deleted_at', null)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .limit(50);
          if (canon.zip) query = query.eq('zip', canon.zip);
          else if (canon.city) query = query.ilike('city', canon.city);
          else continue;

          const { data } = await query;
          for (const row of (data ?? []) as Array<Record<string, unknown>>) {
            const street = String(row.street_address ?? '');
            const city = String(row.city ?? '');
            const zip = String(row.zip ?? '');
            if (!street) continue;
            const rowCanon = canonicalizeAddress(`${street}, ${city}, NV ${zip}`);
            if (rowCanon.canonical !== canon.canonical) continue;
            const lat = Number(row.latitude);
            const lng = Number(row.longitude);
            if (!isInNevada(lat, lng)) continue;
            return {
              lat,
              lng,
              confidence: String(row.coordinate_confidence ?? 'high'),
              precision: 'rooftop',
              county: (row.county as string | null) ?? null,
              postal_code: zip || null,
              label: `${street}, ${city}, NV`,
              source: 'canonical_resource' as const,
            };
          }
        }
        return null;
      },
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
      strategy: result.strategy,
      is_approximate: result.is_approximate,
      manual_placement_required: result.manual_placement_required,
      highway_address: result.highway_address,
    });
  } catch {
    // No internal detail leaks to the caller.
    return json({ error: 'resolver_error' }, 500);
  }
});
