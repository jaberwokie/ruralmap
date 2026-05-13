import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import PipelineWorkspace from '@/components/admin/PipelineWorkspace';
import type { StagingTableRow } from '@/components/admin/PipelineWorkspace';
import {
  listRuralServices,
  editRuralServiceRecord,
} from '@/utils/mappingPipelineStore';
import { parseGeocodeTag, isGeocodeFailed } from '@/utils/serviceGeocode';
import { supabase } from '@/integrations/supabase/client';

const STAGING_COLS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'city', label: 'City', sortable: true },
  { key: 'county', label: 'County', sortable: true },
  { key: 'coords', label: 'Coords' },
  { key: 'geocode_confidence', label: 'Geocode', sortable: true },
];

export default function AdminMappingRuralServices() {
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

  return (
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
      onPromote={async () => {}}
      onReject={async () => {}}
      onDeactivate={async () => {}}
      onRefresh={refresh}
      onGeocodeBulk={handleGeocodeBulk}
    />
  );
}
