import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import PipelineWorkspace from '@/components/admin/PipelineWorkspace';
import {
  listStagingFacilities,
  rejectStagingFacility,
  promoteStagingFacility,
  promoteStagingFacilitiesBulk,
  geocodeStagingFacilitiesBulk,
  insertStagingFacilities,
} from '@/utils/mappingPipelineStore';
import { parseCsvText } from '@/utils/mappingPipelineCsv';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';
import { exportCsv } from '@/utils/csvExport';

const STAGING_COLS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'county', label: 'County', sortable: true },
  { key: 'coords', label: 'Coords' },
  { key: 'geocode_confidence', label: 'Geocode', sortable: true },
];

export default function AdminMappingFacilitiesStaging() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listStagingFacilities();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const { rows: parsed } = parseCsvText(text);
      if (parsed.length === 0) { toast.error('CSV had no data rows.'); return; }
      const importBatchId = crypto.randomUUID();
      const res = await insertStagingFacilities(parsed, { fileName: file.name, importBatchId });
      toast.success(`Inserted ${res.inserted} facilities (${res.errors} errors)`);
      await refresh();
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const stagingRows = rows.map((r: any) => {
    const tag = parseGeocodeTag(r.access_notes);
    const failed = isGeocodeFailed(r.access_notes);
    return {
      id: r.id,
      review_status: r.review_status ?? 'pending',
      validation_severity: r.validation_severity ?? null,
      validation_messages: r.validation_messages ?? [],
      mappable: r.mappable ?? true,
      has_coords: r.latitude != null && r.longitude != null,
      geocode_status: (failed ? 'failed' : (r.latitude != null ? 'geocoded' : null)) as 'geocoded' | 'failed' | null,
      geocode_confidence: tag?.confidence ?? null,
      cells: {
        name: r.name,
        type: r.type,
        city: r.city ?? '—',
        county: r.county ?? '—',
        coords: r.latitude != null && r.longitude != null
          ? `${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`
          : '—',
        geocode_confidence: (() => {
          if (failed) {
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
      },
    };
  });

  const handleExport = () => {
    if (rows.length === 0) return;
    exportCsv(
      rows.map((r: any) => ({
        id: r.id, name: r.name, type: r.type ?? '',
        city: r.city ?? '', county: r.county ?? '',
        street_address: r.street_address ?? '', state: r.state ?? '', zip: r.zip ?? '',
        phone: r.phone ?? '', website: r.website ?? '',
        latitude: r.latitude ?? '', longitude: r.longitude ?? '',
        access_notes: r.access_notes ?? '', review_status: r.review_status ?? '',
      })),
      [
        { key: 'id', header: 'id' }, { key: 'name', header: 'name' },
        { key: 'type', header: 'type' }, { key: 'city', header: 'city' },
        { key: 'county', header: 'county' }, { key: 'street_address', header: 'street_address' },
        { key: 'state', header: 'state' }, { key: 'zip', header: 'zip' },
        { key: 'phone', header: 'phone' }, { key: 'website', header: 'website' },
        { key: 'latitude', header: 'latitude' }, { key: 'longitude', header: 'longitude' },
        { key: 'access_notes', header: 'access_notes' }, { key: 'review_status', header: 'review_status' },
      ],
      'staging_facilities_export.csv',
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/mapping')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Overview
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>
      <PipelineWorkspace
        title="Facility Staging Pipeline"
        purpose="Upload, validate, geocode, and promote facility records. Records must be promoted before appearing on the live map."
        status="active"
        schemaSections={[
          {
            heading: 'Identity',
            fields: [
              { name: 'name', required: true },
              { name: 'type', required: true },
              { name: 'city' },
              { name: 'county' },
              { name: 'street_address' },
              { name: 'state' },
              { name: 'zip' },
              { name: 'phone' },
              { name: 'website' },
            ],
          },
        ]}
        validationRules={['Name is required', 'Type is required']}
        template={{
          filename: 'facilities_template.csv',
          headers: ['name', 'type', 'city', 'county', 'street_address', 'state', 'zip', 'phone', 'website'],
          exampleRow: {
            name: 'Example Facility',
            type: 'hospital',
            city: 'Las Vegas',
            county: 'Clark',
            street_address: '123 Main St',
            state: 'NV',
            zip: '89101',
            phone: '555-1234',
            website: 'https://example.com',
          },
        }}
        stagingColumns={STAGING_COLS}
        stagingRows={stagingRows}
        verifiedColumns={[]}
        verifiedRows={[]}
        auditEntries={[]}
        loading={loading}
        uploading={uploading}
        onUpload={handleUpload}
        onPromote={async (id) => {
          console.log('[PROMOTE-DEBUG] page.onPromote:entry', { id });
          try {
            await promoteStagingFacility(id);
            console.log('[PROMOTE-DEBUG] page.onPromote:store returned OK', { id });
            toast.success('Facility promoted to live map');
            console.log('[PROMOTE-DEBUG] page.onPromote:success toast fired');
            await refresh();
            console.log('[PROMOTE-DEBUG] page.onPromote:refresh done');
          } catch (e: any) {
            console.error('[PROMOTE-DEBUG] page.onPromote:caught error', e);
            toast.error(e?.message ?? 'Promotion failed');
            console.log('[PROMOTE-DEBUG] page.onPromote:error toast fired');
          }
        }}
        onPromoteBulk={async (ids) => {
          await promoteStagingFacilitiesBulk(ids);
          toast.success(`${ids.length} facilities promoted`);
          await refresh();
        }}
        onGeocodeBulk={async (ids) => {
          toast.info(`Geocoding ${ids.length} facilities…`);
          const result = await geocodeStagingFacilitiesBulk(ids);
          toast.success(`Geocoded: ${result.geocoded} success, ${result.failed} failed, ${result.skipped} skipped`);
          await refresh();
        }}
        onReject={async (id) => {
          await rejectStagingFacility(id);
          toast.success('Facility rejected');
          await refresh();
        }}
        onDeactivate={async () => {}}
        onRefresh={refresh}
      />
    </div>
  );
}
