/**
 * Admin > Mapping > Behavioral Health Mapping.
 *
 * Pipeline pending. Full schema/upload UI rendered with the upload disabled.
 * No writes occur. BH ingestion will route into the existing BH layer
 * pipeline once enabled — it does not merge into the provider pipeline.
 */

import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import MappingImportShell from '@/components/admin/MappingImportShell';
import { BEHAVIORAL_HEALTH_TEMPLATE } from '@/utils/csvTemplates';

export default function AdminMappingBehavioralHealth() {
  return (
    <AdminMappingLayout
      title="Behavioral Health Mapping"
      description="Behavioral health locations and resources for the BH map layer."
    >
      <MappingImportShell
        title="Behavioral health location ingestion"
        purpose="Upload behavioral health resources. Entries render as purple BH pins, with counts, icons, and filters preserved."
        required={[
          { name: 'name', description: 'BH facility or resource name' },
          { name: 'latitude', description: '-90 to 90' },
          { name: 'longitude', description: '-180 to 180' },
        ]}
        optional={[
          { name: 'bh_type' }, { name: 'city' }, { name: 'county' }, { name: 'state' },
          { name: 'zip' }, { name: 'address' }, { name: 'phone' }, { name: 'website' },
          { name: 'organization' }, { name: 'medicaid_participation' },
          { name: 'psychiatric_flag' }, { name: 'outpatient_flag' }, { name: 'crisis_flag' },
          { name: 'notes' }, { name: 'source' }, { name: 'active' },
        ]}
        validationRules={[
          'Rows without name or coordinates will be rejected.',
          'Coordinates must be valid finite numbers within range.',
          'BH imports do not merge into the provider pipeline.',
          'Existing BH layer behavior, counts, icons, and filters are preserved.',
        ]}
        sampleColumns={['name', 'latitude', 'longitude', 'bh_type', 'city', 'county']}
        sampleRows={[
          { name: 'Rural Clinics Community Mental Health — Elko', latitude: '40.82613', longitude: '-115.76359', bh_type: 'Outpatient', city: 'Elko', county: 'Elko' },
          { name: 'Bridges to Recovery — Fallon', latitude: '39.47368', longitude: '-118.77745', bh_type: 'SUD Outpatient', city: 'Fallon', county: 'Churchill' },
        ]}
        pipelinePending
        template={BEHAVIORAL_HEALTH_TEMPLATE}
      />
    </AdminMappingLayout>
  );
}
