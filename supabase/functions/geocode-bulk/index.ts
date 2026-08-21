/**
 * Phase 2D — THE canonical multi-record public-resource geocoder.
 *
 * One authenticated server-side pipeline for every resource geocoding workflow
 * in the Rural Tool. The browser never contacts an external geocoder.
 *
 * Provider chain (public RESOURCE addresses only):
 *   manual/locked canonical authority (record columns, enforced here)
 *   → approved internal `resource_address` cache (manual_verified | census)
 *   → U.S. Census Geocoder (server-side, validated)
 *   → validated result persisted as reusable internal authority
 *   → target record + review when low-confidence
 *
 * RETIRED as active providers (historical provenance retained, never rewritten):
 *   - Google Geocoding  (no longer approved as durable cross-record authority)
 *   - public Nominatim  (search + reverse)
 *
 * MEMBER BOUNDARY UNCHANGED: `member_address_external_provider = none_approved`.
 * Nothing here is reachable from member-address resolution.
 *
 * Batching is by STABLE EXPLICIT IDs. Mutable `lat IS NULL` offset pagination is
 * retired: it silently skipped records as earlier batches became resolved.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildResourceAddress,
  classifyResourceCacheSource,
  hasDeterministicIdentity,
  resolveResourceAddress,
  type ResolveResourceResult,
} from '../_shared/resourceGeocodeCache.ts';
import { createResourceCachePorts } from '../_shared/resourceCachePorts.ts';
import {
  createCensusPort,
  geodesicMeters,
  type CensusValidationDetail,
} from '../_shared/censusResourceGeocoder.ts';
import {
  getResourceTableContract,
  isRecordCoordinateProtected,
  RESOURCE_TABLE_CONTRACTS,
  RESOURCE_TABLES,
  type ResourceTableContract,
} from '../_shared/resourceTableContracts.ts';
import { evaluateResourceEligibility } from '../_shared/resourceEligibility.ts';
import { canonicalizeAddress } from '../_shared/geocodeNormalize.ts';
import { stampGeocodeTag } from '../_shared/geocodeTags.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Max IDs accepted per request — bounds provider work per invocation. */
const MAX_IDS = 200;
/** Max unique addresses externally resolved per dry-run request. */
const MAX_DRY_RUN_ADDRESSES = 60;

interface Outcome {
  id: string;
  status: 'geocoded' | 'failed' | 'skipped';
  strategy?: string;
  confidence?: string;
  latitude?: number;
  longitude?: number;
  reason?: string;
  cache_hit?: boolean;
  geocode_provider?: string | null;
}

// deno-lint-ignore no-explicit-any
type Db = any;

/** Authenticated Admin/SysOp only. Ops is read-only; Staff/Viewer/Anon denied. */
const requireAdmin = async (req: Request, admin: Db): Promise<Response | null> => {
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

const callerIdentity = async (req: Request, admin: Db) => {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  const { data } = await admin.auth.getUser(token);
  return { id: data?.user?.id ?? null, email: data?.user?.email ?? null };
};

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Phase 2D.1 — eligibility now lives in `_shared/resourceEligibility.ts` so the
 * single-record function enforces identical semantics.
 */
const eligibility = (
  record: Record<string, unknown>,
  contract: ResourceTableContract,
  force: boolean,
): { eligible: boolean; reason?: string } =>
  evaluateResourceEligibility(record, contract, { force });


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const denied = await requireAdmin(req, supabase);
    if (denied) return denied;

    const payload = await req.json().catch(() => null) as
      | { table?: string; tables?: unknown; ids?: unknown; force?: boolean; mode?: string; limit?: number }
      | null;

    const secretEarly = Deno.env.get('GEOCODE_CACHE_HMAC_SECRET');

    /**
     * Phase 2D.1 §9 — ONE combined cross-table dry-run. No `table` is required:
     * the report covers every canonical RESOURCE_TABLE_CONTRACTS entry and
     * deduplicates Census calls by canonical resource-address identity ACROSS
     * tables. Strictly read-only.
     */
    if (payload?.mode === 'dry_run_revalidation') {
      const requested = Array.isArray(payload.tables)
        ? payload.tables.map((t) => String(t))
        : payload.table
          ? [String(payload.table)]
          : RESOURCE_TABLES;
      const tables = requested.filter((t) => !!getResourceTableContract(t));
      if (tables.length === 0) {
        return json({ error: 'invalid_table', supported_tables: RESOURCE_TABLES }, 400);
      }
      return await runCombinedDryRun(supabase, tables, payload?.limit);
    }

    const table = payload?.table;
    const contract = getResourceTableContract(table);
    if (!table || !contract) {
      return json(
        { error: 'invalid_table', supported_tables: RESOURCE_TABLES },
        400,
      );
    }

    const secret = secretEarly;
    if (!secret) return json({ error: 'geocode_cache_secret_missing' }, 500);

    const actor = await callerIdentity(req, supabase);


    // ── Stable explicit ID batching ────────────────────────────────────────
    const rawIds = Array.isArray(payload?.ids) ? payload!.ids : null;
    if (!rawIds) {
      return json({
        error: 'ids_required',
        detail: 'Offset-based batching over a mutable unresolved set is retired. Submit explicit record ids.',
      }, 400);
    }
    const ids = [...new Set(rawIds.map((v) => String(v)).filter(Boolean))];
    if (ids.length === 0) {
      return json({ total: 0, geocoded: 0, failed: 0, skipped: 0, cache_hits: 0, external_calls: 0, outcomes: [] });
    }
    if (ids.length > MAX_IDS) {
      return json({ error: 'too_many_ids', max_ids: MAX_IDS }, 400);
    }

    const force = !!payload?.force;

    const { data: rows, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .in('id', ids);
    if (fetchErr) return json({ error: 'record_lookup_failed' }, 500);

    const byId = new Map<string, Record<string, unknown>>(
      (rows ?? []).map((r: Record<string, unknown>) => [String(r.id), r]),
    );

    const outcomes: Outcome[] = [];
    let geocoded = 0, failed = 0, skipped = 0, cacheHits = 0, externalCalls = 0;
    /** Per-request memo so a duplicate exact address resolves externally once. */
    const memo = new Map<string, ResolveResourceResult>();

    // Every supplied ID is processed exactly once, in the caller's order.
    for (const id of ids) {
      const record = byId.get(id);
      if (!record) {
        outcomes.push({ id, status: 'skipped', reason: 'record_not_found' });
        skipped++;
        continue;
      }

      const gate = eligibility(record, contract, force);
      if (!gate.eligible) {
        outcomes.push({ id, status: 'skipped', reason: gate.reason });
        skipped++;
        continue;
      }

      const address = buildResourceAddress(record as never);
      let validation: CensusValidationDetail | null = null;
      let resolution: ResolveResourceResult;

      try {
        const cached = memo.get(address);
        if (cached && !force) {
          resolution = { ...cached, cache_hit: true, external_calls: 0, cache_written: false };
        } else {
          const ports = createResourceCachePorts(supabase, secret, [
            createCensusPort({
              source: {
                street_address: record.street_address as string | null,
                city: record.city as string | null,
                state: (record.state as string | null) ?? 'NV',
                zip: record.zip as string | null,
              },
              requireNevada: true,
              onValidation: (d) => { validation = d; },
            }),
          ]);
          resolution = await resolveResourceAddress(ports, {
            address,
            force,
            requireNevada: true,
          });
          memo.set(address, resolution);
        }
      } catch {
        // One record failing must never abort unrelated records.
        outcomes.push({ id, status: 'failed', reason: 'record_resolution_error' });
        failed++;
        continue;
      }

      externalCalls += resolution.external_calls;

      if (resolution.resolved && finite(resolution.lat) && finite(resolution.lng)) {
        const strategy = resolution.cache_hit
          ? 'internal_cache'
          : (resolution.match_type ?? 'census_onelineaddress');
        const confidence = resolution.confidence ?? 'low';

        const update: Record<string, unknown> = {
          [contract.latColumn]: resolution.lat,
          [contract.lngColumn]: resolution.lng,
        };
        if (contract.hasProvenanceColumns) {
          update.geocoded_lat = resolution.lat;
          update.geocoded_lng = resolution.lng;
          // HOW THIS RECORD got it vs HOW IT WAS ORIGINALLY resolved.
          update.coordinate_source = resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider;
          update.coordinate_confidence = resolution.confidence;
          update.geocode_provider = resolution.geocode_provider;
          update.geocode_match_type = resolution.match_type;
          update.last_geocoded_at = new Date().toISOString();
        }
        if (contract.hasAccessNotes) {
          // Tag-only edit: human operational content is preserved verbatim.
          update.access_notes = stampGeocodeTag(
            record.access_notes as string | null,
            strategy,
            confidence,
          );
        }

        const { error: upErr } = await supabase.from(table).update(update).eq('id', id);
        if (upErr) {
          outcomes.push({ id, status: 'failed', reason: 'record_update_failed' });
          failed++;
        } else {
          outcomes.push({
            id,
            status: 'geocoded',
            strategy,
            confidence,
            latitude: resolution.lat!,
            longitude: resolution.lng!,
            cache_hit: resolution.cache_hit,
            geocode_provider: resolution.geocode_provider,
          });
          geocoded++;
          if (resolution.cache_hit) cacheHits++;
        }
      } else {
        // Failure stamps the record for review. Reusable internal cache
        // knowledge is never written or damaged on failure.
        const update: Record<string, unknown> = {};
        if (contract.hasProvenanceColumns) {
          update.coordinate_source = 'failed';
          // Never attribute a failure to a provider that was not called.
          update.geocode_provider = null;
          update.coordinate_confidence = 'failed';
          update.geocode_match_type = null;
          update.last_geocoded_at = new Date().toISOString();
        }
        if (contract.hasAccessNotes) {
          update.access_notes = stampGeocodeTag(record.access_notes as string | null, 'failed', 'low');
        }
        if (Object.keys(update).length > 0) {
          await supabase.from(table).update(update).eq('id', id);
        }
        outcomes.push({ id, status: 'failed', reason: resolution.failure ?? 'unresolved' });
        failed++;
      }

      await writeAudit(supabase, contract, table, id, actor, {
        geocode: true,
        resolution_path: resolution.cache_hit ? 'internal_cache' : 'census_external',
        cache_hit: resolution.cache_hit,
        original_provider: resolution.geocode_provider,
        cache_classification: resolution.cache_classification ?? null,
        confidence: resolution.confidence,
        match_type: resolution.match_type,
        validation_status: validation?.validation_status ?? null,
        state_match: validation?.state_match ?? null,
        zip_match: validation?.zip_match ?? null,
        house_number_match: validation?.house_number_match ?? null,
        street_name_match: validation?.street_name_match ?? null,
        matched_address_available: validation?.matched_address_available ?? null,
        // Phase 2D.1 §5 — legacy provider supersession visibility.
        previous_provider: (record.geocode_provider as string | null) ?? null,
        previous_coordinate_source: (record.coordinate_source as string | null) ?? null,
        new_provider: resolution.geocode_provider,
        new_coordinate_source: resolution.cache_hit ? 'internal_cache' : resolution.geocode_provider,
        previous_latitude: finite(record[contract.latColumn]) ? record[contract.latColumn] : null,
        previous_longitude: finite(record[contract.lngColumn]) ? record[contract.lngColumn] : null,
        new_latitude: resolution.lat,
        new_longitude: resolution.lng,
        distance_meters:
          finite(record[contract.latColumn]) && finite(record[contract.lngColumn]) &&
          finite(resolution.lat) && finite(resolution.lng)
            ? Math.round(geodesicMeters(
                record[contract.latColumn] as number,
                record[contract.lngColumn] as number,
                resolution.lat as number,
                resolution.lng as number,
              ))
            : null,
        legacy_provider_superseded:
          record.geocode_provider === 'google' || record.geocode_provider === 'nominatim',
        status: resolution.resolved ? 'resolved' : 'failed',
        forced: force,
      });


      // Provider courtesy delay only when an external call actually happened.
      if (resolution.external_calls > 0) await delay(400);
    }

    return json({
      total: ids.length,
      geocoded,
      failed,
      skipped,
      cache_hits: cacheHits,
      external_calls: externalCalls,
      active_external_provider: 'census',
      outcomes,
    });
  } catch {
    return json({ error: 'geocode_bulk_internal_error' }, 500);
  }
});

const writeAudit = async (
  db: Db,
  contract: ResourceTableContract,
  table: string,
  id: string,
  actor: { id: string | null; email: string | null },
  details: Record<string, unknown>,
) => {
  try {
    await db.from('mapping_audit_log').insert({
      pipeline: contract.auditPipeline,
      action: 'record_edited',
      target_table: table,
      target_row_id: id,
      actor_id: actor.id,
      actor_email: actor.email,
      details,
    });
  } catch {
    // Audit failure must not abort geocoding.
  }
};

