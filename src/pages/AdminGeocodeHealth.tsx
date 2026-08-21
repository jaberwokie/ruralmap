/**
 * Admin > Geocode Health (Phase 2B)
 *
 * Operational visibility into the internal geocode authority/cache.
 *
 * PRIVACY: this surface never renders a raw address. `geocode_resolutions`
 * stores only a keyed HMAC digest of the canonical address, so no address text
 * exists to display.
 *
 * Access: Ops (read-only aggregate), Admin/SysOp (read + maintenance).
 * Viewer/Staff and Public Safe Mode never reach this route.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, FlaskConical, Download } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { isPublicSafeModeActive } from '@/hooks/usePublicSafeMode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { runCombinedLegacyDryRun } from '@/utils/resourceGeocodeClient';


interface ResolutionRow {
  id: string;
  location_class: string;
  geocode_source: string;
  confidence: string | null;
  precision: string | null;
  county_name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_manual: boolean;
  is_coordinate_locked: boolean;
  verified_at: string | null;
  last_used_at: string;
  use_count: number;
  cache_hit_count: number;
}

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded border border-border bg-card px-3 py-2">
    <div className="text-lg font-semibold leading-none">{value}</div>
    <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
  </div>
);

const Breakdown = ({ title, rows }: { title: string; rows: [string, number][] }) => (
  <div className="rounded border border-border bg-card p-3">
    <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
    {rows.length === 0 ? (
      <div className="text-sm text-muted-foreground">No records yet.</div>
    ) : (
      <ul className="space-y-1">
        {rows.map(([key, count]) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span className="truncate">{key}</span>
            <span className="ml-2 font-medium tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const tally = (rows: ResolutionRow[], pick: (r: ResolutionRow) => string | null): [string, number][] => {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = pick(r) ?? 'unspecified';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * Phase 2D.1 §9-§12 — combined legacy revalidation dry-run.
 *
 * Strictly read-only: the endpoint mutates nothing. Slices exist only to bound
 * external Census work per invocation; grouping/inventory are always computed
 * across every table, so merging slices yields one combined report.
 */
type DryRunReport = Record<string, unknown>;

const mergeSlices = (slices: DryRunReport[]): DryRunReport => {
  const first = slices[0] ?? {};
  const sumKeys = [
    'census_attempted', 'census_resolved', 'census_unresolved',
    'validation_rejected', 'records_compared',
  ];
  const totals: Record<string, unknown> = { ...(first.totals as Record<string, unknown> ?? {}) };
  for (const k of sumKeys) {
    totals[k] = slices.reduce(
      (s, sl) => s + Number((sl.totals as Record<string, unknown> | undefined)?.[k] ?? 0), 0,
    );
  }
  delete totals.slice_offset;
  delete totals.next_offset;
  delete totals.addresses_not_attempted_in_this_slice;
  totals.slices_executed = slices.length;

  const comparisons = slices.flatMap((s) => (s.comparisons as Record<string, unknown>[]) ?? []);
  const anomalies = slices.flatMap((s) => (s.anomalies as Record<string, unknown>[]) ?? []);
  const unresolved = slices.flatMap((s) => (s.unresolved_addresses as Record<string, unknown>[]) ?? []);

  const buckets: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  for (const s of slices) {
    const dist = (s.distance_distribution as Record<string, unknown> | undefined)?.buckets as
      Record<string, number> | undefined;
    for (const [k, v] of Object.entries(dist ?? {})) buckets[k] = (buckets[k] ?? 0) + v;
    for (const [k, v] of Object.entries(
      (s.validation_rejection_reasons as Record<string, number>) ?? {},
    )) reasons[k] = (reasons[k] ?? 0) + v;
  }

  const distances = comparisons
    .map((c) => c.distance_meters)
    .filter((d): d is number => typeof d === 'number')
    .sort((a, b) => a - b);
  const pct = (p: number) =>
    distances.length === 0
      ? null
      : distances[Math.min(distances.length - 1, Math.max(0, Math.ceil((p / 100) * distances.length) - 1))];

  return {
    ...first,
    mode: 'dry_run_revalidation',
    mutated: false,
    read_only: true,
    totals,
    per_table: first.per_table,
    resource_cache_provenance: first.resource_cache_provenance,
    distance_distribution: {
      count: distances.length,
      minimum: distances[0] ?? null,
      median: pct(50),
      p75: pct(75),
      p90: pct(90),
      p95: pct(95),
      maximum: distances[distances.length - 1] ?? null,
      buckets,
    },
    validation_rejection_reasons: reasons,
    unresolved_addresses: unresolved,
    anomalies,
    comparisons,
    largest_differences: [...comparisons]
      .filter((c) => typeof c.distance_meters === 'number')
      .sort((a, b) => (b.distance_meters as number) - (a.distance_meters as number))
      .slice(0, 25),
  };
};


export default function AdminGeocodeHealth() {
  const perms = usePermissions();
  const [rows, setRows] = useState<ResolutionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const canRead = perms.canAccessOps;
  const canWrite = perms.isAdmin;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('geocode_resolutions')
      .select('id, location_class, geocode_source, confidence, precision, county_name, latitude, longitude, is_manual, is_coordinate_locked, verified_at, last_used_at, use_count, cache_hit_count')
      .order('last_used_at', { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: 'Could not load geocode health', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data ?? []) as ResolutionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canRead) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const metrics = useMemo(() => {
    const resolved = rows.filter(r => r.latitude !== null && r.longitude !== null);
    const unresolved = rows.filter(r => r.latitude === null || r.longitude === null);
    const verified = resolved.filter(r => r.is_manual || r.is_coordinate_locked || r.geocode_source === 'manual_verified');
    const automated = resolved.filter(r => ['google', 'census', 'nominatim'].includes(r.geocode_source));
    const cacheHits = rows.reduce((sum, r) => sum + (r.cache_hit_count ?? 0), 0);
    const externalLookups = automated.length;
    const needsReview = resolved.filter(
      r => !r.is_manual && !r.is_coordinate_locked && (r.confidence === 'low' || r.precision === 'approximate'),
    );
    // Phase 2C: the private member namespace and the public resource namespace
    // are separate caches and are counted separately.
    const memberCache = rows.filter(r => r.location_class === 'member_address');
    const resourceCache = rows.filter(r => r.location_class === 'resource_address');
    return { resolved, unresolved, verified, automated, cacheHits, externalLookups, needsReview, memberCache, resourceCache };
  }, [rows]);

  if (isPublicSafeModeActive()) return <Navigate to="/public" replace />;
  if (!canRead) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to="/admin" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Admin
            </Link>
            <h1 className="text-xl font-semibold">Geocode Health</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Internal geocode authority. Addresses are stored only as keyed digests — no address text is retained or shown.
              {!canWrite && ' Ops access is read-only.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
          <Stat label="Cached resolutions" value={metrics.resolved.length} />
          <Stat label="Verified / manual" value={metrics.verified.length} />
          <Stat label="Automated" value={metrics.automated.length} />
          <Stat label="Cache hits" value={metrics.cacheHits} />
          <Stat label="External lookups" value={metrics.externalLookups} />
          <Stat label="Unresolved attempts" value={metrics.unresolved.length} />
          <Stat label="Needs review" value={metrics.needsReview.length} />
          <Stat label="Member cache" value={metrics.memberCache.length} />
          <Stat label="Resource cache" value={metrics.resourceCache.length} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Breakdown title="By source" rows={tally(rows, r => r.geocode_source)} />
          <Breakdown title="By confidence" rows={tally(metrics.resolved, r => r.confidence)} />
          <Breakdown title="By county" rows={tally(metrics.resolved, r => r.county_name)} />
          <Breakdown title="By location class" rows={tally(rows, r => r.location_class)} />
        </div>

        {loading && <div className="mt-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="mt-4 rounded border border-border bg-card p-4 text-sm text-muted-foreground">
            No internal resolutions recorded yet. The cache fills as addresses are resolved.
          </div>
        )}
      </div>
    </div>
  );
}
