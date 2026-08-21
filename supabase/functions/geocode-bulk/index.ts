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
const MAX_DRY_RUN_ADDRESSES = 250;

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
      | { table?: string; tables?: unknown; ids?: unknown; force?: boolean; mode?: string; limit?: number; offset?: number }
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
      return await runCombinedDryRun(supabase, tables, payload?.limit, payload?.offset);
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


/* ────────────────────────────────────────────────────────────────────────────
 * Phase 2D.1 §6-§12 — COMBINED, READ-ONLY legacy revalidation dry-run.
 *
 * One report across every canonical resource table. Guarantees:
 *   - address identity uses the SAME canonical identity as the real cache
 *     (buildResourceAddress → canonicalizeAddress), never raw formatting
 *   - Census is called once per unique canonical address, deduplicated ACROSS
 *     tables
 *   - EVERY record sharing an address gets its own existing-coordinate
 *     comparison and its own distance_meters
 *   - counters are truthful and distinct
 *   - ZERO writes: no cache upsert, no `touch`, no counter increments, no
 *     canonical/staging/manual coordinate or provenance changes
 * ──────────────────────────────────────────────────────────────────────────── */

interface DryRunRecordRef {
  table: string;
  contract: ResourceTableContract;
  record: Record<string, unknown>;
}

const DRY_RUN_MAX_ROWS_PER_TABLE = 2000;
/** Full per-record comparisons inlined in the response before summarizing. */
const DRY_RUN_MAX_INLINE_COMPARISONS = 400;

const percentile = (sorted: number[], p: number): number | null => {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

/** Factual reporting buckets only — no bucket is labelled correct/incorrect. */
const bucketDistance = (m: number): string => {
  if (m <= 25) return '0-25m';
  if (m <= 100) return '25-100m';
  if (m <= 500) return '100-500m';
  if (m <= 1000) return '500m-1km';
  if (m <= 5000) return '1-5km';
  return '>5km';
};

const runCombinedDryRun = async (
  db: Db,
  tables: string[],
  limit?: number,
  offset?: number,
): Promise<Response> => {
  const cap = Math.min(
    Math.max(Number(limit ?? MAX_DRY_RUN_ADDRESSES) || MAX_DRY_RUN_ADDRESSES, 1),
    MAX_DRY_RUN_ADDRESSES,
  );
  /**
   * Deterministic slicing over the canonical address list. Inventory and
   * cross-table grouping are always computed over EVERY table, so slicing can
   * never change how addresses are deduplicated — it only bounds how many
   * Census calls a single invocation performs.
   */
  const startAt = Math.max(0, Number(offset ?? 0) || 0);


  const perTable: Record<string, Record<string, number>> = {};
  /** canonical address identity → every record sharing it, across tables. */
  const groups = new Map<string, { source: Record<string, unknown>; refs: DryRunRecordRef[] }>();

  let recordsWithLegacy = 0;
  let recordsMissingStreet = 0;
  let recordsWithoutIdentity = 0;
  let protectedRecords = 0;

  for (const table of tables) {
    const contract = getResourceTableContract(table)!;
    const { data: rows, error } = await db
      .from(table)
      .select('*')
      .in('geocode_provider', ['google', 'nominatim'])
      .limit(DRY_RUN_MAX_ROWS_PER_TABLE);

    if (error) {
      perTable[table] = { lookup_failed: 1 };
      continue;
    }

    const records = (rows ?? []) as Record<string, unknown>[];
    const t = {
      records_with_legacy_provenance: records.length,
      records_missing_street_address: 0,
      records_without_deterministic_address_identity: 0,
      protected_records: 0,
      google_records: 0,
      nominatim_records: 0,
    };

    for (const r of records) {
      if (r.geocode_provider === 'google') t.google_records++;
      if (r.geocode_provider === 'nominatim') t.nominatim_records++;
      if (isRecordCoordinateProtected(r, contract)) {
        t.protected_records++;
        protectedRecords++;
      }
      if (!r.street_address) {
        t.records_missing_street_address++;
        recordsMissingStreet++;
        continue;
      }
      const assembled = buildResourceAddress(r as never);
      if (!hasDeterministicIdentity(assembled)) {
        t.records_without_deterministic_address_identity++;
        recordsWithoutIdentity++;
        continue;
      }
      // SAME identity function the real cache keys on.
      const identity = canonicalizeAddress(assembled).canonical;
      const g = groups.get(identity);
      if (g) g.refs.push({ table, contract, record: r });
      else groups.set(identity, { source: r, refs: [{ table, contract, record: r }] });
    }

    recordsWithLegacy += records.length;
    perTable[table] = t;
  }

  // Cache-side provenance tally (provenance only; addresses are HMAC-keyed and
  // are NOT readable, so cache rows cannot be revalidated on their own).
  const { data: cacheRows } = await db
    .from('geocode_resolutions')
    .select('geocode_source')
    .eq('location_class', 'resource_address')
    .limit(5000);
  const cacheTally: Record<string, number> = {
    manual_verified: 0, census: 0, google: 0, nominatim: 0, other_unclassified: 0,
  };
  for (const c of (cacheRows ?? []) as { geocode_source: string }[]) {
    if (Object.prototype.hasOwnProperty.call(cacheTally, c.geocode_source)) {
      cacheTally[c.geocode_source] += 1;
    } else {
      cacheTally.other_unclassified += 1;
    }
  }

  const uniqueGoogleAddresses = new Set<string>();
  const uniqueNominatimAddresses = new Set<string>();
  for (const [identity, g] of groups) {
    for (const ref of g.refs) {
      if (ref.record.geocode_provider === 'google') uniqueGoogleAddresses.add(identity);
      if (ref.record.geocode_provider === 'nominatim') uniqueNominatimAddresses.add(identity);
    }
  }

  const comparisons: Record<string, unknown>[] = [];
  const anomalies: Record<string, unknown>[] = [];
  const distances: number[] = [];
  const rejectionReasons: Record<string, number> = {};
  const unresolvedAddresses: Record<string, unknown>[] = [];

  let censusAttempted = 0, censusResolved = 0, censusUnresolved = 0;
  let validationRejected = 0, recordsCompared = 0;

  const orderedIdentities = [...groups.keys()].sort();
  const slice = orderedIdentities.slice(startAt, startAt + cap);

  for (const identity of slice) {
    const g = groups.get(identity)!;
    censusAttempted++;


    const src = g.source;
    let validation: CensusValidationDetail | null = null;
    const port = createCensusPort({
      source: {
        street_address: src.street_address as string | null,
        city: src.city as string | null,
        state: (src.state as string | null) ?? 'NV',
        zip: src.zip as string | null,
      },
      requireNevada: true,
      onValidation: (d) => { validation = d; },
    });

    // ONE Census call per unique canonical address, across all tables.
    const hit = await port.run(buildResourceAddress(src as never)).catch(() => null);
    if (hit) censusResolved++;
    else censusUnresolved++;

    const v = validation as CensusValidationDetail | null;
    if (v && v.validation_status === 'rejected') {
      validationRejected++;
      const reason = v.rejection_reason ?? 'unspecified';
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    }
    if (!hit) {
      unresolvedAddresses.push({
        record_count: g.refs.length,
        tables: [...new Set(g.refs.map((r) => r.table))],
        city: src.city ?? null,
        zip: src.zip ?? null,
        validation: v,
      });
    }

    // EVERY record sharing this address is compared on its OWN coordinate.
    for (const ref of g.refs) {
      const r = ref.record;
      const existingLat = r[ref.contract.latColumn];
      const existingLng = r[ref.contract.lngColumn];
      const mLat = ref.contract.manualLatColumn ? r[ref.contract.manualLatColumn] : null;
      const mLng = ref.contract.manualLngColumn ? r[ref.contract.manualLngColumn] : null;
      const distance =
        hit && finite(existingLat) && finite(existingLng)
          ? Math.round(geodesicMeters(existingLat as number, existingLng as number, hit.lat, hit.lng))
          : null;
      if (distance !== null) distances.push(distance);
      recordsCompared++;

      const row = {
        table: ref.table,
        id: r.id,
        name: r.name,
        existing_provider: r.geocode_provider ?? null,
        existing_coordinate_source: r.coordinate_source ?? null,
        existing_confidence: r.coordinate_confidence ?? null,
        existing_latitude: finite(existingLat) ? existingLat : null,
        existing_longitude: finite(existingLng) ? existingLng : null,
        coordinate_locked: r.coordinate_locked ?? null,
        manual_coordinate_present: finite(mLat) && finite(mLng),
        protected: isRecordCoordinateProtected(r, ref.contract),
        existing_provenance_class: classifyResourceCacheSource(r.geocode_provider as string | null),
        census_resolved: !!hit,
        census_latitude: hit ? hit.lat : null,
        census_longitude: hit ? hit.lng : null,
        census_validation_status: v?.validation_status ?? null,
        census_rejection_reason: v?.rejection_reason ?? null,
        house_number_match: v?.house_number_match ?? null,
        street_name_match: v?.street_name_match ?? null,
        state_match: v?.state_match ?? null,
        zip_match: v?.zip_match ?? null,
        distance_meters: distance,
        distance_bucket: distance === null ? null : bucketDistance(distance),
        address_identity: identity,
      };
      comparisons.push(row);
      // Anomalies are never omitted from the response.
      if (!hit || v?.validation_status === 'rejected' || distance === null || distance > 500) {
        anomalies.push(row);
      }
    }

    await delay(200);
  }

  const sorted = [...distances].sort((a, b) => a - b);
  const buckets: Record<string, number> = {
    '0-25m': 0, '25-100m': 0, '100-500m': 0, '500m-1km': 0, '1-5km': 0, '>5km': 0,
  };
  for (const d of distances) buckets[bucketDistance(d)] += 1;

  const largest = [...comparisons]
    .filter((c) => typeof c.distance_meters === 'number')
    .sort((a, b) => (b.distance_meters as number) - (a.distance_meters as number))
    .slice(0, 25);

  const inlineComparisons = comparisons.length <= DRY_RUN_MAX_INLINE_COMPARISONS
    ? comparisons
    : anomalies;

  return json({
    mode: 'dry_run_revalidation',
    mutated: false,
    read_only: true,
    generated_at: new Date().toISOString(),
    tables_included: tables,
    active_external_provider: 'census',
    identity_methodology: 'buildResourceAddress -> canonicalizeAddress (same identity as resource_address cache)',
    census_call_dedup: 'one call per unique canonical address, deduplicated across all tables',
    totals: {
      records_with_legacy_provenance: recordsWithLegacy,
      records_missing_street_address: recordsMissingStreet,
      records_without_deterministic_address_identity: recordsWithoutIdentity,
      unique_canonical_legacy_addresses: groups.size,
      unique_google_addresses: uniqueGoogleAddresses.size,
      unique_nominatim_addresses: uniqueNominatimAddresses.size,
      census_attempted: censusAttempted,
      census_resolved: censusResolved,
      census_unresolved: censusUnresolved,
      validation_rejected: validationRejected,
      protected_records: protectedRecords,
      records_compared: recordsCompared,
      attempt_cap: cap,
      slice_offset: startAt,
      addresses_not_attempted_in_this_slice: Math.max(0, groups.size - (startAt + censusAttempted)),
      next_offset: startAt + censusAttempted < groups.size ? startAt + censusAttempted : null,
    },
    resource_cache_provenance: cacheTally,
    cache_revalidation_note:
      'resource_address cache rows are HMAC-keyed; a cache row cannot be externally revalidated without a corresponding canonical address record.',
    per_table: perTable,
    distance_distribution: {
      count: sorted.length,
      minimum: sorted[0] ?? null,
      median: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
      p95: percentile(sorted, 95),
      maximum: sorted[sorted.length - 1] ?? null,
      buckets,
    },
    largest_differences: largest,
    validation_rejection_reasons: rejectionReasons,
    unresolved_addresses: unresolvedAddresses,
    anomalies,
    comparisons: inlineComparisons,
    omitted_comparison_count: comparisons.length - inlineComparisons.length,
  });
};
