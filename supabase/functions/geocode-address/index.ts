import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildResourceAddress,
  resolveResourceAddress,
} from '../_shared/resourceGeocodeCache.ts';
import { createResourceCachePorts } from '../_shared/resourceCachePorts.ts';
import {
  createCensusPort,
  geodesicMeters,
  type CensusValidationDetail,
} from '../_shared/censusResourceGeocoder.ts';

import { getResourceTableContract, RESOURCE_TABLES } from '../_shared/resourceTableContracts.ts';
import { evaluateResourceEligibility } from '../_shared/resourceEligibility.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Phase 2D — single-record public-resource geocoder.
 *
 * Active provider chain: internal approved `resource_address` cache → U.S.
 * Census Geocoder (server-side, validated). Google Geocoding is RETIRED as an
 * active provider here; `GOOGLE_GEOCODING_API_KEY` is legacy / no longer used by
 * the active resource-geocoding path (credential cleanup is a deployment task).
 * Public Nominatim is not used. Member-address resolution is untouched.
 */

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
    const contract = getResourceTableContract(table);
    if (!contract) {
      return json({ error: 'invalid_table', supported_tables: RESOURCE_TABLES }, 400);
    }
    const latCol = contract.latColumn;
    const lngCol = contract.lngColumn;

    const { data: record, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return json({ error: `Lookup failed: ${fetchErr.message}` }, 500);
    if (!record) return json({ error: 'Record not found' }, 404);

    /**
     * Phase 2D.1 closure — ONE eligibility/protection contract shared with
     * `geocode-bulk`, using the REAL request force flag.
     *
     * Non-force (background enrichment after insert/promotion): a record that
     * already has coordinates is skipped with `already_has_coordinates` — zero
     * Census calls, zero provenance mutation. Imported coordinates are never
     * silently replaced.
     * Force (deliberate re-geocode, or an address that actually changed): may
     * re-resolve an automated coordinate.
     * Manual/locked authority outranks cache, Census and `force`; soft-deleted,
     * inactive and non-mappable records are never sent to an external provider.
     */
    const gate = evaluateResourceEligibility(record, contract, { force: !!force });

    if (!gate.eligible) {
      return json({
        success: true,
        skipped: true,
        reason: gate.reason,
        protected: gate.reason === 'protected_manual_or_locked_coordinate',
        lat: record[latCol] ?? null,
        lng: record[lngCol] ?? null,
        confidence: record.coordinate_confidence ?? null,
        match_type: record.geocode_match_type ?? null,
      });
    }

    const addressParts = buildResourceAddress(record);

    const secret = Deno.env.get('GEOCODE_CACHE_HMAC_SECRET');
    if (!secret) return json({ error: 'geocode_cache_secret_missing' }, 500);


    /**
     * Ordering: the internal approved cache is consulted FIRST (inside
     * `resolveResourceAddress`); Census is only contacted on a miss or a
     * deliberate force. No credential is required to reuse internal knowledge.
     */
    let validation: CensusValidationDetail | null = null;
    const censusPort = createCensusPort({
      source: {
        street_address: record.street_address as string | null,
        city: record.city as string | null,
        state: (record.state as string | null) ?? 'NV',
        zip: record.zip as string | null,
      },
      requireNevada: true,
      onValidation: (d) => { validation = d; },
    });

    const ports = createResourceCachePorts(supabase, secret, [censusPort]);
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
          // Never attribute a failure to a provider that was not called.
          geocode_provider: null,
          coordinate_confidence: 'failed',
          geocode_match_type: null,
          last_geocoded_at: new Date().toISOString(),
        })
        .eq('id', id);
      return json({
        error: 'geocode_unresolved',
        failure: resolution.failure,
        validation,
      }, 422);
    }

    const { lat, lng } = resolution;

    /**
     * Provenance mapping (Phase 2C §9):
     *   coordinate_source  = HOW THIS RECORD received it (census | internal_cache)
     *   geocode_provider   = HOW IT WAS ORIGINALLY resolved (census | manual_verified | legacy google/nominatim)
     *   coordinate_confidence / geocode_match_type preserved from the original.
     */
    const update: Record<string, unknown> = {
      geocoded_lat: lat,
      geocoded_lng: lng,
      coordinate_source: resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider,
      coordinate_confidence: resolution.confidence,
      geocode_provider: resolution.geocode_provider,
      geocode_match_type: resolution.match_type,
      last_geocoded_at: new Date().toISOString(),
    };

    // Reached only for unprotected records (protection short-circuits above).
    update[latCol] = lat;
    update[lngCol] = lng;

    /**
     * Phase 2D.1 §5 — record-level legacy supersession must be visible in the
     * existing mapping audit history AS the record fields change. No new
     * schema; historical audit rows are never rewritten.
     */
    const prevLat = record[latCol];
    const prevLng = record[lngCol];
    const prevProvider = (record.geocode_provider as string | null) ?? null;
    const prevSource = (record.coordinate_source as string | null) ?? null;
    const newProvider = resolution.geocode_provider;
    const newSource = resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider;
    const movedMeters =
      typeof prevLat === 'number' && Number.isFinite(prevLat) &&
      typeof prevLng === 'number' && Number.isFinite(prevLng)
        ? Math.round(geodesicMeters(prevLat, prevLng, lat, lng))
        : null;

    try {
      await supabase.from('mapping_audit_log').insert({
        pipeline: contract.auditPipeline,
        action: 'record_edited',
        target_table: table,
        target_row_id: id,
        details: {
          geocode: true,
          previous_provider: prevProvider,
          previous_coordinate_source: prevSource,
          new_provider: newProvider,
          new_coordinate_source: newSource,
          previous_latitude: typeof prevLat === 'number' ? prevLat : null,
          previous_longitude: typeof prevLng === 'number' ? prevLng : null,
          new_latitude: lat,
          new_longitude: lng,
          distance_meters: movedMeters,
          legacy_provider_superseded:
            prevProvider === 'google' || prevProvider === 'nominatim',
          validation_status: validation?.validation_status ?? null,
          house_number_match: validation?.house_number_match ?? null,
          street_name_match: validation?.street_name_match ?? null,
          forced: !!force,
        },
      });
    } catch {
      // Audit failure must never abort geocoding.
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
      /**
       * Phase 2C.1: distinguishes "fresh forced external result" from
       * "forced refresh failed; existing internal result retained".
       */
      forced_refresh_failed: resolution.forced_refresh_failed,
      refresh_status: force
        ? (resolution.forced_refresh_failed ? 'forced_refresh_failed_cache_retained' : 'forced_refresh_succeeded')
        : (resolution.cache_hit ? 'cache_reuse' : 'external_resolved'),
      cache_classification: resolution.cache_classification ?? null,
      validation,
    });
  } catch {
    // Stable code only — never echo internal errors that could contain the
    // request URL (API key), service-role credentials, or DB internals.
    return json({ error: 'geocode_internal_error' }, 500);
  }
});

