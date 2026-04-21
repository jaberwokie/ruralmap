/**
 * Admin > Mapping > Service Mapping
 *
 * Active operational pipeline for non-clinical / community resource locations.
 * Upload → staging → validation → review → promote → live on Services map layer.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import PipelineWorkspace, { type StagingTableColumn } from '@/components/admin/PipelineWorkspace';
import EditRecordDialog, { type EditableField } from '@/components/admin/EditRecordDialog';
import { SERVICE_TEMPLATE } from '@/utils/csvTemplates';
import {
  insertStagingServices, listStagingServices, listVerifiedServices, listAudit,
  promoteStagingService, rejectStagingService, deactivateVerifiedService,
  editServiceRecord,
} from '@/utils/mappingPipelineStore';
import { parseCsvText, csvToStagingService } from '@/utils/mappingPipelineCsv';
import type { StagingServiceRow, VerifiedServiceRow, AuditLogRow } from '@/types/mappingPipeline';

const SCHEMA_SECTIONS = [
  {
    heading: 'Identity / classification',
    fields: [
      { name: 'name', required: true }, { name: 'service_category' }, { name: 'service_subcategory' },
      { name: 'organization_name' }, { name: 'description' }, { name: 'target_population' },
      { name: 'eligibility_notes' },
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
  'State should be NV/Nevada — non-Nevada records are flagged as warnings.',
  'ZIP must be 5 digits or ZIP+4.',
  'Records remain in staging until manually promoted by an admin.',
];

const STAGING_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'org', label: 'Organization' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'coords', label: 'Coords' },
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
  { key: 'service_category', label: 'Service category' },
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
];

type EditTarget =
  | { scope: 'staging_services'; row: StagingServiceRow }
  | { scope: 'verified_services'; row: VerifiedServiceRow }
  | null;

export default function AdminMappingServices() {
  const [staging, setStaging] = useState<StagingServiceRow[]>([]);
  const [verified, setVerified] = useState<VerifiedServiceRow[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

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
      const text = await file.text();
      const { rows } = parseCsvText(text);
      if (rows.length === 0) { toast.error('CSV had no data rows.'); return; }
      const importBatchId = crypto.randomUUID();
      const prepared = rows.map((r, idx) => csvToStagingService(r, {
        source_file_name: file.name, source_row_number: idx + 2, import_batch_id: importBatchId,
      }));
      const res = await insertStagingServices(prepared, { fileName: file.name, importBatchId });
      toast.success(`Inserted ${res.inserted} (${res.errors} errors, ${res.warnings} warnings)`);
      await refresh();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const stagingRows = useMemo(() => staging.map((r) => ({
    id: r.id,
    review_status: r.review_status,
    validation_severity: r.validation_severity,
    validation_messages: r.validation_messages,
    cells: {
      name: r.name,
      category: r.service_category ?? '—',
      org: r.organization_name ?? '—',
      city: r.city ?? '—',
      county: r.county ?? '—',
      coords: r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}` : '—',
      source: r.source_file_name ?? '—',
    },
  })), [staging]);

  const verifiedRows = useMemo(() => verified.map((r) => ({
    id: r.id,
    active_status: r.active_status,
    cells: {
      name: r.name,
      category: r.service_category ?? '—',
      city: r.city ?? '—',
      county: r.county ?? '—',
      verified: `${r.verification_status}${r.verification_confidence ? ` · ${r.verification_confidence}` : ''}`,
      promoted: new Date(r.promoted_at).toLocaleDateString(),
    },
  })), [verified]);

  return (
    <AdminMappingLayout
      title="Service Mapping"
      description="Operational pipeline for non-clinical and community resource locations. Promoted records appear on the Services map layer."
    >
      <PipelineWorkspace
        title="Service location pipeline"
        purpose="Food, shelter, transportation, employment, recovery, peer support, case management, outreach, hygiene, and benefits navigation locations. Clinical providers belong in Provider Mapping."
        status="active"
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
        onPromote={async (id) => { await promoteStagingService(id); toast.success('Promoted to verified.'); await refresh(); }}
        onReject={async (id) => { await rejectStagingService(id); toast.success('Rejected.'); await refresh(); }}
        onDeactivate={async (id) => { await deactivateVerifiedService(id); toast.success('Deactivated — removed from map.'); await refresh(); }}
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
