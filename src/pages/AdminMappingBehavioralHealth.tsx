/**
 * Admin > Mapping > Behavioral Health Mapping
 *
 * Operational pipeline for behavioral health-specific providers, facilities,
 * and service locations. Marked Draft until admin sign-off; functionality is
 * complete. Promoted records appear on the Behavioral Health map layer.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import PipelineWorkspace, { type StagingTableColumn } from '@/components/admin/PipelineWorkspace';
import EditRecordDialog, { type EditableField } from '@/components/admin/EditRecordDialog';
import { BEHAVIORAL_HEALTH_TEMPLATE } from '@/utils/csvTemplates';
import {
  insertStagingBh, listStagingBh, listVerifiedBh, listAudit,
  promoteStagingBh, promoteStagingBhBulk, rejectStagingBh, deactivateVerifiedBh,
  editBhRecord, geocodeStagingBhBulk,
} from '@/utils/mappingPipelineStore';
import { parseCsvText, csvToStagingBh } from '@/utils/mappingPipelineCsv';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';
import type { StagingBhRow, VerifiedBhRow, AuditLogRow } from '@/types/mappingPipeline';
import { BH_CATEGORIES } from '@/utils/bhCategoryMap';
import { BH_ACCESS_TAG_LABELS, parseBhAccessTags, normalizeBhAccessTags, type BhAccessTag } from '@/utils/bhAccessTags';
import { getBhSourceTrust } from '@/utils/bhSourceTrust';
import { normalizeZip } from '@/utils/zipNormalize';
import { computeBhSiteDensity, siteDensityTier } from '@/utils/bhSiteDensity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SCHEMA_SECTIONS = [
  {
    heading: 'Identity',
    fields: [
      { name: 'name', required: true }, { name: 'bh_entity_type' }, { name: 'bh_service_type' },
      { name: 'organization_name' }, { name: 'facility_type' }, { name: 'description' },
    ],
  },
  {
    heading: 'Provider / credentials',
    fields: [
      { name: 'npi' }, { name: 'license_type' }, { name: 'specialties' },
      { name: 'age_groups_served' }, { name: 'populations_served' },
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
      { name: 'phone' }, { name: 'website' }, { name: 'fax' },
      { name: 'referral_required' }, { name: 'walk_in_allowed' }, { name: 'appointment_required' },
      { name: 'accepts_new_patients' }, { name: 'telehealth_available' },
      { name: 'hours_of_operation' }, { name: 'languages_supported' },
    ],
  },
  {
    heading: 'Coverage / programs',
    fields: [
      { name: 'medicaid_participation_status' }, { name: 'payer_notes' },
      { name: 'crisis_capable' }, { name: 'detox_capable' }, { name: 'residential_capable' },
      { name: 'outpatient_capable' }, { name: 'mat_capable' },
    ],
  },
  {
    heading: 'Operational',
    fields: [
      { name: 'active_status' }, { name: 'access_notes' }, { name: 'verification_source' },
    ],
  },
];

const VALIDATION_RULES = [
  'Name is required.',
  'Latitude and longitude must be a valid pair (both or neither).',
  'NPI, when provided, must be exactly 10 digits.',
  'Records without coordinates AND without a street address will not place on the map.',
  'BH entity type should match a known type — non-standard values are flagged as warnings.',
  'category_mapped (controlled BH category) is required before a record can be promoted. Free-text categories are kept as category_raw and never written to verified records.',
  'State should be NV/Nevada — non-Nevada records are flagged as warnings.',
  'Records remain in staging until manually promoted by an admin.',
];

const STAGING_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'tags', label: 'Access tags' },
  { key: 'type', label: 'Type' },
  { key: 'npi', label: 'NPI' },
  { key: 'org', label: 'Organization' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'geocode_confidence', label: 'Geocode', sortable: true },
  { key: 'caps', label: 'Capabilities' },
  { key: 'density', label: 'Site density', sortable: true },
];

const VERIFIED_COLS: StagingTableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'tags', label: 'Access tags' },
  { key: 'type', label: 'Type' },
  { key: 'city', label: 'City' },
  { key: 'county', label: 'County' },
  { key: 'verified', label: 'Verification' },
  { key: 'promoted', label: 'Promoted' },
];

const renderTagBadges = (raw: string | null | undefined) => {
  const tags = parseBhAccessTags(raw);
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t: BhAccessTag) => (
        <Badge key={t} variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
          {BH_ACCESS_TAG_LABELS[t]}
        </Badge>
      ))}
    </span>
  );
};

const EDITABLE_FIELDS: EditableField[] = [
  { key: 'name', label: 'Name' },
  { key: 'category_mapped', label: 'Category (controlled)', type: 'select', options: BH_CATEGORIES },
  { key: 'category_raw', label: 'Category (raw / free-text)' },
  { key: 'bh_entity_type', label: 'BH entity type' },
  { key: 'bh_service_type', label: 'BH service type' },
  { key: 'npi', label: 'NPI' },
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
  { key: 'service_tags', label: 'Access tags (comma-separated: telehealth, fqhc, rural_health_clinic, critical_access_hospital)', type: 'textarea' },
  { key: 'access_notes', label: 'Access notes', type: 'textarea' },
];

const formatCaps = (r: StagingBhRow): string => {
  const out: string[] = [];
  if (r.crisis_capable) out.push('crisis');
  if (r.detox_capable) out.push('detox');
  if (r.residential_capable) out.push('res');
  if (r.outpatient_capable) out.push('outp');
  if (r.mat_capable) out.push('MAT');
  if (r.telehealth_available) out.push('tele');
  return out.length === 0 ? '—' : out.join(' · ');
};

type EditTarget =
  | { scope: 'staging_bh'; row: StagingBhRow }
  | { scope: 'verified_bh'; row: VerifiedBhRow }
  | null;

export default function AdminMappingBehavioralHealth() {
  const [staging, setStaging] = useState<StagingBhRow[]>([]);
  const [verified, setVerified] = useState<VerifiedBhRow[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, v, a] = await Promise.all([
        listStagingBh(), listVerifiedBh(), listAudit('behavioral_health', 200),
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
      const prepared = rows.map((r, idx) => csvToStagingBh(r, {
        source_file_name: file.name, source_row_number: idx + 2, import_batch_id: importBatchId,
      }));
      const res = await insertStagingBh(prepared, { fileName: file.name, importBatchId });
      toast.success(`Inserted ${res.inserted} (${res.errors} errors, ${res.warnings} warnings)`);
      await refresh();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const stagingRows = useMemo(() => {
    const densityMap = computeBhSiteDensity(staging);
    return staging.map((r) => {
      const tag = parseGeocodeTag(r.access_notes);
      const failed = isGeocodeFailed(r.access_notes);
      const tags = parseBhAccessTags(r.service_tags);
      const telehealthOnly =
        (tags.includes('telehealth') || r.telehealth_available === true) &&
        (!r.street_address || r.street_address.trim() === '');
      const trust = getBhSourceTrust(r);
      const density = densityMap.get(r.id) ?? 1;
      const tier = siteDensityTier(density);
      return {
        id: r.id,
        review_status: r.review_status,
        validation_severity: r.validation_severity,
        validation_messages: r.validation_messages,
        mappable: !telehealthOnly,
        has_coords: r.latitude != null && r.longitude != null,
        geocode_status: (tag ? 'geocoded' : failed ? 'failed' : null) as 'geocoded' | 'failed' | null,
        geocode_confidence: tag?.confidence ?? null,
        sortValues: { density },
        cells: {
          name: (
            <span className="inline-flex items-center gap-1.5">
              <span>{r.name}</span>
              {trust === 'high' && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider text-emerald-700"
                  title="Trusted partner source — non-critical warnings downgraded. Critical checks still apply."
                >
                  Trusted Source
                </Badge>
              )}
            </span>
          ),
          category: r.category_mapped
            ? r.category_mapped
            : (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground">{r.category_raw ?? r.bh_service_type ?? '—'}</span>
                <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-700">
                  Needs mapping
                </span>
              </span>
            ),
          tags: renderTagBadges(r.service_tags),
          type: r.bh_entity_type ?? r.bh_service_type ?? '—',
          npi: r.npi ?? '—',
          org: r.organization_name ?? '—',
          city: r.city ?? '—',
          county: r.county ?? '—',
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
          caps: formatCaps(r),
          density: (
            <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
              <span>{density}</span>
              {tier === 'multi' && (
                <Badge
                  variant="outline"
                  className="border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider text-sky-700"
                  title={`${density} BH records share this organization + city + county`}
                >
                  Multi
                </Badge>
              )}
              {tier === 'hub' && (
                <Badge
                  variant="outline"
                  className="border-violet-500/40 bg-violet-500/10 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider text-violet-700"
                  title={`${density} BH records share this organization + city + county — high-value access hub`}
                >
                  Hub
                </Badge>
              )}
            </span>
          ),
        },
      };
    });
  }, [staging]);

  const verifiedRows = useMemo(() => verified.map((r) => ({
    id: r.id,
    active_status: r.active_status,
    has_coords: r.latitude != null && r.longitude != null,
    cells: {
      name: r.name,
      category: r.category_mapped ?? r.category_raw ?? '—',
      tags: renderTagBadges(r.service_tags),
      type: r.bh_entity_type ?? r.bh_service_type ?? '—',
      city: r.city ?? '—',
      county: r.county ?? '—',
      verified: `${r.verification_status}${r.verification_confidence ? ` · ${r.verification_confidence}` : ''}`,
      promoted: new Date(r.promoted_at).toLocaleDateString(),
    },
  })), [verified]);

  const handleRevalidate = async () => {
    const allRows = await listStagingBh();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const targetIds = allRows
      .filter((r) => {
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
    const res = await geocodeStagingBhBulk(targetIds);
    toast.success(`Re-validation complete: ${res.geocoded} geocoded, ${res.failed} failed, ${res.skipped} skipped`);
    await refresh();
  };

  return (
    <AdminMappingLayout
      title="Behavioral Health Mapping"
      description="Operational pipeline for behavioral health providers, facilities, and service locations. Promoted records appear on the Behavioral Health map layer."
    >
      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevalidate}
          title="Re-geocode failed, low-confidence, and stale records"
        >
          Re-validate Geocodes
        </Button>
      </div>
      <PipelineWorkspace
        title="Behavioral health pipeline"
        purpose="Therapists, psychiatrists, BH clinics, IOP/PHP, crisis stabilization, mobile crisis, detox, residential, SUD, MAT-capable locations. Marked Draft until admin sign-off — functionality is complete."
        status="active"
        pipelineKey="behavioral_health"
        schemaSections={SCHEMA_SECTIONS}
        validationRules={VALIDATION_RULES}
        template={BEHAVIORAL_HEALTH_TEMPLATE}
        stagingColumns={STAGING_COLS}
        stagingRows={stagingRows}
        verifiedColumns={VERIFIED_COLS}
        verifiedRows={verifiedRows}
        auditEntries={audit}
        loading={loading}
        uploading={uploading}
        onUpload={handleUpload}
        onPromote={async (id) => { await promoteStagingBh(id); toast.success('Promoted to verified.'); await refresh(); }}
        onGeocodeBulk={async (ids) => {
          const res = await geocodeStagingBhBulk(ids);
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
        }}
        onReject={async (id) => { await rejectStagingBh(id); toast.success('Rejected.'); await refresh(); }}
        onDeactivate={async (id) => { await deactivateVerifiedBh(id); toast.success('Deactivated — removed from map.'); await refresh(); }}
        onRefresh={() => void refresh()}
        onEditStaging={(id) => {
          const row = staging.find((r) => r.id === id);
          if (row) setEditTarget({ scope: 'staging_bh', row });
        }}
        onEditVerified={(id) => {
          const row = verified.find((r) => r.id === id);
          if (row) setEditTarget({ scope: 'verified_bh', row });
        }}
      />
      <EditRecordDialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        title={`Edit BH — ${editTarget?.row.name ?? ''}`}
        scopeLabel={editTarget?.scope === 'verified_bh' ? 'verified BH record (live on map)' : 'staging BH record'}
        fields={EDITABLE_FIELDS}
        initial={(editTarget?.row ?? {}) as unknown as Record<string, unknown>}
        onSave={async (changes) => {
          if (!editTarget) return;
          const next = { ...changes };
          if ('service_tags' in next) {
            next.service_tags = normalizeBhAccessTags(next.service_tags as string | null);
          }
          if ('zip' in next) {
            next.zip = normalizeZip(next.zip);
          }
          await editBhRecord(editTarget.scope, editTarget.row.id, next);
          toast.success('Edit saved.');
          await refresh();
        }}
      />
    </AdminMappingLayout>
  );
}
