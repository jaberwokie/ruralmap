/**
 * SysOp recovery console (/sysop).
 *
 * Accessible only to the `sysop` role (set directly in the database for
 * the two hardcoded operator emails). Renders the Deletion Recovery
 * Queue: a flat list of every soft-deleted record across the seven
 * tables that support `deleted_at`, with a Restore action per row.
 *
 * Restore is gated server-side by `sysop_restore_record`, which also
 * writes a `record_restored` entry to `mapping_audit_log`.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DeletedRow = {
  source_table: string;
  record_id: string;
  record_name: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  } catch {
    return '—';
  }
};

export default function SysOpHome() {
  const perms = usePermissions();
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('sysop_list_deleted');
    if (error) {
      console.warn('[sysop] sysop_list_deleted failed', error);
      toast.error('Failed to load deleted records');
      setRows([]);
    } else {
      setRows(((data ?? []) as DeletedRow[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (perms.ready && perms.isSysOp) {
      load();
    }
  }, [perms.ready, perms.isSysOp, load]);

  if (!perms.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!perms.isSysOp) {
    return <Navigate to="/" replace />;
  }

  const restore = async (row: DeletedRow) => {
    const key = `${row.source_table}:${row.record_id}`;
    setPending(key);
    try {
      const { error } = await (supabase.rpc as any)('sysop_restore_record', {
        _table: row.source_table,
        _id: row.record_id,
      });
      if (error) throw new Error(error.message);
      toast.success(`Restored ${row.record_name ?? row.record_id}`);
      setRows((prev) => prev.filter((r) => !(r.source_table === row.source_table && r.record_id === row.record_id)));
    } catch (e: any) {
      toast.error(e?.message ?? 'Restore failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>SysOp</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recovery console. Visible only to sysop accounts.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">← Back to Map</Link>
          </Button>
        </div>

        <div className="rounded border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-medium">Deletion Recovery Queue</h2>
              <p className="text-xs text-muted-foreground">
                Soft-deleted records across facilities, rural_services, verified_bh, verified_services, and staging tables.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name / ID</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>Deleted at</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No soft-deleted records.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const key = `${row.source_table}:${row.record_id}`;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-xs">{row.source_table}</TableCell>
                      <TableCell>
                        <div className="text-sm">{row.record_name ?? <span className="text-muted-foreground">—</span>}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{row.record_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{row.deleted_by ?? '—'}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.deleted_at)}</TableCell>
                      <TableCell className="text-sm">{row.deleted_reason ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending === key}
                          onClick={() => restore(row)}
                        >
                          {pending === key ? 'Restoring…' : 'Restore'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
