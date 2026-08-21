/**
 * FCC broadband ingestion endpoint (server-side only).
 *
 * Admin/sysop authenticated. Privileged writes use the service-role key which
 * never leaves the edge runtime. No secret is stored in the registry tables.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runBroadbandIngestion, type IngestionPorts } from './pipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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

  const ports: IngestionPorts = {
    now: () => new Date(),

    async getSource(sourceKey) {
      const { data, error } = await admin
        .from('data_sources')
        .select('id, source_url')
        .eq('source_key', sourceKey)
        .maybeSingle();
      if (error) throw new Error(`registry lookup failed: ${error.message}`);
      return data ?? null;
    },

    async fetchSource(url) {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      return {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        body: await res.text(),
      };
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
    const result = await runBroadbandIngestion(ports, {
      sourceUrl: typeof body.source_url === 'string' ? body.source_url : null,
      effectiveDate: typeof body.effective_date === 'string' ? body.effective_date : null,
      sourceVersion: typeof body.source_version === 'string' ? body.source_version : null,
    });
    return json(result, result.ok ? 200 : 422);
  } catch (err) {
    console.error('[ingest-fcc-broadband] unexpected failure:', err);
    return json({ ok: false, error: 'Ingestion failed' }, 500);
  }
});
