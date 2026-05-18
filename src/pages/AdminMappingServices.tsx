/**
 * Admin > Mapping > Service Mapping
 *
 * Active operational pipeline for non-clinical / community resource locations.
 * Two upload modes:
 *   - Default (CSV): legacy alias-driven mapper; one row → one staging insert.
 *   - Nye Mode (CSV or XLSX): pre-stage header resolution gate, then
 *     controlled upsert into staging with conflict flagging.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import PipelineWorkspace, { type StagingTableColumn } from '@/components/admin/PipelineWorkspace';
import EditRecordDialog, { type EditableField } from '@/components/admin/EditRecordDialog';
import { Button } from '@/components/ui/button';
import { SERVICE_TEMPLATE } from '@/utils/csvTemplates';
import {
  insertStagingServices, listStagingServices, listVerifiedServices, listAudit,
  promoteStagingService, promoteStagingServicesBulk, rejectStagingService, deactivateVerifiedService,
  editServiceRecord, upsertStagingServicesControlled, writeHeaderResolutionAudit,
  geocodeStagingServicesBulk, geocodeFacilitiesBulk, geocodeRuralServicesBulk,
} from '@/utils/mappingPipelineStore';
import {
  parseCsvText, parseXlsxBuffer, csvToStagingService, resolveHeaders,
} from '@/utils/mappingPipelineCsv';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';
import { supabase } from '@/integrations/supabase/client';
import { seedFacilities, seedRuralServices, patchFailedCoordinates } from '@/utils/seedStaticData';
import type { HeaderResolutionResult } from '@/utils/serviceHeaderResolver';
import type { StagingServiceRow, VerifiedServiceRow, AuditLogRow } from '@/types/mappingPipeline';
import { SERVICE_CATEGORIES } from '@/utils/serviceCategoryMap';

const SCHEMA_SECTIONS = [
  {
    heading: 'Identity / classification',
    fields: [
      { name: 'name', required: true }, { name: 'service_category' }, { name: 'service_subcategory' },
      { name: 'organization_name' }, { name: 'description' }, { name: 'target_population' },
      { name: 'eligibility_notes' }, { name: 'service_tags' }, { name: 'resource_class' },
    ],
  },
  {
    heading: 'Location',
    fields: [
      { name: 'street_address' }, { name: 'city' }, { name: 'state' }, { name: 'zip' },
      { name: 'county' }, { name: 'latitude' }, { name: 'longitude' }, { name: 'mappable' },
    ],
  },
  {
    heading: 'Contact / access',
    fields: [
      { name: 'phone' }, { name: 'website' }, { name: 'email' },
      { name: 'referral_required' }, { name: 'walk_in_allowed' }, { name: 'appointment_required' },
      { name: 'hours_of_operation' }, { name: 'languages_supported' },
    ],
  },
  {
    heading: 'Operational',
    fields: [
      { name: 'active_status' }, { name: 'access_notes' }, { name: 'transportation_notes' },
      { name: 'medicaid_relevance' }, { name: 'verification_source' },
    ],
  },
];

const VALIDATION_RULES = [
  'Name is required.',
  'Latitude and longitude must be a valid pair (both or neither).',
  'Records without coordinates AND without a street address will not place on the map.',
  'Service category should match a known category — non-standard values are flagged as warnings.',
  'category_mapped (controlled category) is required before a record can be promoted. Free-text categories are kept as category_raw and never written to verified records.',
  'State should be NV/Nevada — non-Nevada records are flagged as warnings.',
  'ZIP must be 5 digits or ZIP+4.',
  'Records remain in staging until manually promoted by an admin.',
  'Nye Mode: headers resolved via alias map; identity duplicates abort import.',
  'Nye Mode: rows without location AND contact data are kept but marked non-mappable.',
];

const STAGING_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'org', label: 'Organization' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'coords', label: 'Coords' },
  { key: 'geocode_confidence', label: 'Geocode', sortable: true },
  { key: 'flags', label: 'Flags' },
  { key: 'source', label: 'Source' },
];

const VERIFIED_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'verified', label: 'Verification' },
  { key: 'promoted', label: 'Promoted' },
];

const EDITABLE_FIELDS: EditableField[] = [
  { key: 'name', label: 'Name' },
  { key: 'category_mapped', label: 'Category (controlled)', type: 'select', options: SERVICE_CATEGORIES },
  { key: 'service_category', label: 'Category (raw / free-text)' },
  { key: 'organization_name', label: 'Organization' },
  { key: 'street_address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
  { key: 'county', label: 'County' },
  { key: 'latitude', label: 'Latitude', type: 'number' },
  { key: 'longitude', label: 'Longitude', type: 'number' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'access_notes', label: 'Access notes', type: 'textarea' },
  { key: 'service_tags', label: 'Service tags' },
  { key: 'resource_class', label: 'Resource class' },
];

type EditTarget =
  | { scope: 'staging_services'; row: StagingServiceRow }
  | { scope: 'verified_services'; row: VerifiedServiceRow }
  | null;

interface PendingNyeImport {
  fileName: string;
  importBatchId: string;
  resolver: HeaderResolutionResult;
  rows: Record<string, string>[];
}

export default function AdminMappingServices() {
  const [staging, setStaging] = useState<StagingServiceRow[]>([]);
  const [verified, setVerified] = useState<VerifiedServiceRow[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [nyeMode, setNyeMode] = useState(true);
  const [pendingNye, setPendingNye] = useState<PendingNyeImport | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, v, a] = await Promise.all([
        listStagingServices(), listVerifiedServices(), listAudit('services', 200),
      ]);
      setStaging(s); setVerified(v); setAudit(a);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const isXlsx = /\.xlsx?$/i.test(file.name);
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (isXlsx) {
        const buf = await file.arrayBuffer();
        const parsed = parseXlsxBuffer(buf);
        headers = parsed.headers; rows = parsed.rows;
      } else {
        const text = await file.text();
        const parsed = parseCsvText(text);
        headers = parsed.headers; rows = parsed.rows;
      }

      if (rows.length === 0) { toast.error('File had no data rows.'); return; }
      const importBatchId = crypto.randomUUID();

      if (!nyeMode) {
        // Legacy default path
        const prepared = rows.map((r, idx) => csvToStagingService(r, {
          source_file_name: file.name, source_row_number: idx + 2, import_batch_id: importBatchId,
        }));
        const res = await insertStagingServices(prepared, { fileName: file.name, importBatchId });
        toast.success(`Inserted ${res.inserted} (${res.errors} errors, ${res.warnings} warnings)`);
        await refresh();
        return;
      }

      // Nye v5 path: resolve headers, audit, then either block or stage.
      const resolver = resolveHeaders(headers);
      await writeHeaderResolutionAudit(importBatchId, file.name, resolver);

      if (resolver.status === 'blocked') {
        setPendingNye({ fileName: file.name, importBatchId, resolver, rows });
        toast.error('Import blocked — see header resolution report.');
        await refresh();
        return;
      }
      // Allowed: surface report, then run controlled upsert
      setPendingNye({ fileName: file.name, importBatchId, resolver, rows });
      const prepared = rows.map((r, idx) => csvToStagingService(r, {
        source_file_name: file.name, source_row_number: idx + 2, import_batch_id: importBatchId,
      }, resolver));
      const res = await upsertStagingServicesControlled(prepared, { fileName: file.name, importBatchId });
      toast.success(
        `Nye import: ${res.inserted} new, ${res.merged} merged, ${res.conflicts} conflicts ` +
        `(${res.errors} errors, ${res.warnings} warnings)`,
      );
      await refresh();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const stagingRows = useMemo(() => staging.map((r) => {
    const tag = parseGeocodeTag(r.access_notes);
    const failed = isGeocodeFailed(r.access_notes);
    return {
    id: r.id,
    review_status: r.review_status,
    validation_severity: r.validation_severity,
    validation_messages: r.validation_messages,
    mappable: r.mappable !== false,
    has_coords: r.latitude != null && r.longitude != null,
    geocode_status: (tag ? 'geocoded' : failed ? 'failed' : null) as 'geocoded' | 'failed' | null,
    geocode_confidence: tag?.confidence ?? null,
    cells: {
      name: r.name,
      category: r.category_mapped
        ? r.category_mapped
        : (
          <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">{r.category_raw ?? r.service_category ?? '—'}</span>
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">
              Needs mapping
            </span>
          </span>
        ),
      org: r.organization_name ?? '—',
      city: r.city ?? '—',
      county: r.county ?? '—',
      coords: r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : '—',
      geocode_confidence: (() => {
        const tag = parseGeocodeTag(r.access_notes);
        if (isGeocodeFailed(r.access_notes)) {
          return <span style={{ color: '#ef4444', fontWeight: 600 }}>● Failed</span>;
        }
        if (!tag) {
          return <span style={{ color: '#9ca3af' }}>○ None</span>;
        }
        if (tag.confidence === 'high' && tag.strategy === 'address_full') {
          return <span style={{ color: '#22c55e', fontWeight: 600 }}>● High</span>;
        }
        if (tag.strategy === 'census_onelineaddress') {
          return <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Census</span>;
        }
        return <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Low</span>;
      })(),
      flags: (
        <span className="inline-flex flex-wrap gap-1">
          {r.match_conflict ? (
            <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-rose-700">
              Match conflict
            </span>
          ) : null}
          {r.mappable === false ? (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">
              List-only
            </span>
          ) : null}
          {r.resource_class && r.resource_class !== 'service' ? (
            <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-700">
              {r.resource_class}
            </span>
          ) : null}
        </span>
      ),
      source: r.source_file_name ?? '—',
    },
    };
  }), [staging]);

  const verifiedRows = useMemo(() => verified.map((r) => ({
    id: r.id,
    active_status: r.active_status,
    mappable: r.mappable !== false,
    has_coords: r.latitude != null && r.longitude != null,
    cells: {
      name: r.name,
      category: r.category_mapped ?? r.service_category ?? '—',
      city: r.city ?? '—',
      county: r.county ?? '—',
      verified: `${r.verification_status}${r.verification_confidence ? ` · ${r.verification_confidence}` : ''}`,
      promoted: new Date(r.promoted_at).toLocaleDateString(),
    },
  })), [verified]);

  const handleRevalidate = async () => {
    const allRows = await listStagingServices();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const targetIds = allRows
      .filter((r) => {
        if (r.mappable === false) return false;
        if (r.review_status === 'rejected') return false;
        const tag = parseGeocodeTag(r.access_notes);
        if (!tag) return true;
        if (tag.confidence === 'low') return true;
        if (isGeocodeFailed(r.access_notes)) return true;
        const geocodeDate = new Date(tag.date);
        if (geocodeDate < ninetyDaysAgo) return true;
        return false;
      })
      .map((r) => r.id);

    if (targetIds.length === 0) {
      toast.info('No records need re-validation.');
      return;
    }

    toast.info(`Re-validating ${targetIds.length} records…`);
    const res = await geocodeStagingServicesBulk(targetIds);
    toast.success(`Re-validation complete: ${res.geocoded} geocoded, ${res.failed} failed, ${res.skipped} skipped`);
    await refresh();
  };

  const handleSeedStaticData = async () => {
    toast.info('Seeding facilities and rural services into database…');
    const [facResult, svcResult] = await Promise.all([
      seedFacilities(),
      seedRuralServices(),
    ]);
    const facMsg = `Facilities: ${facResult.inserted} inserted, ${facResult.errors.length} errors`;
    const svcMsg = `Rural services: ${svcResult.inserted} inserted, ${svcResult.errors.length} errors`;
    if (facResult.errors.length > 0 || svcResult.errors.length > 0) {
      console.error('Seed errors:', [...facResult.errors, ...svcResult.errors]);
      toast.warning(`Seed complete with errors — check console. ${facMsg}. ${svcMsg}.`);
    } else {
      toast.success(`Seed complete. ${facMsg}. ${svcMsg}.`);
    }
  };

  const handleGeocodeStaticData = async () => {
    toast.info('Starting server-side geocode — running in batches…');
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-bulk`;
      const BATCH_SIZE = 80;

      // Clear existing coordinates first
      const { data: facilityRows } = await supabase.from('facilities').select('id');
      const facilityIds = (facilityRows ?? []).map(r => r.id);
      await supabase.from('facilities').update({ lat: null, lng: null, access_notes: null }).in('id', facilityIds);

      const { data: ruralRows } = await supabase.from('rural_services').select('id');
      const ruralIds = (ruralRows ?? []).map(r => r.id);
      await supabase.from('rural_services').update({ lat: null, lng: null, access_notes: null }).in('id', ruralIds);

      // Geocode facilities (53 records — single batch)
      toast.info(`Geocoding ${facilityIds.length} facilities…`);
      const facRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'facilities', limit: BATCH_SIZE, offset: 0 }),
      });
      const facResult = await facRes.json();
      toast.success(`Facilities: ${facResult.geocoded} geocoded, ${facResult.failed} failed, ${facResult.skipped} skipped`);

      // Geocode rural services in batches
      toast.info(`Geocoding ${ruralIds.length} rural services in batches…`);
      let totalGeocoded = 0, totalFailed = 0, totalSkipped = 0;
      let offset = 0;
      let batchNum = 1;

      while (true) {
        toast.info(`Rural services batch ${batchNum}…`);
        const ruralRes = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'rural_services', limit: BATCH_SIZE, offset }),
        });
        const ruralResult = await ruralRes.json();

        totalGeocoded += ruralResult.geocoded ?? 0;
        totalFailed += ruralResult.failed ?? 0;
        totalSkipped += ruralResult.skipped ?? 0;

        // If batch returned fewer than BATCH_SIZE records, we're done
        if ((ruralResult.total ?? 0) < BATCH_SIZE) break;

        offset += BATCH_SIZE;
        batchNum++;
      }

      toast.success(`Rural services: ${totalGeocoded} geocoded, ${totalFailed} failed, ${totalSkipped} skipped`);
    } catch (err) {
      toast.error(`Geocode failed: ${String(err)}`);
    }
  };

const handleGeocodeUnresolved = async () => {
  toast.info('Clearing failed stamps and re-geocoding unresolved rural services…');
  try {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-bulk`;

    // Clear access_notes on failed rural service records so they get a fresh attempt
    await supabase
      .from('rural_services')
      .update({ access_notes: null })
      .is('lat', null);

    const { data: unresolved } = await supabase
      .from('rural_services')
      .select('id')
      .is('lat', null);
    const count = (unresolved ?? []).length;
    if (count === 0) {
      toast.info('No unresolved rural services found.');
      return;
    }
    toast.info(`Found ${count} unresolved — geocoding now…`);
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'rural_services', limit: 100, offset: 0 }),
    });
    const result = await res.json();
    toast.success(`Done: ${result.geocoded} geocoded, ${result.failed} failed, ${result.skipped} skipped`);
  } catch (err) {
    toast.error(`Failed: ${String(err)}`);
  }
};

const handlePatchFailed = async () => {
  toast.info('Patching unresolvable records with verified coordinates…');
  const result = await patchFailedCoordinates();
  if (result.errors.length > 0) {
    console.error('Patch errors:', result.errors);
    toast.warning(`Patched ${result.patched} records with ${result.errors.length} errors — check console`);
  } else {
    toast.success(`Patched ${result.patched} records successfully`);
  }
};

  return (
    <AdminMappingLayout
      title="Service Mapping"
      description="Operational pipeline for non-clinical and community resource locations. Promoted records appear on the Services map layer."
    >
      {/* Mode toggle + Nye-mode resolution report */}
      <div className="mb-3 rounded border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload mode</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Nye Mode: header resolution gate, controlled upsert, normalization. Default: legacy CSV mapper.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant={nyeMode ? 'default' : 'outline'}
              className="h-7 px-2 text-[11px]"
              onClick={() => setNyeMode(true)}>
              Nye Mode (CSV / XLSX)
            </Button>
            <Button size="sm" variant={!nyeMode ? 'default' : 'outline'}
              className="h-7 px-2 text-[11px]"
              onClick={() => setNyeMode(false)}>
              Default (CSV)
            </Button>
          </div>
        </div>

        {pendingNye ? (
          <div className="mt-3 rounded border border-border bg-muted/30 p-3 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {pendingNye.resolver.status === 'allowed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                )}
                <span className="font-semibold">
                  Header Resolution Report — {pendingNye.fileName}
                </span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                onClick={() => setPendingNye(null)}>Dismiss</Button>
            </div>
            <div className="mt-2 grid gap-1.5">
              <ReportLine label="Matched (exact)" items={pendingNye.resolver.matchedExact.map((m) => m.source)} />
              <ReportLine label="Matched (via alias)"
                items={pendingNye.resolver.matchedViaAlias.map((m) => `${m.source} → ${m.canonical}`)} />
              {pendingNye.resolver.non_blocking_duplicates.length > 0 ? (
                <div>
                  <span className="text-muted-foreground">Non-blocking duplicates:</span>
                  <ul className="mt-0.5 list-disc pl-4 text-amber-700">
                    {pendingNye.resolver.non_blocking_duplicates.map((d) => (
                      <li key={d.canonical}>
                        <code>{d.canonical}</code> — primary=<code>{d.primary}</code>, append={d.secondaries.map((s) => <code key={s} className="mx-0.5">{s}</code>)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ReportLine label="Unmapped (ignored)" items={pendingNye.resolver.unmapped} />
              {pendingNye.resolver.missingRequired.length > 0 ? (
                <ReportLine label="Missing required"
                  items={pendingNye.resolver.missingRequired} tone="rose" />
              ) : null}
              {pendingNye.resolver.blocking_conflicts.length > 0 ? (
                <div>
                  <span className="text-muted-foreground">Blocking conflicts:</span>
                  <ul className="mt-0.5 list-disc pl-4 text-rose-700">
                    {pendingNye.resolver.blocking_conflicts.map((c) => (
                      <li key={c.canonical}>
                        <code>{c.canonical}</code> ← {c.sources.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-1.5 flex items-center gap-1">
                {pendingNye.resolver.status === 'allowed' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Import allowed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700">
                    <AlertTriangle className="h-3 w-3" /> Import blocked — fix headers and re-upload
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex justify-end gap-2">
        <Button
          onClick={handleSeedStaticData}
          variant="outline"
          size="sm"
          title="One-time migration: seed facilities and rural services into database"
        >
          Seed Static Data → DB
        </Button>
        <Button
          onClick={handleGeocodeStaticData}
          variant="outline"
          size="sm"
          title="Geocode all facilities and rural services against validated pipeline"
        >
          Geocode Static Data
        </Button>
        <Button
          onClick={handleGeocodeUnresolved}
          variant="outline"
          size="sm"
          title="Geocode only rural services missing coordinates"
        >
          Geocode Unresolved
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevalidate}
          title="Re-geocode failed, low-confidence, and stale records"
        >
          Re-validate Geocodes
        </Button>
        <Button
          onClick={handlePatchFailed}
          variant="outline"
          size="sm"
          title="Write verified coordinates to the 7 unresolvable records"
        >
          Patch Failed Records
        </Button>
      </div>

      <PipelineWorkspace
        title="Service location pipeline"
        purpose="Food, shelter, transportation, employment, recovery, peer support, case management, outreach, hygiene, and benefits navigation locations. Clinical providers belong in Provider Mapping."
        status="active"
        pipelineKey="services"
        schemaSections={SCHEMA_SECTIONS}
        validationRules={VALIDATION_RULES}
        template={SERVICE_TEMPLATE}
        stagingColumns={STAGING_COLS}
        stagingRows={stagingRows}
        verifiedColumns={VERIFIED_COLS}
        verifiedRows={verifiedRows}
        auditEntries={audit}
        loading={loading}
        uploading={uploading}
        onUpload={handleUpload}
        onPromote={async (id) => {
          try { await promoteStagingService(id); toast.success('Promoted to verified.'); await refresh(); }
          catch (e) { toast.error(`Promote failed: ${(e as Error).message}`); }
        }}
        onPromoteBulk={async (ids) => {
          try {
            const res = await promoteStagingServicesBulk(ids);
            const parts: string[] = [`${res.promoted} promoted`];
            if (res.skipped) parts.push(`${res.skipped} skipped (errors)`);
            if (res.failed) parts.push(`${res.failed} failed`);
            toast.success(`Bulk promote: ${parts.join(', ')}`);
            if (res.failures.length > 0) {
              toast.error(`Some rows failed: ${res.failures.slice(0, 3).map((f) => f.reason).join(' · ')}`);
            }
            await refresh();
          } catch (e) { toast.error(`Bulk promote failed: ${(e as Error).message}`); }
        }}
        onGeocodeBulk={async (ids) => {
          try {
            const res = await geocodeStagingServicesBulk(ids);
            const parts = [
              `${res.geocoded} geocoded`,
              `${res.failed} failed`,
              `${res.skipped} skipped`,
            ];
            if (res.geocoded > 0) {
              parts.push(`(${res.highConf} high · ${res.mediumConf} med · ${res.lowConf} low)`);
            }
            toast.success(`Geocode: ${parts.join(', ')}`);
            await refresh();
          } catch (e) { toast.error(`Geocode failed: ${(e as Error).message}`); }
        }}
        onReject={async (id) => {
          try { await rejectStagingService(id); toast.success('Rejected.'); await refresh(); }
          catch (e) { toast.error(`Reject failed: ${(e as Error).message}`); }
        }}
        onDeactivate={async (id) => {
          try { await deactivateVerifiedService(id); toast.success('Deactivated — removed from map.'); await refresh(); }
          catch (e) { toast.error(`Deactivate failed: ${(e as Error).message}`); }
        }}
        onRefresh={() => void refresh()}
        onEditStaging={(id) => {
          const row = staging.find((r) => r.id === id);
          if (row) setEditTarget({ scope: 'staging_services', row });
        }}
        onEditVerified={(id) => {
          const row = verified.find((r) => r.id === id);
          if (row) setEditTarget({ scope: 'verified_services', row });
        }}
      />
      <EditRecordDialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        title={`Edit Service — ${editTarget?.row.name ?? ''}`}
        scopeLabel={editTarget?.scope === 'verified_services' ? 'verified record (live on map)' : 'staging record'}
        fields={EDITABLE_FIELDS}
        initial={(editTarget?.row ?? {}) as unknown as Record<string, unknown>}
        onSave={async (changes) => {
          if (!editTarget) return;
          await editServiceRecord(editTarget.scope, editTarget.row.id, changes);
          toast.success('Edit saved.');
          await refresh();
        }}
      />
    </AdminMappingLayout>
  );
}

const ReportLine = ({ label, items, tone }: { label: string; items: string[]; tone?: 'rose' }) => (
  <div>
    <span className="text-muted-foreground">{label}:</span>{' '}
    {items.length === 0 ? (
      <span className="text-muted-foreground">(none)</span>
    ) : (
      <span className={tone === 'rose' ? 'text-rose-700' : ''}>
        {items.map((s, i) => (
          <code key={i} className="mx-0.5 rounded bg-background px-1 py-0.5 text-[10px] border border-border">{s}</code>
        ))}
      </span>
    )}
  </div>
);
