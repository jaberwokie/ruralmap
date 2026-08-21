/**
 * Phase 2D — explicit resource table contracts.
 *
 * The resource geocoding pipeline must never guess column names or assume that
 * every table shares the same shape. Every supported table is declared here
 * once, and the pipeline refuses any table name that is not in this map. There
 * are no dynamic/arbitrary table names.
 */

export interface ResourceTableContract {
  /** Display coordinate columns owned by the canonical record. */
  latColumn: string;
  lngColumn: string;
  /** Curated manual coordinate columns, when the table has them. */
  manualLatColumn: string | null;
  manualLngColumn: string | null;
  /** `coordinate_locked` support. */
  hasCoordinateLock: boolean;
  /** `mappable` (list-only vs mapped) semantics. */
  hasMappable: boolean;
  /** `active_status` semantics. */
  hasActiveStatus: boolean;
  /** Record-level geocode provenance columns. */
  hasProvenanceColumns: boolean;
  /** Human-authored operational note column (tag-only edits allowed). */
  hasAccessNotes: boolean;
  /** Soft-delete column (`deleted_at`). */
  hasSoftDelete: boolean;
  /** Mapping audit pipeline label. */
  auditPipeline: string;
}

export const RESOURCE_TABLE_CONTRACTS: Record<string, ResourceTableContract> = {
  facilities: {
    latColumn: 'lat',
    lngColumn: 'lng',
    manualLatColumn: 'manual_lat',
    manualLngColumn: 'manual_lng',
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: false,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'facilities',
  },
  rural_services: {
    latColumn: 'lat',
    lngColumn: 'lng',
    manualLatColumn: 'manual_lat',
    manualLngColumn: 'manual_lng',
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: false,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'rural_services',
  },
  verified_services: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: 'manual_lat',
    manualLngColumn: 'manual_lng',
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: true,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'services',
  },
  verified_bh: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: 'manual_lat',
    manualLngColumn: 'manual_lng',
    hasCoordinateLock: true,
    hasMappable: false,
    hasActiveStatus: true,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'behavioral_health',
  },
  staging_services: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: null,
    manualLngColumn: null,
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: true,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'services',
  },
  staging_bh: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: null,
    manualLngColumn: null,
    hasCoordinateLock: true,
    hasMappable: false,
    hasActiveStatus: true,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'behavioral_health',
  },
  staging_facilities: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: null,
    manualLngColumn: null,
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: false,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: false,
    auditPipeline: 'facilities',
  },
  staging_rural_services: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: null,
    manualLngColumn: null,
    hasCoordinateLock: true,
    hasMappable: true,
    hasActiveStatus: false,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: false,
    auditPipeline: 'rural_services',
  },
  staging_providers: {
    latColumn: 'latitude',
    lngColumn: 'longitude',
    manualLatColumn: null,
    manualLngColumn: null,
    hasCoordinateLock: true,
    hasMappable: false,
    hasActiveStatus: true,
    hasProvenanceColumns: true,
    hasAccessNotes: true,
    hasSoftDelete: true,
    auditPipeline: 'providers',
  },
};

export type ResourceTableName = keyof typeof RESOURCE_TABLE_CONTRACTS;

export const RESOURCE_TABLES = Object.keys(RESOURCE_TABLE_CONTRACTS) as ResourceTableName[];

export const getResourceTableContract = (
  table: string | null | undefined,
): ResourceTableContract | null =>
  (table && Object.prototype.hasOwnProperty.call(RESOURCE_TABLE_CONTRACTS, table))
    ? RESOURCE_TABLE_CONTRACTS[table]
    : null;

/**
 * A record's display coordinate is protected when it is locked or when the
 * table carries a curated manual coordinate. Protection is NEVER inferred from
 * the mere presence of a coordinate.
 */
export const isRecordCoordinateProtected = (
  record: Record<string, unknown>,
  contract: ResourceTableContract,
): boolean => {
  if (contract.hasCoordinateLock && record.coordinate_locked === true) return true;
  if (contract.manualLatColumn && contract.manualLngColumn) {
    const mLat = record[contract.manualLatColumn];
    const mLng = record[contract.manualLngColumn];
    if (typeof mLat === 'number' && Number.isFinite(mLat) && typeof mLng === 'number' && Number.isFinite(mLng)) {
      return true;
    }
  }
  return false;
};
