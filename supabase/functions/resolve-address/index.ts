/**
 * Phase 2B / 2B.1 / 2B.2 — `resolve-address` edge function.
 *
 * MEMBER-ADDRESS RESOLVER ONLY.
 *
 * Data-boundary rule (Phase 2B.2): a member address may be sent to the Rural
 * Tool's own server boundary, its internal HMAC-keyed geocode authority, and
 * canonical NovumHealth-controlled data — and to nothing else. There is
 * currently NO external provider approved to receive member addresses:
 *
 *   member_address_external_provider = none_approved
 *
 * Public Nominatim is prohibited (OSMF policy forbids personal/confidential
 * material) and the Census Geocoder has no documented project approval for
 * member data, so both are removed from this pipeline. They remain available
 * for public business/resource geocoding via the dedicated administrative
 * functions (`geocode-address`, `geocode-bulk`, `census-geocode`).
 *
 * Flow: normalize → HMAC lookup key → canonical Rural Tool resource match →
 *       internal authority/cache → unresolved (manual placement offered).
 *
 * Elevated `location_class` values are NOT exposed here: canonical resource
 * maintenance uses the administrative geocoding pathways. Any caller-supplied
 * class other than `member_address` is rejected with 403, for every role
 * (Ops is read-only in this project's role model and must never be able to
 * cause a service-role geocode write).
 *
 * Secrets NEVER leave this function: GEOCODE_CACHE_HMAC_SECRET,
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type LocationClass } from '../_shared/geocodeNormalize.ts';
import {
  createCanonicalMatch,
  type CanonicalDbClient,
} from './canonicalMatch.ts';
import {
  resolveAddress,
  type CachedResolution,
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

/** This endpoint resolves exactly one class. Nothing else is accepted. */
const MEMBER_CLASS: LocationClass = 'member_address';


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

    // ── location_class authorization (Phase 2B.2) ────────────────────────
    // Member-address resolver only. No role — viewer, staff, ops, admin, or
    // sysop — can request an elevated class through this endpoint, so no role
    // can use it to drive a service-role write into another class.
    if (
      body?.location_class !== undefined &&
      body?.location_class !== null &&
      String(body.location_class) !== MEMBER_CLASS
    ) {
      return json({ error: 'location_class_forbidden' }, 403);
    }
    const locationClass: LocationClass = MEMBER_CLASS;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ports: ResolverPorts = {
      secret,
      // Canonical Rural Tool resource coordinates (see canonicalMatch.ts).
      canonicalMatch: createCanonicalMatch(admin as unknown as CanonicalDbClient),

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
      // member_address_external_provider = none_approved.
      // Public Nominatim: prohibited for personal/confidential material.
      // Census Geocoder: no documented project approval for member addresses.
      geocoders: [],
      // Safe metadata only: never the address, never a secret, never a credential.
      logEvent: (event) => {
        console.log(JSON.stringify({ scope: 'geocode', ...event }));
      },
      now: () => new Date().toISOString(),
    };

    const result = await resolveAddress(ports, {
      address,
      locationClass,
      // Anonymous misses do not create null-coordinate cache rows.
      persistUnresolved: false,
    });

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
    // No internal detail leaks to the caller. The submitted address is never
    // echoed back in an error.
    return json({ error: 'resolver_error' }, 500);
  }
});
