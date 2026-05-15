/**
 * Centralized pipeline status truth for Admin → Mapping.
 *
 * Every card, tab, and pipeline header reads its chip from this file.
 * To change a pipeline's status anywhere in Admin → Mapping, edit ONLY
 * this file — never hardcode chip labels in pages/components.
 */

export type MappingPipelineStatus =
  | 'active'
  | 'active_limited'
  | 'draft'
  | 'pending'
  | 'disabled';

export type MappingPipelineKey =
  | 'provider_mapping'
  | 'provider_metadata'
  | 'services'
  | 'behavioral_health'
  | 'verification_queue'
  | 'audit_history'
  | 'pipeline_audit'
  | 'data_import'
  | 'facilities'
  | 'rural_services'
  | 'facility_staging'
  | 'rural_services_staging';

export interface MappingPipelineStatusEntry {
  status: MappingPipelineStatus;
  label: string;
  /** Short inline note shown next to the chip when space allows. */
  note?: string;
  /** Long-form tooltip; falls back to `note` if absent. */
  tooltip?: string;
}

export const MAPPING_PIPELINE_STATUS: Record<MappingPipelineKey, MappingPipelineStatusEntry> = {
  provider_mapping: {
    status: 'active',
    label: 'ACTIVE',
  },
  provider_metadata: {
    status: 'active_limited',
    label: 'ACTIVE',
    note: 'Metadata only. Never creates pins.',
  },
  services: {
    status: 'active',
    label: 'ACTIVE',
  },
  behavioral_health: {
    status: 'active',
    label: 'ACTIVE',
  },
  verification_queue: {
    status: 'active',
    label: 'ACTIVE',
  },
  audit_history: {
    status: 'active',
    label: 'ACTIVE',
  },
  pipeline_audit: {
    status: 'active',
    label: 'ACTIVE',
  },
  data_import: {
    status: 'active',
    label: 'ACTIVE',
  },
  facilities: {
    status: 'active',
    label: 'ACTIVE',
  },
  rural_services: {
    status: 'active',
    label: 'ACTIVE',
  },
};

export const getMappingPipelineStatus = (key: MappingPipelineKey): MappingPipelineStatusEntry =>
  MAPPING_PIPELINE_STATUS[key];
