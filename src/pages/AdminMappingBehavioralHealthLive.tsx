import { useEffect, useState } from 'react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { supabase } from '@/integrations/supabase/client';

interface VerifiedBhRow {
  id: string;
  name: string;
  county: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  coordinate_confidence: string | null;
  updated_at: string;
}

function formatAddress(r: VerifiedBhRow): string {
  const parts = [r.street_address, r.city, r.state, r.zip].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMappingBehavioralHealthLive() {
  const [rows, setRows] = useState<VerifiedBhRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('verified_bh')
        .select('id, name, county, street_address, city, state, zip, coordinate_confidence, updated_at')
        .eq('active_status', true)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as VerifiedBhRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminMappingLayout
      title="Behavioral Health (Live)"
      description="Read-only view of behavioral health records currently shown on the map (verified_bh)."
    >
      <div className="rounded border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${rows.length} record${rows.length === 1 ? '' : 's'}`}
        </div>
        {error ? (
          <div className="px-3 py-4 text-sm text-destructive">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">County</th>
                  <th className="px-3 py-2 text-left font-medium">Address</th>
                  <th className="px-3 py-2 text-left font-medium">Coordinate Confidence</th>
                  <th className="px-3 py-2 text-left font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No records.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.county ?? '—'}</td>
                      <td className="px-3 py-2">{formatAddress(r)}</td>
                      <td className="px-3 py-2">{r.coordinate_confidence ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.updated_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminMappingLayout>
  );
}
