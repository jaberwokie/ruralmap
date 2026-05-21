/**
 * Admin > Geocode Review
 *
 * Review queue across facilities, rural_services, verified_services, verified_bh,
 * and staging_providers for low-confidence (geometric / approximate) or failed
 * Google geocoding results. Admins can:
 *   - Lock & Approve the current geocoded coordinates
 *   - Re-geocode (force) via the geocode-address edge function
 *   - Edit coordinates manually (writes manual_lat/manual_lng + locks)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SourceTable =
  | 'facilities'
  | 'rural_services'
  | 'verified_services'
  | 'verified_bh'
  | 'staging_providers';
type TableFilter = SourceTable | 'all';

interface ReviewRow {
  table: SourceTable;
  id: string;
  name: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  coordinate_source: string | null;
  coordinate_confidence: string | null;
  geocode_match_type: string | null;
  lat: number | null;
  lng: number | null;
}

// Tables that store coordinates as lat/lng (production). staging_providers uses latitude/longitude.
const PRODUCTION_TABLES: SourceTable[] = [
  'facilities',
  'rural_services',
  'verified_services',
  'verified_bh',
];

const TABLE_LABELS: Record<SourceTable, string> = {
  facilities: 'Facilities',
  rural_services: 'Rural Services',
  verified_services: 'Verified Services',
  verified_bh: 'Verified BH',
  staging_providers: 'Staging Providers',
};

const TABLE_LABELS_SHORT: Record<SourceTable, string> = {
  facilities: 'facilities',
  rural_services: 'rural services',
  verified_services: 'verified services',
  verified_bh: 'verified BH',
  staging_providers: 'staging providers',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  rooftop: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  range: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  geometric: 'bg-orange-100 text-orange-800 border-orange-300',
  approximate: 'bg-red-100 text-red-800 border-red-300',
  failed: 'bg-red-200 text-red-950 border-red-500',
};

const REVIEW_OR_FILTER =
  'coordinate_source.eq.failed,and(coordinate_source.eq.google,coordinate_confidence.in.(geometric,approximate))';

const confidenceLabel = (row: ReviewRow): string => {
  if (row.coordinate_source === 'failed') return 'failed';
  return row.coordinate_confidence ?? 'unknown';
};

export default function AdminGeocodeReview() {
  const perms = usePermissions();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [backfillPending, setBackfillPending] = useState<Record<string, number> | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ current: number; total: number } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchBackfillCount = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const t of PRODUCTION_TABLES) {
      const { count, error } = await supabase
        .from(t)
        .select('id', { count: 'exact', head: true })
        .is('geocoded_lat', null)
        .not('street_address', 'is', null)
        .not('coordinate_locked', 'is', true);
      if (error) {
        console.warn(`[backfill count] ${t}`, error.message);
        counts[t] = 0;
      } else {
        counts[t] = count ?? 0;
      }
    }
    setBackfillPending(counts);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const buildProdQuery = (t: Exclude<SourceTable, 'staging_providers'>) =>
        supabase
          .from(t)
          .select(
            'id,name,street_address,city,state,zip,coordinate_source,coordinate_confidence,geocode_match_type,lat,lng',
          )
          .or(REVIEW_OR_FILTER);

      const stagingQuery = supabase
        .from('staging_providers')
        .select(
          'id,name,street_address,city,state,zip,coordinate_source,coordinate_confidence,geocode_match_type,latitude,longitude',
        )
        .or(REVIEW_OR_FILTER);

      const [facResp, rsvResp, vsvResp, vbhResp, stgResp] = await Promise.all([
        buildProdQuery('facilities'),
        buildProdQuery('rural_services'),
        buildProdQuery('verified_services'),
        buildProdQuery('verified_bh'),
        stagingQuery,
      ]);

      for (const r of [facResp, rsvResp, vsvResp, vbhResp, stgResp]) {
        if (r.error) throw r.error;
      }

      const mapProd = (table: SourceTable, data: any[] | null): ReviewRow[] =>
        (data ?? []).map((r: any) => ({
          table,
          id: r.id,
          name: r.name,
          street_address: r.street_address,
          city: r.city,
          state: r.state,
          zip: r.zip,
          coordinate_source: r.coordinate_source,
          coordinate_confidence: r.coordinate_confidence,
          geocode_match_type: r.geocode_match_type,
          lat: r.lat,
          lng: r.lng,
        }));

      const stgRows: ReviewRow[] = (stgResp.data ?? []).map((r: any) => ({
        table: 'staging_providers',
        id: r.id,
        name: r.name,
        street_address: r.street_address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        coordinate_source: r.coordinate_source,
        coordinate_confidence: r.coordinate_confidence,
        geocode_match_type: r.geocode_match_type,
        lat: r.latitude,
        lng: r.longitude,
      }));

      const all = [
        ...mapProd('facilities', facResp.data),
        ...mapProd('rural_services', rsvResp.data),
        ...mapProd('verified_services', vsvResp.data),
        ...mapProd('verified_bh', vbhResp.data),
        ...stgRows,
      ].sort((a, b) => a.name.localeCompare(b.name));

      setRows(all);
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? String(err);
      console.error('[AdminGeocodeReview] fetchRows failed:', err);
      setFetchError(msg);
      toast({
        title: 'Failed to load geocode review queue',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const runBackfill = useCallback(async () => {
    setBackfillRunning(true);
    try {
      // Collect ids across all production tables
      const targets: Array<{ table: SourceTable; id: string }> = [];
      for (const t of PRODUCTION_TABLES) {
        const { data, error } = await supabase
          .from(t)
          .select('id')
          .is('geocoded_lat', null)
          .not('street_address', 'is', null)
          .not('coordinate_locked', 'is', true);
        if (error) {
          console.warn(`[backfill load] ${t}`, error.message);
          continue;
        }
        for (const r of data ?? []) targets.push({ table: t, id: (r as any).id as string });
      }

      const total = targets.length;
      setBackfillProgress({ current: 0, total });
      if (total === 0) {
        toast({ title: 'Backfill complete', description: 'No records need geocoding' });
        return;
      }

      let failures = 0;
      for (let i = 0; i < targets.length; i++) {
        const { table, id } = targets[i];
        try {
          const { error: invokeError } = await supabase.functions.invoke('geocode-address', {
            body: { table, id },
          });
          if (invokeError) {
            failures += 1;
            console.warn(`[backfill] ${table}/${id} failed:`, invokeError.message ?? invokeError);
          }
        } catch (err: any) {
          failures += 1;
          console.warn(`[backfill] ${table}/${id} threw:`, err?.message ?? err);
        }
        setBackfillProgress({ current: i + 1, total });
        if (i < targets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      toast({
        title: 'Backfill complete',
        description: `Processed ${total} · ${failures} failed`,
      });
    } catch (err: any) {
      toast({ title: 'Backfill failed', description: err?.message ?? String(err), variant: 'destructive' });
    } finally {
      setBackfillRunning(false);
      setBackfillProgress(null);
      await fetchBackfillCount();
      await fetchRows();
    }
  }, [fetchBackfillCount, fetchRows]);

  useEffect(() => {
    if (perms.ready && (perms.isAdmin || perms.isStaff)) {
      void fetchRows();
      void fetchBackfillCount();
    }
  }, [perms.ready, perms.isAdmin, perms.isStaff, fetchRows, fetchBackfillCount]);

  const filtered = useMemo(
    () => (tableFilter === 'all' ? rows : rows.filter((r) => r.table === tableFilter)),
    [rows, tableFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length, geometric: 0, approximate: 0, failed: 0 };
    rows.forEach((r) => {
      const key = confidenceLabel(r);
      c[key] = (c[key] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const backfillTotal = useMemo(() => {
    if (!backfillPending) return null;
    return PRODUCTION_TABLES.reduce((sum, t) => sum + (backfillPending[t] ?? 0), 0);
  }, [backfillPending]);

  const backfillSummary = useMemo(() => {
    if (!backfillPending) return 'Checking…';
    return PRODUCTION_TABLES.map((t) => `${backfillPending[t] ?? 0} ${TABLE_LABELS_SHORT[t]}`).join(' · ') + ' need geocoding';
  }, [backfillPending]);

  const rowKey = (r: ReviewRow) => `${r.table}:${r.id}`;

  const handleLockApprove = async (r: ReviewRow) => {
    setBusyId(rowKey(r));
    try {
      const { error } = await supabase
        .from(r.table)
        .update({ coordinate_locked: true, coordinate_source: 'manual' })
        .eq('id', r.id);
      if (error) throw error;
      toast({ title: 'Locked & approved', description: r.name });
      setRows((prev) => prev.filter((x) => rowKey(x) !== rowKey(r)));
    } catch (err: any) {
      toast({ title: 'Lock failed', description: err?.message ?? String(err), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRegeocode = async (r: ReviewRow) => {
    setBusyId(rowKey(r));
    try {
      const { error } = await supabase.functions.invoke('geocode-address', {
        body: { table: r.table, id: r.id, force: true },
      });
      if (error) throw error;
      toast({ title: 'Re-geocoded', description: r.name });
      await fetchRows();
    } catch (err: any) {
      toast({ title: 'Re-geocode failed', description: err?.message ?? String(err), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (r: ReviewRow) => {
    setEditingId(rowKey(r));
    setEditLat(r.lat != null ? String(r.lat) : '');
    setEditLng(r.lng != null ? String(r.lng) : '');
  };

  const handleSaveEdit = async (r: ReviewRow) => {
    const lat = Number(editLat);
    const lng = Number(editLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({ title: 'Invalid coordinates', description: 'Enter numeric lat and lng', variant: 'destructive' });
      return;
    }
    setBusyId(rowKey(r));
    try {
      if (r.table === 'staging_providers') {
        const { error } = await supabase
          .from('staging_providers')
          .update({
            latitude: lat,
            longitude: lng,
            coordinate_locked: true,
            coordinate_source: 'manual',
          })
          .eq('id', r.id);
        if (error) throw error;
      } else {
        const update: Record<string, unknown> = {
          lat,
          lng,
          coordinate_locked: true,
          coordinate_source: 'manual',
        };
        // facilities, rural_services, verified_services, verified_bh all have manual_lat/manual_lng
        update.manual_lat = lat;
        update.manual_lng = lng;
        const { error } = await supabase.from(r.table).update(update).eq('id', r.id);
        if (error) throw error;
      }
      toast({ title: 'Coordinates saved', description: r.name });
      setEditingId(null);
      setRows((prev) => prev.filter((x) => rowKey(x) !== rowKey(r)));
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message ?? String(err), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (perms.ready && !perms.isAdmin && !perms.isStaff) {
    return <Navigate to="/" replace />;
  }

  const FILTER_OPTIONS: TableFilter[] = [
    'all',
    'facilities',
    'rural_services',
    'verified_services',
    'verified_bh',
    'staging_providers',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Admin
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Back to Map</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>
            Geocode Review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Facilities, rural services, verified services, verified BH, and staging providers with low-confidence or
            failed Google geocoding results. Approve, re-geocode, or manually correct coordinates.
          </p>
        </header>

        {/* Backfill (admin only) */}
        {perms.isAdmin ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-card p-3">
            <div className="text-sm">
              <span className="font-medium">Backfill ungeocoded records</span>
              <span className="ml-2 text-muted-foreground">{backfillSummary}</span>
            </div>
            <Button
              size="sm"
              disabled={backfillRunning || (backfillTotal ?? 0) === 0}
              onClick={runBackfill}
            >
              {backfillRunning && backfillProgress
                ? `Geocoding ${backfillProgress.current} of ${backfillProgress.total}…`
                : backfillRunning
                  ? 'Starting…'
                  : 'Run Backfill'}
            </Button>
          </div>
        ) : null}


        {/* Summary counts */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <div className="rounded border border-border bg-card px-3 py-1.5">
            <span className="text-muted-foreground">Total:</span>{' '}
            <span className="font-semibold">{counts.total ?? 0}</span>
          </div>
          <div className="rounded border border-orange-300 bg-orange-50 px-3 py-1.5">
            Geometric: <span className="font-semibold">{counts.geometric ?? 0}</span>
          </div>
          <div className="rounded border border-red-300 bg-red-50 px-3 py-1.5">
            Approximate: <span className="font-semibold">{counts.approximate ?? 0}</span>
          </div>
          <div className="rounded border border-red-500 bg-red-100 px-3 py-1.5">
            Failed: <span className="font-semibold">{counts.failed ?? 0}</span>
          </div>
        </div>

        {/* Table filter */}
        <div className="mb-4 flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setTableFilter(opt)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                tableFilter === opt
                  ? 'border-[hsl(var(--brand-health))] bg-[hsl(var(--brand-health)/0.08)] text-[hsl(var(--brand-health))]'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {opt === 'all' ? 'All' : TABLE_LABELS[opt as SourceTable]}
            </button>
          ))}
        </div>

        {/* Diagnostic strip: perms + load state */}
        <div className="mb-3 rounded border border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          perms.ready=<code>{String(perms.ready)}</code> · isAdmin=<code>{String(perms.isAdmin)}</code> · isStaff=
          <code>{String(perms.isStaff)}</code> · loading=<code>{String(loading)}</code> · rows=
          <code>{rows.length}</code>
        </div>

        {fetchError ? (
          <div className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-900">
            <div className="font-semibold">Failed to load geocode review queue</div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs">{fetchError}</pre>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void fetchRows()}>
              Retry
            </Button>
          </div>
        ) : null}

        {!perms.ready ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking permissions…
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading geocode review queue…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No records pending geocode review
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const key = rowKey(r);
              const busy = busyId === key;
              const editing = editingId === key;
              const confKey = confidenceLabel(r);
              return (
                <div key={key} className="rounded border border-border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {r.table}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                            CONFIDENCE_STYLES[confKey] ?? 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {confKey}
                        </span>
                        {r.geocode_match_type ? (
                          <span className="text-[10px] text-muted-foreground">
                            match: <code>{r.geocode_match_type}</code>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[r.street_address, r.city, r.state, r.zip].filter(Boolean).join(', ') || '— no address —'}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        lat: <code>{r.lat ?? '—'}</code> · lng: <code>{r.lng ?? '—'}</code>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" variant="default" disabled={busy} onClick={() => handleLockApprove(r)}>
                        Lock &amp; Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRegeocode(r)}>
                        Re-geocode
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(r)}>
                        Edit Coordinates
                      </Button>
                    </div>
                  </div>

                  {editing ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded border border-border bg-muted/40 p-2">
                      <div>
                        <Label className="text-xs">Latitude</Label>
                        <Input
                          value={editLat}
                          onChange={(e) => setEditLat(e.target.value)}
                          className="h-8 w-36"
                          placeholder="39.12345"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Longitude</Label>
                        <Input
                          value={editLng}
                          onChange={(e) => setEditLng(e.target.value)}
                          className="h-8 w-36"
                          placeholder="-119.12345"
                        />
                      </div>
                      <Button size="sm" disabled={busy} onClick={() => handleSaveEdit(r)}>
                        Save &amp; Lock
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
