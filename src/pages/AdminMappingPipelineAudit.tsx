/**
 * Admin > Mapping > Pipeline Audit Log.
 *
 * Surfaces the Cloud-side `mapping_audit_log` table — uploads, promotions,
 * rejections, edits, geocode runs, provider conflicts. Read-only view.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { Button } from '@/components/ui/button';
import { listAudit } from '@/utils/mappingPipelineStore';
import type { AuditLogRow, PipelineKey } from '@/types/mappingPipeline';
import { cn } from '@/lib/utils';

const PIPELINE_LABELS: Record<PipelineKey, string> = {
  services: 'Services',
  behavioral_health: 'Behavioral Health',
  provider_mapping: 'Provider Mapping',
};

const PIPELINE_FILTERS: Array<{ key: PipelineKey | 'all'; label: string }> = [
  { key: 'all', label: 'All Pipelines' },
  { key: 'services', label: 'Services' },
  { key: 'behavioral_health', label: 'Behavioral Health' },
  { key: 'provider_mapping', label: 'Provider Mapping' },
];

const ACTION_COLORS: Record<string, string> = {
  upload_started: '#6366f1',
  upload_completed: '#22c55e',
  validation_completed: '#3b82f6',
  header_resolution: '#8b5cf6',
  record_promoted: '#22c55e',
  record_rejected: '#ef4444',
  record_edited: '#f59e0b',
  verification_changed: '#f59e0b',
  provider_created: '#22c55e',
  provider_updated: '#f59e0b',
  provider_skipped_conflict: '#ef4444',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function summarizeDetails(details: unknown): string {
  if (!details || typeof details !== 'object') return '—';
  try {
    const s = JSON.stringify(details);
    if (s === '{}') return '—';
    return s.length > 100 ? `${s.slice(0, 100)}…` : s;
  } catch {
    return '—';
  }
}

export default function AdminMappingPipelineAudit() {
  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineKey | 'all'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listAudit(pipeline === 'all' ? undefined : pipeline, 200);
    setEntries(data);
    setLoading(false);
  }, [pipeline]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AdminMappingLayout
      title="Pipeline Audit Log"
      description="All Cloud pipeline actions — uploads, promotions, rejections, edits, geocode runs, and provider conflicts. Most recent first; capped at 200 entries."
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PIPELINE_FILTERS.map((f) => {
            const active = pipeline === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setPipeline(f.key)}
                className={cn(
                  'whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-[hsl(var(--brand-health))] bg-[hsl(var(--brand-health)/0.08)] text-[hsl(var(--brand-health))]'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="rounded border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Loading audit entries…
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No audit entries found{pipeline !== 'all' ? ` for ${PIPELINE_LABELS[pipeline]}` : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Pipeline</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Action</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Table</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Actor</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const color = ACTION_COLORS[e.action] ?? '#6b7280';
                  return (
                    <tr key={e.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatTimestamp(e.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {PIPELINE_LABELS[e.pipeline as PipelineKey] ?? e.pipeline}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                          style={{ backgroundColor: `${color}1a`, color }}
                        >
                          {e.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {e.target_table ?? '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {e.actor_email ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground max-w-[420px] break-all">
                        {summarizeDetails(e.details)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminMappingLayout>
  );
}
