/**
 * Admin > Mapping > Service Mapping.
 *
 * Pipeline pending. Full schema/upload UI rendered with the upload disabled.
 * No writes occur. Structure is locked so users see exactly how this will
 * function once enabled.
 */

import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import MappingImportShell from '@/components/admin/MappingImportShell';
import { SERVICE_TEMPLATE } from '@/utils/csvTemplates';

export default function AdminMappingServices() {
  return (
    <AdminMappingLayout
      title="Service Mapping"
      description="Community service and resource locations for the Services map layer."
    >
      <MappingImportShell
        title="Service location ingestion"
        purpose="Upload community service and resource locations. Each row appears as a Services-layer pin and is filterable like existing entries."
        required={[
          { name: 'name', description: 'Service or resource name' },
          { name: 'latitude', description: '-90 to 90' },
          { name: 'longitude', description: '-180 to 180' },
        ]}
        optional={[
          { name: 'service_type' }, { name: 'category' }, { name: 'subcategory' },
          { name: 'city' }, { name: 'county' }, { name: 'state' }, { name: 'zip' },
          { name: 'address' }, { name: 'phone' }, { name: 'website' },
          { name: 'organization' }, { name: 'eligibility' }, { name: 'hours' },
          { name: 'notes' }, { name: 'source' }, { name: 'active' },
          { name: 'medicaid_related' }, { name: 'tribal_affiliation' },
        ]}
        validationRules={[
          'Rows without name or coordinates will be rejected.',
          'Coordinates must be valid finite numbers within range.',
          'Provider verification fields are not applied to service imports.',
          'Existing service rendering, classification, and filter behavior is preserved.',
        ]}
        sampleColumns={['name', 'latitude', 'longitude', 'service_type', 'city', 'county']}
        sampleRows={[
          { name: 'Elko Community Food Pantry', latitude: '40.83242', longitude: '-115.76313', service_type: 'Food Assistance', city: 'Elko', county: 'Elko' },
          { name: 'Carson Valley Family Resource Center', latitude: '38.93366', longitude: '-119.77321', service_type: 'Family Support', city: 'Minden', county: 'Douglas' },
        ]}
        pipelinePending
      />
    </AdminMappingLayout>
  );
}
