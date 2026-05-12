/**
 * Shared workspace shell for Service + BH pipelines.
 *
 * Renders the deterministic page structure required by both pipelines:
 *   1. Header + status chip
 *   2. Schema definition panel
 *   3. Upload intake
 *   4. Validation results summary
 *   5. Staging records table
 *   6. Promotion actions
 *   7. Audit / history section
 *
 * All write operations go through the parent's callbacks so this shell stays
 * pipeline-agnostic.
 */

import { type ReactNode, useRef, useState, useMemo } from 'react';
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle, Loader2, Info, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadCsvTemplate, type CsvTemplate } from '@/utils/csvTemplates';
import type { ValidationSeverity, ReviewStatus, AuditLogRow } from '@/types/mappingPipeline';
import { cn } from '@/lib/utils';
import { MappingStatusChip } from '@/components/admin/MappingStatusChip';
import type { MappingPipelineKey } from '@/config/mappingPipelineStatus';

export type PipelineStatus = 'active' | 'draft' | 'admin_only' | 'not_configured';

const STATUS_LABEL: Record<PipelineStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  admin_only: 'Admin Only',
  not_configured: 'Not Configured',
};

const STATUS_CLASS: Record<PipelineStatus, string> = {
  active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
  draft: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  admin_only: 'border-sky-500/50 bg-sky-500/10 text-sky-700',
  not_configured: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
};

export const PipelineStatusChip = ({ status }: { status: PipelineStatus }) => (
  <span
    className={cn(
      'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
      STATUS_CLASS[status],
    )}
  >
    {STATUS_LABEL[status]}
  </span>
);

export interface SchemaField {
  name: string;
  required?: boolean;
  description?: string;
}

export interface StagingTableColumn {
  key: string;
  label: string;
  className?: string;
  /** When true, header becomes clickable and rows sort using `sortValues[key]`. */
  sortable?: boolean;
}

export interface StagingTableRow {
  id: string;
  cells: Record<string, ReactNode>;
  /** Optional numeric/string values used for sorting when a column is sortable. */
  sortValues?: Record<string, number | string>;
  validation_severity: ValidationSeverity | null;
  review_status: ReviewStatus;
  validation_messages: { message: string; severity: ValidationSeverity }[];
  /** Whether this row will render as a map pin if promoted (mappable + coords). */
  mappable?: boolean;
  has_coords?: boolean;
  /** Most recent geocode outcome stamped into access_notes. */
  geocode_status?: 'geocoded' | 'failed' | null;
  geocode_confidence?: 'high' | 'low' | null;
}

export interface VerifiedTableRow {
  id: string;
  cells: Record<string, ReactNode>;
  active_status: boolean;
  mappable?: boolean;
  has_coords?: boolean;
}

interface PipelineWorkspaceProps {
  title: string;
  purpose: string;
  status: PipelineStatus;
  /**
   * When provided, the header chip is read from the centralized
   * `mappingPipelineStatus` config and `status` is ignored for the chip.
   */
  pipelineKey?: MappingPipelineKey;

  schemaSections: { heading: string; fields: SchemaField[] }[];
  validationRules: string[];
  template: CsvTemplate;

  stagingColumns: StagingTableColumn[];
  stagingRows: StagingTableRow[];
  verifiedColumns: StagingTableColumn[];
  verifiedRows: VerifiedTableRow[];
  auditEntries: AuditLogRow[];

  loading: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onPromote: (id: string) => Promise<void>;
  /** Optional bulk promote. When omitted, bulk action bar is hidden. */
  onPromoteBulk?: (ids: string[]) => Promise<void>;
  /**
   * Optional bulk geocode. When provided, "Geocode All Mappable Missing Coords"
   * and "Geocode Selected" buttons appear. Receives staging row ids only.
   */
  onGeocodeBulk?: (ids: string[]) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDeactivate: (verifiedId: string) => Promise<void>;
  onRefresh: () => void;
  onEditStaging?: (id: string) => void;
  onEditVerified?: (id: string) => void;
}

export default function PipelineWorkspace(props: PipelineWorkspaceProps) {
  const {
    title, purpose, status, pipelineKey, schemaSections, validationRules, template,
    stagingColumns, stagingRows, verifiedColumns, verifiedRows, auditEntries,
    loading, uploading, onUpload, onPromote, onPromoteBulk, onGeocodeBulk,
    onReject, onDeactivate, onRefresh, onEditStaging, onEditVerified,
  } = props;

  const fileRef = useRef<HTMLInputElement>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatus>('pending');
  const [severityFilter, setSeverityFilter] = useState<'all' | ValidationSeverity>('all');
  const [geocodeFilter, setGeocodeFilter] = useState<'all' | 'high' | 'low' | 'failed' | 'none'>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [geocodeRunning, setGeocodeRunning] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number } | null>(null);

  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const filteredStaging = useMemo(() => {
    const filtered = stagingRows.filter((r) => {
      if (reviewFilter !== 'all' && r.review_status !== reviewFilter) return false;
      if (severityFilter !== 'all' && (r.validation_severity ?? 'valid') !== severityFilter) return false;
      if (geocodeFilter !== 'all') {
        if (geocodeFilter === 'failed' && r.geocode_status !== 'failed') return false;
        if (geocodeFilter === 'none' && (r.geocode_status === 'geocoded' || r.geocode_status === 'failed')) return false;
        if (geocodeFilter === 'high' && r.geocode_confidence !== 'high') return false;
        if (geocodeFilter === 'low' && r.geocode_confidence !== 'low') return false;
      }
      return true;
    });
    if (!sort) return filtered;
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.sortValues?.[key];
      const bv = b.sortValues?.[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [stagingRows, reviewFilter, severityFilter, geocodeFilter, sort]);

  // Drop selection ids that are no longer visible after filter changes.
  const visibleIds = useMemo(() => new Set(filteredStaging.map((r) => r.id)), [filteredStaging]);
  const effectiveSelected = useMemo(
    () => new Set([...selectedIds].filter((id) => visibleIds.has(id))),
    [selectedIds, visibleIds],
  );

  const promotableVisible = useMemo(
    () => filteredStaging.filter((r) =>
      r.review_status === 'pending' && r.validation_severity !== 'error',
    ),
    [filteredStaging],
  );

  const pipelineCounts = useMemo(() => {
    let total = 0, pending = 0, approved = 0, rejected = 0;
    let promotable = 0, listOnly = 0, mappable = 0, missingCoords = 0, withCoords = 0;
    let wouldRenderPin = 0, listOnlyContext = 0;
    let mappableMissingCoords = 0, geocodedSuccess = 0, geocodedFailed = 0, geocodedLowConf = 0;
    for (const r of stagingRows) {
      total += 1;
      if (r.review_status === 'pending') pending += 1;
      if (r.review_status === 'approved') approved += 1;
      if (r.review_status === 'rejected') rejected += 1;
      if (r.review_status === 'pending' && r.validation_severity !== 'error') promotable += 1;
      const isMappable = r.mappable !== false;
      const hasCoords = r.has_coords === true;
      if (isMappable) mappable += 1; else listOnly += 1;
      if (hasCoords) withCoords += 1; else missingCoords += 1;
      if (isMappable && hasCoords) wouldRenderPin += 1;
      else listOnlyContext += 1;
      if (isMappable && !hasCoords) mappableMissingCoords += 1;
      if (r.geocode_status === 'geocoded') geocodedSuccess += 1;
      if (r.geocode_status === 'failed') geocodedFailed += 1;
      if (r.geocode_confidence === 'low') geocodedLowConf += 1;
    }
    return {
      total, pending, approved, rejected, promotable, listOnly, mappable, missingCoords, withCoords,
      wouldRenderPin, listOnlyContext, mappableMissingCoords, geocodedSuccess, geocodedFailed, geocodedLowConf,
    };
  }, [stagingRows]);

  // Rows eligible for geocoding: mappable + no coords + not rejected.
  const geocodableAll = useMemo(
    () => stagingRows.filter((r) =>
      r.mappable !== false && r.has_coords !== true && r.review_status !== 'rejected',
    ),
    [stagingRows],
  );
  const geocodableVisible = useMemo(
    () => filteredStaging.filter((r) =>
      r.mappable !== false && r.has_coords !== true && r.review_status !== 'rejected',
    ),
    [filteredStaging],
  );

  const validationSummary = useMemo(() => {
    const out = { valid: 0, warning: 0, error: 0 };
    stagingRows.filter((r) => r.review_status === 'pending').forEach((r) => {
      out[r.validation_severity ?? 'valid'] += 1;
    });
    return out;
  }, [stagingRows]);

  const handlePick = () => fileRef.current?.click();
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { await onUpload(f); } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wrap = async (id: string, fn: () => Promise<void>) => {
    setActingId(id);
    try { await fn(); } finally { setActingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header */}
      <header className="rounded border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: '#064f88' }}>{title}</h2>
              {pipelineKey ? (
                <MappingStatusChip pipeline={pipelineKey} compact showNote />
              ) : (
                <PipelineStatusChip status={status} />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{purpose}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* 2. Schema definition */}
      <section className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Schema definition
          </h3>
          <button
            type="button"
            onClick={() => downloadCsvTemplate(template)}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40"
          >
            <Download className="h-3 w-3" /> CSV template
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schemaSections.map((sec) => (
            <div key={sec.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {sec.heading}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {sec.fields.map((f) => (
                  <li key={f.name} className="text-[11px]">
                    <code className="font-mono text-foreground">{f.name}</code>
                    {f.required ? <span className="ml-1 text-[9px] uppercase text-rose-600">req</span> : null}
                    {f.description ? <span className="ml-1 text-muted-foreground">— {f.description}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Validation rules
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {validationRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </details>
      </section>

      {/* 3. Upload intake */}
      <section className="rounded border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upload intake
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Records land in staging only — they do not appear on the map until promoted.
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleFile} className="hidden" />
          <Button onClick={handlePick} disabled={uploading} size="sm">
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            {uploading ? 'Uploading…' : 'Upload CSV / XLSX'}
          </Button>
        </div>
      </section>

      {/* 4. Validation results + pipeline counts */}
      <section className="rounded border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Validation results (pending records)
        </h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ValidationStat label="Valid" count={validationSummary.valid} tone="emerald" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <ValidationStat label="Warning" count={validationSummary.warning} tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
          <ValidationStat label="Error" count={validationSummary.error} tone="rose" icon={<XCircle className="h-3.5 w-3.5" />} />
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline counts (all staging)
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            <CountStat label="Total staged" value={pipelineCounts.total} />
            <CountStat label="Promotable" value={pipelineCounts.promotable} tone="emerald" />
            <CountStat label="Mappable" value={pipelineCounts.mappable} />
            <CountStat label="List-only" value={pipelineCounts.listOnly} tone="amber" />
            <CountStat label="With coords" value={pipelineCounts.withCoords} />
            <CountStat label="Missing coords" value={pipelineCounts.missingCoords} tone="rose" />
            <CountStat label="Would render as pin" value={pipelineCounts.wouldRenderPin} tone="emerald" />
            <CountStat label="List/county only" value={pipelineCounts.listOnlyContext} tone="amber" />
            <CountStat label="Pending" value={pipelineCounts.pending} />
            <CountStat label="Approved" value={pipelineCounts.approved} />
            <CountStat label="Rejected" value={pipelineCounts.rejected} />
          </div>
          {onGeocodeBulk ? (
            <div className="mt-3 border-t border-border pt-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Geocoding status
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                <CountStat label="Eligible (mappable, no coords)" value={pipelineCounts.mappableMissingCoords} tone="rose" />
                <CountStat label="Geocoded · high" value={pipelineCounts.geocodedSuccess - pipelineCounts.geocodedLowConf} tone="emerald" />
                <CountStat label="Geocoded · low" value={pipelineCounts.geocodedLowConf} tone="amber" />
                <CountStat label="None (failed)" value={pipelineCounts.geocodedFailed} tone="rose" />
                <CountStat label="Pin-ready after promotion" value={pipelineCounts.wouldRenderPin} tone="emerald" />
              </div>
              <div className="mt-3 rounded border border-border bg-background/60 px-2 py-1.5 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">Recommended operator flow:</span>
                {' '}1) Geocode mappable missing-coords rows
                {' · '}2) Review low-confidence matches
                {' · '}3) Promote valid rows
                {' · '}4) Leave failed geocodes as county/list-only.
                {' '}Geocoding never overwrites existing coordinates and never runs on list-only rows.
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-[10px] text-muted-foreground">
            “Would render as pin” = mappable AND has coordinates AND promoted. Other rows still appear in the
            county Local Resource Network list when promoted.
          </p>
        </div>
      </section>

      {/* 5. Staging records */}
      <section className="rounded border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staging records
          </h3>
          <div className="flex items-center gap-1.5">
            <FilterChip active={reviewFilter === 'pending'} onClick={() => setReviewFilter('pending')}>Pending</FilterChip>
            <FilterChip active={reviewFilter === 'approved'} onClick={() => setReviewFilter('approved')}>Approved</FilterChip>
            <FilterChip active={reviewFilter === 'rejected'} onClick={() => setReviewFilter('rejected')}>Rejected</FilterChip>
            <FilterChip active={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>All</FilterChip>
            <span className="mx-1 h-3 w-px bg-border" />
            <FilterChip active={severityFilter === 'all'} onClick={() => setSeverityFilter('all')}>Any severity</FilterChip>
            <FilterChip active={severityFilter === 'error'} onClick={() => setSeverityFilter('error')}>Errors</FilterChip>
            <FilterChip active={severityFilter === 'warning'} onClick={() => setSeverityFilter('warning')}>Warnings</FilterChip>
          </div>
        </div>

        {/* Bulk action bar */}
        {onPromoteBulk ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                <strong className="text-foreground">{effectiveSelected.size}</strong> selected
                {' · '}
                <strong className="text-foreground">{promotableVisible.length}</strong> promotable in current view
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                disabled={bulkRunning || effectiveSelected.size === 0}
                onClick={async () => {
                  const ids = [...effectiveSelected].filter((id) => {
                    const r = stagingRows.find((x) => x.id === id);
                    return r && r.review_status === 'pending' && r.validation_severity !== 'error';
                  });
                  if (ids.length === 0) return;
                  setBulkRunning(true);
                  try { await onPromoteBulk(ids); setSelectedIds(new Set()); }
                  finally { setBulkRunning(false); }
                }}
              >
                {bulkRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Promote Selected'}
              </Button>
              <Button
                size="sm" className="h-6 px-2 text-[10px]"
                disabled={bulkRunning || promotableVisible.length === 0}
                onClick={async () => {
                  const ids = promotableVisible.map((r) => r.id);
                  if (ids.length === 0) return;
                  setBulkRunning(true);
                  try { await onPromoteBulk(ids); setSelectedIds(new Set()); }
                  finally { setBulkRunning(false); }
                }}
                title="Promote every promotable row in the current filter view (skips errors and rejected)"
              >
                {bulkRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : `Promote All Valid (${promotableVisible.length})`}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Geocode bulk bar */}
        {onGeocodeBulk ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>
                <strong className="text-foreground">{geocodableAll.length}</strong> mappable rows missing coords
                {geocodableVisible.length !== geocodableAll.length ? (
                  <> · <strong className="text-foreground">{geocodableVisible.length}</strong> in current view</>
                ) : null}
                {geocodeProgress ? (
                  <> · running {geocodeProgress.done}/{geocodeProgress.total}</>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                disabled={geocodeRunning || effectiveSelected.size === 0}
                onClick={async () => {
                  const ids = [...effectiveSelected].filter((id) => {
                    const r = stagingRows.find((x) => x.id === id);
                    return r && r.mappable !== false && r.has_coords !== true && r.review_status !== 'rejected';
                  });
                  if (ids.length === 0) return;
                  setGeocodeRunning(true);
                  setGeocodeProgress({ done: 0, total: ids.length });
                  try { await onGeocodeBulk(ids); }
                  finally { setGeocodeRunning(false); setGeocodeProgress(null); }
                }}
                title="Geocode only checked rows (mappable + missing coords)"
              >
                {geocodeRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Geocode Selected'}
              </Button>
              <Button
                size="sm" className="h-6 px-2 text-[10px]"
                disabled={geocodeRunning || geocodableAll.length === 0}
                onClick={async () => {
                  const ids = geocodableAll.map((r) => r.id);
                  if (ids.length === 0) return;
                  setGeocodeRunning(true);
                  setGeocodeProgress({ done: 0, total: ids.length });
                  try { await onGeocodeBulk(ids); }
                  finally { setGeocodeRunning(false); setGeocodeProgress(null); }
                }}
                title="Geocode every staging row that is mappable and missing coordinates (~1.1s/row)"
              >
                {geocodeRunning
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : `Geocode All Mappable Missing Coords (${geocodableAll.length})`}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-2 overflow-auto rounded border border-border max-h-[420px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                {onPromoteBulk ? (
                  <th className="px-2 py-1.5 w-6">
                    <input
                      type="checkbox"
                      aria-label="Select all promotable in view"
                      checked={promotableVisible.length > 0 && promotableVisible.every((r) => effectiveSelected.has(r.id))}
                      onChange={(e) => {
                        const next = new Set(effectiveSelected);
                        if (e.target.checked) promotableVisible.forEach((r) => next.add(r.id));
                        else promotableVisible.forEach((r) => next.delete(r.id));
                        setSelectedIds(next);
                      }}
                    />
                  </th>
                ) : null}
                <th className="text-left px-2 py-1.5 whitespace-nowrap">Status</th>
                {stagingColumns.map((c) => {
                  if (!c.sortable) {
                    return <th key={c.key} className={cn('text-left px-2 py-1.5 whitespace-nowrap', c.className)}>{c.label}</th>;
                  }
                  const isActive = sort?.key === c.key;
                  const arrow = isActive ? (sort?.dir === 'asc' ? '↑' : '↓') : '↕';
                  return (
                    <th key={c.key} className={cn('text-left px-2 py-1.5 whitespace-nowrap', c.className)}>
                      <button
                        type="button"
                        onClick={() => setSort((prev) => {
                          if (!prev || prev.key !== c.key) return { key: c.key, dir: 'desc' };
                          if (prev.dir === 'desc') return { key: c.key, dir: 'asc' };
                          return null;
                        })}
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', isActive && 'text-foreground')}
                      >
                        {c.label}<span className="text-[9px] opacity-60">{arrow}</span>
                      </button>
                    </th>
                  );
                })}
                <th className="text-right px-2 py-1.5 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaging.length === 0 ? (
                <tr><td colSpan={stagingColumns.length + 2} className="px-2 py-6 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No records match the current filters.'}
                </td></tr>
              ) : filteredStaging.map((r) => {
                const promotable = r.review_status === 'pending' && r.validation_severity !== 'error';
                return (
                <tr key={r.id} className="border-t border-border align-top">
                  {onPromoteBulk ? (
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        disabled={!promotable}
                        checked={effectiveSelected.has(r.id)}
                        onChange={(e) => {
                          const next = new Set(effectiveSelected);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <SeverityBadge severity={r.validation_severity ?? 'valid'} />
                    <ReviewBadge status={r.review_status} />
                    {(r.mappable === false || r.has_coords === false || r.geocode_status) ? (
                      <div className="mt-1 inline-flex flex-col gap-0.5">
                        {r.mappable === false ? (
                          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">List-only</span>
                        ) : null}
                        {r.has_coords === false ? (
                          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-rose-700">No coords</span>
                        ) : null}
                        {r.geocode_status === 'geocoded' ? (
                          <span className={cn(
                            'rounded border px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                            r.geocode_confidence === 'high' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
                            r.geocode_confidence === 'low' && 'border-amber-500/40 bg-amber-500/10 text-amber-700',
                          )}>Geocoded · {r.geocode_confidence ?? 'high'}</span>
                        ) : null}
                        {r.geocode_status === 'failed' ? (
                          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-rose-700">Geocode failed</span>
                        ) : null}
                      </div>
                    ) : null}
                    {r.validation_messages.length > 0 && (
                      <div className="mt-1 max-w-[180px] text-[10px] text-muted-foreground" title={r.validation_messages.map((m) => m.message).join('\n')}>
                        <Info className="inline h-3 w-3 mr-0.5" />
                        {r.validation_messages.length} msg
                      </div>
                    )}
                  </td>
                  {stagingColumns.map((c) => (
                    <td key={c.key} className={cn('px-2 py-1.5', c.className)}>{r.cells[c.key] ?? ''}</td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    {r.review_status === 'pending' && (
                      <div className="inline-flex items-center gap-1">
                        {onEditStaging ? (
                          <Button
                            size="sm" variant="ghost"
                            disabled={actingId === r.id}
                            onClick={() => onEditStaging(r.id)}
                            className="h-6 px-2 text-[10px]"
                          >
                            Edit
                          </Button>
                        ) : null}
                        <Button
                          size="sm" variant="outline"
                          disabled={actingId === r.id || r.validation_severity === 'error'}
                          onClick={() => wrap(r.id, () => onPromote(r.id))}
                          title={r.validation_severity === 'error' ? 'Cannot promote a record with errors' : 'Promote to verified'}
                          className="h-6 px-2 text-[10px]"
                        >
                          {actingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Promote'}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          disabled={actingId === r.id}
                          onClick={() => wrap(r.id, () => onReject(r.id))}
                          className="h-6 px-2 text-[10px]"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Promotion / Verified records */}
      <section className="rounded border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verified dataset (live on map)
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Only active rows below render on the live map layer. Deactivating removes the pin immediately.
        </p>
        <div className="mt-2 overflow-auto rounded border border-border max-h-[320px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                {verifiedColumns.map((c) => (
                  <th key={c.key} className={cn('text-left px-2 py-1.5 whitespace-nowrap', c.className)}>{c.label}</th>
                ))}
                <th className="text-right px-2 py-1.5 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {verifiedRows.length === 0 ? (
                <tr><td colSpan={verifiedColumns.length + 1} className="px-2 py-6 text-center text-muted-foreground">
                  No verified records yet.
                </td></tr>
              ) : verifiedRows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  {verifiedColumns.map((c) => (
                    <td key={c.key} className={cn('px-2 py-1.5', c.className)}>{r.cells[c.key] ?? ''}</td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-1">
                      {onEditVerified ? (
                        <Button
                          size="sm" variant="ghost"
                          disabled={actingId === r.id}
                          onClick={() => onEditVerified(r.id)}
                          className="h-6 px-2 text-[10px]"
                        >
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        size="sm" variant="ghost"
                        disabled={actingId === r.id}
                        onClick={() => wrap(r.id, () => onDeactivate(r.id))}
                        className="h-6 px-2 text-[10px]"
                      >
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Audit / history */}
      <section className="rounded border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Audit history
        </h3>
        <div className="mt-2 overflow-auto rounded border border-border max-h-[280px]">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-1.5 whitespace-nowrap">When</th>
                <th className="text-left px-2 py-1.5 whitespace-nowrap">Action</th>
                <th className="text-left px-2 py-1.5 whitespace-nowrap">Actor</th>
                <th className="text-left px-2 py-1.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.length === 0 ? (
                <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">No audit events yet.</td></tr>
              ) : auditEntries.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap font-mono">{a.action}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{a.actor_email ?? '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    <code className="font-mono text-[10px]">{JSON.stringify(a.details)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const ValidationStat = ({ label, count, tone, icon }: { label: string; count: number; tone: 'emerald' | 'amber' | 'rose'; icon: ReactNode }) => {
  const cls = tone === 'emerald'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : tone === 'amber'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
      : 'border-rose-500/40 bg-rose-500/10 text-rose-700';
  return (
    <div className={cn('flex items-center justify-between gap-2 rounded border px-2 py-1.5', cls)}>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium">{icon}{label}</span>
      <span className="text-sm font-semibold tabular-nums">{count}</span>
    </div>
  );
};

const CountStat = ({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'rose' }) => {
  const cls = tone === 'emerald'
    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
    : tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/5 text-amber-700'
      : tone === 'rose'
        ? 'border-rose-500/30 bg-rose-500/5 text-rose-700'
        : 'border-border bg-background text-foreground';
  return (
    <div className={cn('flex flex-col gap-0.5 rounded border px-2 py-1.5', cls)}>
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
};

const SeverityBadge = ({ severity }: { severity: ValidationSeverity }) => {
  const cls = severity === 'error' ? 'bg-rose-500/10 text-rose-700 border-rose-500/40'
    : severity === 'warning' ? 'bg-amber-500/10 text-amber-700 border-amber-500/40'
    : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40';
  return <span className={cn('inline-block rounded border px-1 py-px text-[9px] font-medium uppercase tracking-wider', cls)}>{severity}</span>;
};

const ReviewBadge = ({ status }: { status: ReviewStatus }) => {
  const cls = status === 'approved' ? 'text-emerald-700' : status === 'rejected' ? 'text-rose-700' : 'text-muted-foreground';
  return <div className={cn('mt-0.5 text-[10px]', cls)}>{status}</div>;
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
      active
        ? 'border-[hsl(var(--brand-health))] bg-[hsl(var(--brand-health)/0.08)] text-[hsl(var(--brand-health))]'
        : 'border-border text-muted-foreground hover:text-foreground',
    )}
  >
    {children}
  </button>
);
