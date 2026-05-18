import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import PipelineWorkspace from '@/components/admin/PipelineWorkspace';
import type { StagingTableRow } from '@/components/admin/PipelineWorkspace';
import { Button } from '@/components/ui/button';
import {
  listRuralServices,
  editRuralServiceRecord,
} from '@/utils/mappingPipelineStore';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv } from '@/utils/csvExport';

const STAGING_COLS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'county', label: 'County', sortable: true },
  { key: 'coords', label: 'Coords' },
  { key: 'geocode_confidence', label: 'Geocode', sortable: true },
];

export default function AdminMappingRuralServices() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listRuralServices();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const stagingRows: StagingTableRow[] = rows.map(r => {
    const tag = parseGeocodeTag(r.access_notes);
    const failed = isGeocodeFailed(r.access_notes);
    const geocodeStatus: 'geocoded' | 'failed' | null = failed ? 'failed' : (r.lat != null ? 'geocoded' : null);
    const geocodeConfidence: 'high' | 'low' | null = tag?.confidence ?? null;
    return {
      id: r.id,
      review_status: r.review_status ?? 'pending',
      validation_severity: null,
      validation_messages: [],
      mappable: r.mappable ?? true,
      has_coords: r.lat != null && r.lng != null,
      geocode_status: geocodeStatus,
      geocode_confidence: geocodeConfidence,
      cells: {
        name: r.name,
        category: r.category,
        city: r.city ?? '—',
        county: r.county ?? '—',
        coords: r.lat != null && r.lng != null
          ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`
          : '—',
        geocode_confidence: (() => {
          if (failed) return <span style={{ color: '#ef4444', fontWeight: 600 }}>● Failed</span>;
          if (!tag) return <span style={{ color: '#9ca3af' }}>○ None</span>;
          if (tag.confidence === 'high' && tag.strategy === 'address_full') return <span style={{ color: '#22c55e', fontWeight: 600 }}>● High</span>;
          if (tag.strategy === 'census_onelineaddress') return <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Census</span>;
          return <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Low</span>;
        })(),
      },
    };
  });

  const handleGeocodeBulk = async (ids: string[]) => {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-bulk`;
    await supabase.from('rural_services').update({ lat: null, lng: null, access_notes: null }).in('id', ids);
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'rural_services', limit: 100, offset: 0 }),
    });
    const result = await res.json();
    toast.success(`Geocoded: ${result.geocoded} success, ${result.failed} failed`);
    await refresh();
  };

  const handleExport = () => {
    if (rows.length === 0) return;
    exportCsv(
      rows.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category ?? '',
        city: r.city ?? '',
        county: r.county ?? '',
        street_address: r.street_address ?? '',
        state: r.state ?? '',
        zip: r.zip ?? '',
        phone: r.phone ?? '',
        website: r.website ?? '',
        lat: r.lat ?? '',
        lng: r.lng ?? '',
        access_notes: r.access_notes ?? '',
        review_status: r.review_status ?? '',
        bh_category_mapped: r.bh_category_mapped ?? '',
        bh_entity_type: r.bh_entity_type ?? '',
        bh_service_type: r.bh_service_type ?? '',
        service_tags: Array.isArray(r.service_tags) ? r.service_tags.join('|') : (r.service_tags ?? ''),
        created_at: r.created_at ?? '',
      })),
      [
        { key: 'id', header: 'id' },
        { key: 'name', header: 'name' },
        { key: 'category', header: 'category' },
        { key: 'city', header: 'city' },
        { key: 'county', header: 'county' },
        { key: 'street_address', header: 'street_address' },
        { key: 'state', header: 'state' },
        { key: 'zip', header: 'zip' },
        { key: 'phone', header: 'phone' },
        { key: 'website', header: 'website' },
        { key: 'lat', header: 'lat' },
        { key: 'lng', header: 'lng' },
        { key: 'access_notes', header: 'access_notes' },
        { key: 'review_status', header: 'review_status' },
        { key: 'bh_category_mapped', header: 'bh_category_mapped' },
        { key: 'bh_entity_type', header: 'bh_entity_type' },
        { key: 'bh_service_type', header: 'bh_service_type' },
        { key: 'service_tags', header: 'service_tags' },
        { key: 'created_at', header: 'created_at' },
      ],
      'rural_services_export.csv',
    );
  };

  return (
    <AdminMappingLayout title="Rural Services Mapping" description="Manage rural community service records with geocode validation.">
    <div className="mb-3 flex justify-end">
      <Button variant="outline" size="sm" onClick={handleExport}>Export CSV</Button>
    </div>
    <PipelineWorkspace
      title="Rural Services Mapping"
      purpose="Manage rural community service records. These appear as community service pins on the map."
      status="active"
      schemaSections={[
        {
          heading: 'Identity',
          fields: [
            { name: 'name', description: 'Name', required: true },
            { name: 'category', description: 'Category' },
            { name: 'city', description: 'City' },
            { name: 'county', description: 'County' },
            { name: 'street_address', description: 'Street Address' },
          ],
        },
      ]}
      validationRules={['Name is required']}
      template={{
        filename: 'rural_services_template.csv',
        headers: ['name', 'category', 'city', 'county', 'street_address', 'state', 'zip', 'phone', 'website'],
        exampleRow: {
          name: 'Elko Community Food Pantry',
          category: 'Food',
          city: 'Elko',
          county: 'Elko',
          street_address: '123 Main St',
          state: 'NV',
          zip: '89801',
          phone: '775-555-0100',
          website: 'https://example.org',
        },
      }}
      stagingColumns={STAGING_COLS}
      stagingRows={stagingRows}
      verifiedColumns={[]}
      verifiedRows={[]}
      auditEntries={[]}
      loading={loading}
      uploading={false}
      onUpload={async () => {}}
      onPromote={async (id) => {
        try {
          await editRuralServiceRecord(id, { review_status: 'approved', verification_status: 'verified' });
          toast.success('Service approved');
          await refresh();
        } catch (e: any) {
          toast.error(e?.message ?? 'Approve failed');
        }
      }}
      onReject={async (id) => {
        try {
          await editRuralServiceRecord(id, { review_status: 'rejected' });
          toast.success('Service rejected');
          await refresh();
        } catch (e: any) {
          toast.error(e?.message ?? 'Reject failed');
        }
      }}
      onDeactivate={async () => {}}
      onRefresh={refresh}
      onGeocodeBulk={handleGeocodeBulk}
    />
    </AdminMappingLayout>
  );
}
