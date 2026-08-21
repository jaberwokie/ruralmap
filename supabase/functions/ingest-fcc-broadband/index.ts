/**
 * FCC broadband ingestion endpoint (server-side only) — Phase 2A.1.
 *
 * Admin/sysop authenticated. FCC BDC Public Data API credentials and the
 * service-role key never leave the edge runtime and are never persisted.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync, strFromU8 } from 'https://esm.sh/fflate@0.8.2';
import {
  EVIDENCE_BUCKET,
  SOURCE_KEY,
  runFccBroadbandIngestion,
  type FccIngestionPorts,
} from './fccPipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // ── Caller authorization: admin or sysop only ──
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const [{ data: isAdmin }, { data: isSysop }] = await Promise.all([
    userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' }),
    userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'sysop' }),
  ]);
  if (!isAdmin && !isSysop) return json({ error: 'Forbidden' }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body is allowed */ }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ports: FccIngestionPorts = {
    now: () => new Date(),
    readEnv: (name) => Deno.env.get(name),

    async getSource(sourceKey) {
      const { data, error } = await admin
        .from('data_sources')
        .select('id, source_url')
        .eq('source_key', sourceKey)
        .maybeSingle();
      if (error) throw new Error(`registry lookup failed: ${error.message}`);
      return data ?? null;
    },

    async getJson(url, headers) {
      const res = await fetch(url, { headers });
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        text: await res.text(),
      };
    },

    async getBytes(url, headers) {
      const res = await fetch(url, { headers });
      const buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        bytes: buf,
      };
    },

    async sha256(bytes) {
      return toHex(await crypto.subtle.digest('SHA-256', bytes));
    },

    async putEvidence(path, bytes, contentType) {
      const { error } = await admin.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      // A duplicate path means identical bytes were already stored (the path
      // embeds the content hash), so treat it as satisfied.
      if (error && !/exists|duplicate/i.test(error.message)) {
        throw new Error(`evidence write failed: ${error.message}`);
      }
      return path;
    },

    async unzipCsv(bytes) {
      const files = unzipSync(bytes);
      const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.csv'));
      if (!name) throw new Error('archive contains no CSV member');
      return strFromU8(files[name]);
    },

    async startRun(sourceId, startedAt) {
      const { data, error } = await admin
        .from('data_source_runs')
        .insert({
          source_id: sourceId,
          run_type: 'ingest',
          status: 'running',
          started_at: startedAt,
          initiated_by: userData.user!.id,
        })
        .select('id')
        .single();
      if (error) throw new Error(`could not open run: ${error.message}`);
      return data.id as string;
    },

    async insertSnapshot(input) {
      const { data, error } = await admin
        .from('data_source_snapshots')
        .insert(input)
        .select('id')
        .single();
      if (error) throw new Error(`snapshot write failed: ${error.message}`);
      return data.id as string;
    },

    async getCarriedValues() {
      const { data, error } = await admin
        .from('broadband_county_coverage')
        .select('county_key, fiber_share, cable_share, fixed_wireless_share, satellite_share, coverage_unevenness, notes');
      if (error) throw new Error(`carried-value lookup failed: ${error.message}`);
      return data ?? [];
    },

    async getPreviousTiers() {
      const { data, error } = await admin
        .from('broadband_county_coverage')
        .select('county_key, pct_100_20_plus, pct_25_3_to_100_20, pct_below_25_3');
      if (error) throw new Error(`comparison lookup failed: ${error.message}`);
      return data ?? [];
    },

    async replaceNormalized(input) {
      const { data, error } = await admin.rpc('replace_broadband_county_coverage', {
        _source_id: input.source_id,
        _snapshot_id: input.snapshot_id,
        _rows: input.rows,
        _effective_date: input.effective_date,
        _source_version: input.source_version,
      });
      if (error) throw new Error(`normalized persistence failed: ${error.message}`);
      return Number(data ?? 0);
    },

    async completeRun(runId, patch) {
      const { error } = await admin.from('data_source_runs').update(patch).eq('id', runId);
      if (error) console.error('[ingest-fcc-broadband] run update failed:', error.message);
    },

    async updateSourceHealth(sourceId, patch) {
      const { error } = await admin.from('data_sources').update(patch).eq('id', sourceId);
      if (error) console.error('[ingest-fcc-broadband] source health update failed:', error.message);
    },
  };

  try {
    const result = await runFccBroadbandIngestion(ports, {
      asOfDate: typeof body.as_of_date === 'string' ? body.as_of_date : null,
      dryRun: body.dry_run === true,
    });
    return json(result, result.ok ? 200 : 422);
  } catch (err) {
    console.error('[ingest-fcc-broadband] unexpected failure:', err);
    return json({ ok: false, source_key: SOURCE_KEY, error: 'Ingestion failed' }, 500);
  }
});
