/**
 * Admin > Metrics — read-only dashboard fed exclusively from public.user_events.
 *
 * Date range filter (7/30/90 days) is applied at fetch time. Aggregations
 * are computed client-side so the page works against the standard PostgREST
 * endpoint without custom RPCs.
 */

import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { usePermissions } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EventRow = {
  id: string;
  user_id: string;
  user_role: string;
  event_type: string;
  event_detail: Record<string, unknown> | null;
  created_at: string;
};

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;

const dayKey = (iso: string) => iso.slice(0, 10);

const topN = <T,>(map: Map<T, number>, n: number) =>
  Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

const incr = <T,>(map: Map<T, number>, k: T) => map.set(k, (map.get(k) ?? 0) + 1);

export default function AdminMetrics() {
  const perms = usePermissions();
  const [days, setDays] = useState<number>(30);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!perms.ready || !perms.isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from('user_events')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setRows([]);
        } else {
          setRows((data ?? []) as EventRow[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [days, perms.ready, perms.isAdmin]);

  const agg = useMemo(() => {
    const byDayRole = new Map<string, { date: string; admin: number; staff: number; viewer: number }>();
    const counties = new Map<string, number>();
    const addresses = new Map<string, number>();
    const providers = new Map<string, number>();
    const directorySearches = new Map<string, number>();
    const pillModes = new Map<string, number>();
    const sections = new Map<string, number>();
    const chwLog: EventRow[] = [];

    for (const r of rows) {
      const detail = r.event_detail ?? {};
      if (r.event_type === 'session_start') {
        const d = dayKey(r.created_at);
        const entry = byDayRole.get(d) ?? { date: d, admin: 0, staff: 0, viewer: 0 };
        if (r.user_role === 'admin') entry.admin++;
        else if (r.user_role === 'staff') entry.staff++;
        else entry.viewer++;
        byDayRole.set(d, entry);
      }
      if (r.event_type === 'county_selected') {
        const c = String((detail as { county?: unknown }).county ?? '').trim();
        if (c) incr(counties, c);
      }
      if (r.event_type === 'address_searched') {
        const a = String((detail as { address?: unknown }).address ?? '').trim();
        if (a) incr(addresses, a);
      }
      if (r.event_type === 'provider_viewed') {
        const n = String((detail as { name?: unknown }).name ?? '').trim();
        if (n) incr(providers, n);
      }
      if (r.event_type === 'directory_searched') {
        const q = String((detail as { query?: unknown }).query ?? '').trim();
        if (q) incr(directorySearches, q);
      }
      if (r.event_type === 'pill_mode_changed') {
        const m = String((detail as { mode?: unknown }).mode ?? '').trim();
        if (m) incr(pillModes, m);
      }
      if (r.event_type === 'detail_section_expanded') {
        const s = String((detail as { section?: unknown }).section ?? '').trim();
        if (s) incr(sections, s);
      }
      if (r.event_type === 'chw_note_added' || r.event_type === 'attempted_contact_marked') {
        chwLog.push(r);
      }
    }

    const sessionSeries = Array.from(byDayRole.values()).sort((a, b) => a.date.localeCompare(b.date));
    return {
      sessionSeries,
      topCounties: topN(counties, 10),
      topAddresses: topN(addresses, 10),
      topProviders: topN(providers, 10),
      topSearches: topN(directorySearches, 10),
      pillModes: Array.from(pillModes.entries()).map(([mode, count]) => ({ mode, count })),
      topSections: topN(sections, 10),
      chwLog: chwLog.slice(0, 100),
    };
  }, [rows]);

  if (perms.ready && !perms.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminMappingLayout
      title="Metrics"
      description="User activity captured across the app. Admin-only."
    >
      <div className="mb-4 flex items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.days}
            variant={days === r.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
        {loading && <span className="text-xs text-muted-foreground ml-2">Loading…</span>}
        {error && <span className="text-xs text-destructive ml-2">{error}</span>}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length.toLocaleString()} events
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Sessions by role</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.sessionSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="admin" stroke="#064f88" />
                <Line type="monotone" dataKey="staff" stroke="#0ea5e9" />
                <Line type="monotone" dataKey="viewer" stroke="#94a3b8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pill mode usage</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.pillModes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mode" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#064f88" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <RankTable title="Top 10 counties selected" rows={agg.topCounties} label="County" />
        <RankTable title="Top 10 addresses searched" rows={agg.topAddresses} label="Address" />
        <RankTable title="Most viewed providers" rows={agg.topProviders} label="Provider" />
        <RankTable title="Top directory searches" rows={agg.topSearches} label="Query" />
        <RankTable title="Most expanded detail sections" rows={agg.topSections} label="Section" />

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">CHW activity log</CardTitle></CardHeader>
          <CardContent>
            {agg.chwLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No CHW notes or contact attempts in range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg.chwLog.map((r) => {
                    const d = r.event_detail ?? {};
                    const ctx = [
                      (d as { provider?: string }).provider,
                      (d as { county?: string }).county,
                    ].filter(Boolean).join(' · ');
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.user_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs">
                          {r.event_type === 'chw_note_added' ? 'Note added' : 'Contact attempted'}
                        </TableCell>
                        <TableCell className="text-xs">{ctx || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminMappingLayout>
  );
}

const RankTable = ({ title, rows, label }: { title: string; rows: [string, number][]; label: string }) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data in range.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{label}</TableHead>
              <TableHead className="text-right w-24">Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="text-xs">{k}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);
