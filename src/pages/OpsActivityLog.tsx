import { useEffect, useState } from 'react';
import OpsLayout from '@/components/ops/OpsLayout';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/AuthContext';

interface ActivityRow {
  id: string;
  created_at: string;
  event_type: string;
  event_detail: Record<string, unknown> | null;
}

const TYPE_LABEL: Record<string, string> = {
  chw_note_added: 'CHW Note',
  attempted_contact_marked: 'Attempted Contact',
};

export default function OpsActivityLog() {
  const perms = usePermissions();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!perms.ready) return;
    if (!perms.user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_events')
        .select('id, created_at, event_type, event_detail')
        .eq('user_id', perms.user!.id)
        .in('event_type', ['chw_note_added', 'attempted_contact_marked'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setRows((data ?? []) as ActivityRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [perms.ready, perms.user?.id]);

  return (
    <OpsLayout
      title="My Activity"
      description="Your CHW notes and attempted contacts. Most recent first."
    >
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-sm text-destructive">Failed to load: {error}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No entries yet. Use Field Data Entry to log your first note or contact attempt.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">County</th>
                <th className="px-3 py-2 text-left font-medium">Provider</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const detail = (r.event_detail ?? {}) as Record<string, unknown>;
                const date = new Date(r.created_at);
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {date.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{(detail.county as string) || '—'}</td>
                    <td className="px-3 py-2">{(detail.provider_name as string) || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{TYPE_LABEL[r.event_type] ?? r.event_type}</td>
                    <td className="px-3 py-2 text-foreground/90">{(detail.note as string) || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </OpsLayout>
  );
}
