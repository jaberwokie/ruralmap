/**
 * Admin > Mapping > Provider Mapping.
 *
 * Two paths coexist:
 *   1. Legacy quick import (top): parseFacilityCsv → appendImportedFacilities,
 *      unchanged so existing operator workflows keep working.
 *   2. Staging pipeline (below): CSV → staging_providers → validate →
 *      geocode → promote into the imported-facilities store. Mirrors the
 *      Service / BH staging UX via PipelineWorkspace.
 *
 * Both paths land in the same in-page facility store, so promoted pins
 * appear on the map immediately on next refresh.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import MappingImportShell from '@/components/admin/MappingImportShell';
import PipelineWorkspace, { type StagingTableColumn } from '@/components/admin/PipelineWorkspace';
import EditRecordDialog, { type EditableField } from '@/components/admin/EditRecordDialog';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/contexts/AuthContext';
import { parseFacilityCsv, type CsvImportResult } from '@/utils/csvImport';
import { appendImportedFacilities } from '@/utils/importedFacilitiesStore';
import { PROVIDER_TEMPLATE } from '@/utils/csvTemplates';
import { parseCsvText } from '@/utils/mappingPipelineCsv';
import {
  csvToStagingProvider, insertStagingProviders, listStagingProviders,
  promoteStagingProvider, promoteStagingProvidersBulk, rejectStagingProvider,
  geocodeStagingProvidersBulk, editProviderStaging, listProviderAudit,
} from '@/utils/providerStagingStore';
import type { StagingProviderRow, AuditLogRow } from '@/types/mappingPipeline';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';

const SCHEMA_SECTIONS = [
  {
    heading: 'Identity',
    fields: [
      { name: 'name', required: true }, { name: 'type', description: 'hospital | clinic' },
      { name: 'provider_name' }, { name: 'organization_name' }, { name: 'npi' },
    ],
  },
  {
    heading: 'Location',
    fields: [
      { name: 'street_address' }, { name: 'city' }, { name: 'state' }, { name: 'zip' },
      { name: 'county' }, { name: 'latitude' }, { name: 'longitude' },
    ],
  },
  {
    heading: 'Contact',
    fields: [{ name: 'phone' }, { name: 'website' }, { name: 'notes' }],
  },
];

const VALIDATION_RULES = [
  'Name is required.',
  'Latitude and longitude must be a valid pair (both or neither).',
  'Records without coordinates AND without a street address cannot be geocoded or promoted.',
  'NPI should be 10 digits when provided.',
  'ZIP should be 5 digits or ZIP+4.',
  'Promotion writes the row into the imported facilities store as Unverified — it never auto-marks records verified.',
];

const STAGING_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'org', label: 'Organization' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'coords', label: 'Coords' },
  { key: 'outcome', label: 'Promotion' },
  { key: 'source', label: 'Source' },
];

const EDITABLE_FIELDS: EditableField[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type (hospital | clinic)' },
  { key: 'organization_name', label: 'Organization' },
  { key: 'npi', label: 'NPI' },
  { key: 'street_address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'county', label: 'County' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'access_notes', label: 'Access notes', type: 'textarea' },
];

export default function AdminMappingProviders() {
  const perms = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [imported, setImported] = useState(false);

  // Staging pipeline state
  const [staging, setStaging] = useState<StagingProviderRow[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editTarget, setEditTarget] = useState<StagingProviderRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([listStagingProviders(), listProviderAudit(200)]);
      setStaging(s); setAudit(a);
    } catch (e) {
      toast.error(`Failed to load staging: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // ── Legacy quick import ──────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are accepted.');
      return;
    }
    setParsing(true); setImported(false); setResult(null);
    const reader = new FileReader();
    reader.onerror = () => { toast.error('Failed to read file.'); setParsing(false); };
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) { toast.error('Failed to read file.'); setParsing(false); return; }
      const parsed = parseFacilityCsv(text);
      setResult(parsed);
      setParsing(false);
      if (parsed.valid.length === 0) toast.error(parsed.errors[0] ?? 'No valid rows found in the CSV.');
    };
    reader.readAsText(file);
  }, []);

  const onUploadClick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!result || result.valid.length === 0) return;
    if (!perms.canImportData) { toast.error('You do not have permission to import data.'); return; }
    appendImportedFacilities(result.valid);
    toast.success(`Imported ${result.valid.length} provider${result.valid.length === 1 ? '' : 's'}.`);
    setImported(true);
  };

  // ── Staging pipeline upload ──────────────────────────────────────
  const handleStagingUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.rows.length === 0) { toast.error('File had no data rows.'); return; }
      const importBatchId = crypto.randomUUID();
      const prepared = parsed.rows.map((r, idx) => csvToStagingProvider(r, {
        source_file_name: file.name, source_row_number: idx + 2, import_batch_id: importBatchId,
      }));
      const res = await insertStagingProviders(prepared, { fileName: file.name, importBatchId });
      toast.success(`Staged ${res.inserted} (${res.errors} errors, ${res.warnings} warnings)`);
      await refresh();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  // Map staging row id → most recent promotion outcome from audit log.
  const outcomeById = useMemo(() => {
    const map = new Map<string, 'created' | 'updated' | 'conflict'>();
    // Audit list is ordered most-recent first; only set first hit per id.
    for (const a of audit) {
      const id = a.target_row_id;
      if (!id || map.has(id)) continue;
      if (a.action === 'provider_created') map.set(id, 'created');
      else if (a.action === 'provider_updated') map.set(id, 'updated');
      else if (a.action === 'provider_skipped_conflict') map.set(id, 'conflict');
    }
    return map;
  }, [audit]);

  const renderOutcome = (id: string, reviewStatus: string) => {
    const o = outcomeById.get(id);
    if (o === 'created') return <span className="text-emerald-700">Created</span>;
    if (o === 'updated') return <span className="text-sky-700">Updated</span>;
    if (o === 'conflict') return <span className="text-amber-700">Conflict</span>;
    if (reviewStatus === 'rejected') return <span className="text-muted-foreground">Skipped</span>;
    return <span className="text-muted-foreground">—</span>;
  };

  const stagingRows = useMemo(() => staging.map((r) => {
    const tag = parseGeocodeTag(r.access_notes);
    const failed = isGeocodeFailed(r.access_notes);
    return {
      id: r.id,
      review_status: r.review_status,
      validation_severity: r.validation_severity,
      validation_messages: r.validation_messages,
      mappable: true,
      has_coords: r.latitude != null && r.longitude != null,
      geocode_status: (tag ? 'geocoded' : failed ? 'failed' : null) as 'geocoded' | 'failed' | null,
      geocode_confidence: tag?.confidence ?? null,
      cells: {
        name: r.name,
        type: r.type ?? '—',
        org: r.organization_name ?? '—',
        city: r.city ?? '—',
        county: r.county ?? '—',
        coords: r.latitude != null && r.longitude != null
          ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`
          : '—',
        outcome: renderOutcome(r.id, r.review_status),
        source: r.source_file_name ?? '—',
      },
    };
  }), [staging, outcomeById]);

  // ── Render ───────────────────────────────────────────────────────
  const uploadSlot = (
    <div className="mt-3 space-y-3">
      <Button onClick={onUploadClick} disabled={parsing} className="w-full">
        <Upload className="h-4 w-4 mr-1" />
        {parsing ? 'Parsing…' : 'Quick Import (legacy)'}
      </Button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      {result && (
        <div className="rounded border border-border bg-muted/30 p-2 text-xs">
          <div>
            <span className="font-medium">{result.valid.length}</span> valid ·{' '}
            <span className="text-muted-foreground">{result.invalidCount} skipped</span> ·{' '}
            <span className="text-muted-foreground">{result.totalRows} total</span>
          </div>
          {!imported && result.valid.length > 0 && (
            <Button onClick={confirmImport} size="sm" className="mt-2 w-full" disabled={!perms.canImportData}>
              Add {result.valid.length} to map
            </Button>
          )}
          {imported && (
            <p className="mt-2 text-[11px] font-medium text-foreground">Imported · open the map to view.</p>
          )}
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-muted-foreground">
                {result.errors.length} validation issue{result.errors.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto pr-2">
                {result.errors.slice(0, 100).map((err, i) => (
                  <li key={i} className="text-destructive/80">{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AdminMappingLayout
      title="Provider Mapping"
      description="Verified provider and facility locations for map placement. Quick Import bypasses staging; the Staging pipeline below adds validate/geocode/promote."
    >
      <MappingImportShell
        title="Provider location ingestion"
        purpose="Upload verified service-location data for providers and facilities. Billing and corporate addresses must not be used."
        required={[
          { name: 'verified_name', description: 'Provider/facility name' },
          { name: 'verified_lat', description: 'Latitude (-90 to 90)' },
          { name: 'verified_lng', description: 'Longitude (-180 to 180)' },
        ]}
        aliases={[
          { canonical: 'verified_name', aliases: ['name', 'provider_name'] },
          { canonical: 'verified_lat', aliases: ['latitude', 'lat'] },
          { canonical: 'verified_lng', aliases: ['longitude', 'lng', 'lon'] },
        ]}
        optional={[
          { name: 'verified_address', description: 'Stored on import' },
          { name: 'verified_city', description: 'Stored on import' },
          { name: 'verified_county', description: 'Stored on import' },
          { name: 'type', description: 'hospital vs clinic; anything else defaults to clinic' },
          { name: 'notes', description: 'Stored on import' },
        ]}
        validationRules={[
          'Coordinates must parse as valid finite numbers within range.',
          'Rows missing both canonical and legacy name/coordinate fields are rejected.',
          'Imports never auto-mark verified — entries enter the verification queue as Unverified.',
        ]}
        sampleColumns={['verified_name', 'verified_lat', 'verified_lng', 'verified_city', 'verified_county']}
        sampleRows={[
          { verified_name: 'Battle Mountain General Hospital', verified_lat: '40.63812', verified_lng: '-116.93429', verified_city: 'Battle Mountain', verified_county: 'Lander' },
        ]}
        template={PROVIDER_TEMPLATE}
        uploadSlot={uploadSlot}
        relatedLinks={[
          { label: 'Open Unmapped Providers list', to: '/admin/unmapped-providers' },
          { label: 'Open Verification Priority Queue', to: '/admin/mapping/verification-queue' },
        ]}
      />

      <div className="mt-6">
        <PipelineWorkspace
          title="Provider staging pipeline"
          purpose="CSV → staging_providers → validate → geocode → promote. Promoted rows are appended to the imported facilities store as Unverified."
          status="active"
          pipelineKey="provider_mapping"
          schemaSections={SCHEMA_SECTIONS}
          validationRules={VALIDATION_RULES}
          template={PROVIDER_TEMPLATE}
          stagingColumns={STAGING_COLS}
          stagingRows={stagingRows}
          verifiedColumns={[]}
          verifiedRows={[]}
          auditEntries={audit}
          loading={loading}
          uploading={uploading}
          onUpload={handleStagingUpload}
          onPromote={async (id) => { await promoteStagingProvider(id); toast.success('Promoted — added to map.'); await refresh(); }}
          onPromoteBulk={async (ids) => {
            const res = await promoteStagingProvidersBulk(ids);
            const parts: string[] = [`${res.promoted} promoted`];
            if (res.skipped) parts.push(`${res.skipped} skipped`);
            if (res.failed) parts.push(`${res.failed} failed`);
            toast.success(`Bulk promote: ${parts.join(', ')}`);
            if (res.failures.length > 0) {
              toast.error(`Some rows failed: ${res.failures.slice(0, 3).map((f) => f.reason).join(' · ')}`);
            }
            await refresh();
          }}
          onGeocodeBulk={async (ids) => {
            const res = await geocodeStagingProvidersBulk(ids);
            const parts = [`${res.geocoded} geocoded`, `${res.failed} failed`, `${res.skipped} skipped`];
            if (res.geocoded > 0) parts.push(`(${res.highConf} high · ${res.mediumConf} med · ${res.lowConf} low)`);
            toast.success(`Geocode: ${parts.join(', ')}`);
            await refresh();
          }}
          onReject={async (id) => { await rejectStagingProvider(id); toast.success('Rejected.'); await refresh(); }}
          onDeactivate={async () => { /* no verified table */ }}
          onRefresh={() => void refresh()}
          onEditStaging={(id) => {
            const row = staging.find((r) => r.id === id);
            if (row) setEditTarget(row);
          }}
        />
      </div>

      <EditRecordDialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        title={`Edit Provider — ${editTarget?.name ?? ''}`}
        scopeLabel="staging record"
        fields={EDITABLE_FIELDS}
        initial={(editTarget ?? {}) as unknown as Record<string, unknown>}
        onSave={async (changes) => {
          if (!editTarget) return;
          await editProviderStaging(editTarget.id, changes as Partial<StagingProviderRow>);
          toast.success('Edit saved.');
          await refresh();
        }}
      />
    </AdminMappingLayout>
  );
}
