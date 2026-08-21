/**
 * Admin > Data Sources — the Source Registry.
 *
 * Authoritative registry of where the Rural Tool's information originates.
 * GOVERNANCE ONLY: no live map, Decision Assist, coverage, or scoring behavior
 * reads this page or its tables. The application must keep working with an
 * empty registry.
 *
 * Access: Admin + Ops + SysOp (matches the rest of the backend area).
 * Ops is strictly read-only. Public Safe Mode never reaches this route.
 *
 * Secrets: `credential_reference` holds a logical NAME only (e.g.
 * GOOGLE_GEOCODING_API_KEY). Secret values are never stored, fetched, or
 * rendered here.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { isPublicSafeModeActive } from '@/hooks/usePublicSafeMode';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  calculateSourceHealth,
  getSourceWarnings,
  summarizeHealth,
  SOURCE_HEALTH_LABEL,
  type SourceHealth,
} from '@/lib/sources/sourceHealth';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type DataSource = Database['public']['Tables']['data_sources']['Row'];
type DataSourceRun = Database['public']['Tables']['data_source_runs']['Row'];

/**
 * Governance metadata Admin/SysOp may edit from this surface.
 * Deliberately excludes anything that could carry a secret value.
 */
export const EDITABLE_FIELDS = [
  { key: 'authority_name', label: 'Authority', kind: 'text' },
  { key: 'source_url', label: 'Source URL', kind: 'text' },
  { key: 'refresh_method', label: 'Refresh method', kind: 'text' },
  { key: 'refresh_cadence', label: 'Refresh cadence', kind: 'text' },
  { key: 'effective_date', label: 'Effective date (YYYY-MM-DD)', kind: 'text' },
  { key: 'source_version', label: 'Source version', kind: 'text' },
  { key: 'stale_after_days', label: 'Stale after (days)', kind: 'number' },
  { key: 'next_review_at', label: 'Next review (ISO timestamp)', kind: 'text' },
  { key: 'last_verified_at', label: 'Last verified (ISO timestamp)', kind: 'text' },
  { key: 'credential_reference', label: 'Credential reference (NAME ONLY)', kind: 'text' },
  { key: 'owner_role', label: 'Owner role', kind: 'text' },
  { key: 'owner_name', label: 'Owner name', kind: 'text' },
  { key: 'fallback_description', label: 'Fallback behavior', kind: 'text' },
  { key: 'notes', label: 'Notes', kind: 'textarea' },
] as const;

const HEALTH_CLASS: Record<SourceHealth, string> = {
  current: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  review_due: 'text-amber-700 bg-amber-50 border-amber-200',
  stale: 'text-orange-700 bg-orange-50 border-orange-200',
  failing: 'text-destructive bg-destructive/10 border-destructive/30',
  unknown: 'text-muted-foreground bg-muted border-border',
};

const HealthChip = ({ health }: { health: SourceHealth }) => (
  <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium', HEALTH_CLASS[health])}>
    {SOURCE_HEALTH_LABEL[health]}
  </span>
);

const fmtDate = (value: string | null) => {
  if (!value) return '—';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString();
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="break-words text-sm">{value === null || value === '' || value === undefined ? '—' : value}</div>
  </div>
);

const SummaryStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded border border-border bg-card px-3 py-2">
    <div className="text-lg font-semibold leading-none">{value}</div>
    <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
  </div>
);

export default function AdminDataSources() {
  const perms = usePermissions();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [runs, setRuns] = useState<DataSourceRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const canRead = perms.canAccessOps;
  const canWrite = perms.isAdmin; // admin + sysop (sysop inherits)

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('data_sources')
      .select('*')
      .order('source_category', { ascending: true })
      .order('source_name', { ascending: true });
    if (err) {
      setError(err.message);
      setSources([]);
    } else {
      setError(null);
      setSources(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canRead || isPublicSafeModeActive()) return;
    void load();
  }, [canRead]);

  useEffect(() => {
    if (!selectedId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('data_source_runs')
      .select('*')
      .eq('source_id', selectedId)
      .order('started_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setRuns(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => sources.find((s) => s.id === selectedId) ?? null,
    [sources, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setDraft({});
      return;
    }
    const next: Record<string, string> = {};
    for (const field of EDITABLE_FIELDS) {
      const raw = (selected as Record<string, unknown>)[field.key];
      next[field.key] = raw === null || raw === undefined ? '' : String(raw);
    }
    setDraft(next);
  }, [selected]);

  const summary = useMemo(() => summarizeHealth(sources), [sources]);
  const warnings = useMemo(
    () =>
      sources.flatMap((s) =>
        getSourceWarnings({ ...s, source_name: s.source_name }).map((w) => ({ ...w, id: s.id })),
      ),
    [sources],
  );

  // Public Safe Mode and non-backend roles never see the registry.
  if (isPublicSafeModeActive()) return <Navigate to="/" replace />;
  if (perms.ready && !canRead) return <Navigate to="/" replace />;

  const save = async () => {
    if (!selected || !canWrite) return;
    setSaving(true);
    const patch: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      const value = (draft[field.key] ?? '').trim();
      if (field.kind === 'number') {
        patch[field.key] = value === '' ? null : Number(value);
      } else {
        patch[field.key] = value === '' ? null : value;
      }
    }
    const { error: err } = await supabase.from('data_sources').update(patch).eq('id', selected.id);
    setSaving(false);
    if (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Source updated' });
    await load();
  };

  const runtimeCritical = sources.filter((s) => s.runtime_dependency).length;
  const credentialed = sources.filter((s) => s.requires_credentials).length;
  const internalizing = sources.filter(
    (s) => s.internalization_target === 'ingest_internal' || s.internalization_target === 'fully_internal',
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2 h-7 px-2 text-xs">
              <Link to="/admin">
                <ArrowLeft className="mr-1 h-3 w-3" /> Admin
              </Link>
            </Button>
            <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>Data Sources</h1>
            <p className="text-xs text-muted-foreground">
              Registry of where the Rural Tool's information originates. Governance only — live map behavior does not depend on it.
              {!canWrite && ' Read-only for your role.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load sources: {error}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <SummaryStat label="Tracked sources" value={sources.length} />
          <SummaryStat label="Current" value={summary.current} />
          <SummaryStat label="Review due" value={summary.review_due} />
          <SummaryStat label="Stale" value={summary.stale} />
          <SummaryStat label="Failing" value={summary.failing} />
          <SummaryStat label="Unknown" value={summary.unknown} />
          <SummaryStat label="Runtime critical" value={runtimeCritical} />
          <SummaryStat label="Require credentials" value={credentialed} />
          <SummaryStat label="Internalization targets" value={internalizing} />
        </div>

        {warnings.length > 0 && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Source governance gaps ({warnings.length})
            </div>
            <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-amber-900">
              {warnings.map((w, i) => (
                <li key={`${w.id}-${w.code}-${i}`}>
                  <button className="text-left underline-offset-2 hover:underline" onClick={() => setSelectedId(w.id)}>
                    {w.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Authority</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Dependency</th>
                  <th className="px-2 py-2">Target</th>
                  <th className="px-2 py-2">Last verified</th>
                  <th className="px-2 py-2">Last run</th>
                  <th className="px-2 py-2">Next review</th>
                  <th className="px-2 py-2">Health</th>
                  <th className="px-2 py-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      'cursor-pointer border-t border-border hover:bg-muted/40',
                      selectedId === s.id && 'bg-muted/60',
                    )}
                  >
                    <td className="px-2 py-1.5 font-medium">{s.source_name}</td>
                    <td className="px-2 py-1.5">{s.authority_name ?? '—'}</td>
                    <td className="px-2 py-1.5">{s.source_category}</td>
                    <td className="px-2 py-1.5">{s.source_type}</td>
                    <td className="px-2 py-1.5">{s.runtime_dependency ? 'Runtime' : 'Offline'}</td>
                    <td className="px-2 py-1.5">{s.internalization_target}</td>
                    <td className="px-2 py-1.5">{fmtDate(s.last_verified_at)}</td>
                    <td className="px-2 py-1.5">{fmtDate(s.last_successful_ingestion_at)}</td>
                    <td className="px-2 py-1.5">{fmtDate(s.next_review_at)}</td>
                    <td className="px-2 py-1.5"><HealthChip health={calculateSourceHealth(s)} /></td>
                    <td className="px-2 py-1.5">{s.owner_name ?? s.owner_role ?? '—'}</td>
                  </tr>
                ))}
                {!loading && sources.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">
                      No sources tracked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-border bg-card p-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a source to view its provenance and history.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold">{selected.source_name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <code>{selected.source_key}</code>
                    <HealthChip health={calculateSourceHealth(selected)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Authority" value={selected.authority_name} />
                  <Field label="Category" value={selected.source_category} />
                  <Field label="Source type" value={selected.source_type} />
                  <Field label="Classification" value={selected.data_classification} />
                  <Field label="Dependency" value={selected.runtime_dependency ? 'Runtime' : 'Offline / reference'} />
                  <Field label="Internalization target" value={selected.internalization_target} />
                  <Field label="Status" value={selected.status} />
                  <Field label="Effective date" value={selected.effective_date ?? '—'} />
                  <Field label="Source version" value={selected.source_version} />
                  <Field label="Transformation version" value={selected.transformation_version} />
                  <Field label="Last retrieved" value={fmtDate(selected.last_retrieved_at)} />
                  <Field label="Last verified" value={fmtDate(selected.last_verified_at)} />
                  <Field label="Last successful ingestion" value={fmtDate(selected.last_successful_ingestion_at)} />
                  <Field label="Last failed ingestion" value={fmtDate(selected.last_failed_ingestion_at)} />
                  <Field label="Next review" value={fmtDate(selected.next_review_at)} />
                  <Field label="Stale after (days)" value={selected.stale_after_days} />
                  <Field label="Record count" value={selected.last_record_count} />
                  <Field label="Public safe" value={selected.is_public_safe ? 'Yes' : 'No'} />
                  <Field label="Failure impact" value={selected.failure_impact} />
                  <Field label="Fallback available" value={selected.fallback_available ? 'Yes' : 'No'} />
                  <Field
                    label="Credential reference (name only)"
                    value={selected.requires_credentials ? (selected.credential_reference ?? 'NOT DOCUMENTED') : 'None required'}
                  />
                  <Field label="Owner" value={selected.owner_name ?? selected.owner_role} />
                </div>

                {selected.source_url && (
                  <Field
                    label="Source URL"
                    value={
                      <a
                        href={selected.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-primary underline-offset-2 hover:underline"
                      >
                        {selected.source_url}
                      </a>
                    }
                  />
                )}
                <Field label="Fallback behavior" value={selected.fallback_description} />
                <Field label="What the Rural Tool uses it for / evidence" value={selected.notes} />

                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Recent runs
                  </div>
                  {runs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recorded runs.</p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {runs.map((r) => (
                        <li key={r.id} className="rounded border border-border px-2 py-1">
                          <span className="font-medium">{r.run_type}</span> · {r.status} ·{' '}
                          {fmtDate(r.started_at)}
                          {typeof r.records_accepted === 'number' && ` · ${r.records_accepted} accepted`}
                          {r.error_summary && <div className="text-destructive">{r.error_summary}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canWrite && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Edit governance metadata
                    </div>
                    {EDITABLE_FIELDS.map((field) => (
                      <div key={field.key}>
                        <label className="text-[11px] text-muted-foreground" htmlFor={`f-${field.key}`}>
                          {field.label}
                        </label>
                        {field.kind === 'textarea' ? (
                          <Textarea
                            id={`f-${field.key}`}
                            className="mt-0.5 text-xs"
                            rows={3}
                            value={draft[field.key] ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                          />
                        ) : (
                          <Input
                            id={`f-${field.key}`}
                            className="mt-0.5 h-8 text-xs"
                            inputMode={field.kind === 'number' ? 'numeric' : undefined}
                            value={draft[field.key] ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <Button size="sm" onClick={() => void save()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save governance metadata'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Credential reference stores a variable NAME only. Never paste a key or secret value here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
