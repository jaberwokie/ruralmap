/**
 * Validation for Service + BH staging records.
 *
 * Returns structured messages with severity. Used both during CSV intake
 * and for displaying inline issues in the staging review table.
 */

import type {
  ValidationMessage,
  ValidationSeverity,
  StagingServiceRow,
  StagingBhRow,
} from '@/types/mappingPipeline';

const SERVICE_CATEGORIES = new Set([
  'food', 'shelter', 'transportation', 'employment', 'recovery',
  'peer support', 'case management', 'outreach', 'hygiene',
  'benefits navigation', 'community support', 'housing', 'legal',
  'family services', 'senior services', 'disability services',
]);

const BH_ENTITY_TYPES = new Set([
  'therapist', 'psychiatrist', 'psychologist', 'clinic', 'outpatient',
  'iop', 'php', 'crisis', 'mobile crisis', 'detox', 'residential',
  'sud', 'mat', 'specialty mental health',
]);

const NEVADA_STATE_VALUES = new Set(['nv', 'nevada']);

const isFiniteLat = (v: number | null) => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isFiniteLng = (v: number | null) => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

const severityRank = (s: ValidationSeverity): number =>
  s === 'error' ? 2 : s === 'warning' ? 1 : 0;

export const summarizeSeverity = (messages: ValidationMessage[]): ValidationSeverity => {
  if (messages.some((m) => m.severity === 'error')) return 'error';
  if (messages.some((m) => m.severity === 'warning')) return 'warning';
  return 'valid';
};

export const validateServiceRow = (row: Partial<StagingServiceRow>): ValidationMessage[] => {
  const out: ValidationMessage[] = [];

  if (!row.name || row.name.trim().length === 0) {
    out.push({ field: 'name', severity: 'error', message: 'Name is required.' });
  }

  const hasLat = row.latitude != null;
  const hasLng = row.longitude != null;
  if (hasLat !== hasLng) {
    out.push({
      field: 'latitude/longitude',
      severity: 'error',
      message: 'Latitude and longitude must be provided together.',
    });
  }
  if (hasLat && !isFiniteLat(row.latitude ?? null)) {
    out.push({ field: 'latitude', severity: 'error', message: 'Latitude must be between -90 and 90.' });
  }
  if (hasLng && !isFiniteLng(row.longitude ?? null)) {
    out.push({ field: 'longitude', severity: 'error', message: 'Longitude must be between -180 and 180.' });
  }
  if (!hasLat && !hasLng && !row.street_address) {
    out.push({
      field: 'address',
      severity: 'warning',
      message: 'No coordinates and no street address — record will not place on the map.',
    });
  }

  if (row.service_category) {
    const lc = row.service_category.toLowerCase();
    const matchesAny = Array.from(SERVICE_CATEGORIES).some((c) => lc.includes(c));
    if (!matchesAny) {
      out.push({
        field: 'service_category',
        severity: 'warning',
        message: `"${row.service_category}" is not in the standard category list.`,
      });
    }
  }

  if (row.state) {
    if (!NEVADA_STATE_VALUES.has(row.state.toLowerCase())) {
      out.push({
        field: 'state',
        severity: 'warning',
        message: `State is "${row.state}" — non-Nevada records may not appear on the Nevada map.`,
      });
    }
  }

  if (row.zip && !/^\d{5}(-\d{4})?$/.test(row.zip)) {
    out.push({ field: 'zip', severity: 'warning', message: 'ZIP should be 5 digits or ZIP+4.' });
  }

  return out;
};

export const validateBhRow = (row: Partial<StagingBhRow>): ValidationMessage[] => {
  const out: ValidationMessage[] = [];

  if (!row.name || row.name.trim().length === 0) {
    out.push({ field: 'name', severity: 'error', message: 'Name is required.' });
  }

  const hasLat = row.latitude != null;
  const hasLng = row.longitude != null;
  if (hasLat !== hasLng) {
    out.push({
      field: 'latitude/longitude',
      severity: 'error',
      message: 'Latitude and longitude must be provided together.',
    });
  }
  if (hasLat && !isFiniteLat(row.latitude ?? null)) {
    out.push({ field: 'latitude', severity: 'error', message: 'Latitude must be between -90 and 90.' });
  }
  if (hasLng && !isFiniteLng(row.longitude ?? null)) {
    out.push({ field: 'longitude', severity: 'error', message: 'Longitude must be between -180 and 180.' });
  }
  if (!hasLat && !hasLng && !row.street_address) {
    out.push({
      field: 'address',
      severity: 'warning',
      message: 'No coordinates and no street address — record will not place on the map.',
    });
  }

  if (row.npi) {
    if (!/^\d{10}$/.test(row.npi)) {
      out.push({ field: 'npi', severity: 'error', message: 'NPI must be exactly 10 digits.' });
    }
  }

  if (row.bh_entity_type) {
    const lc = row.bh_entity_type.toLowerCase();
    const matchesAny = Array.from(BH_ENTITY_TYPES).some((c) => lc.includes(c));
    if (!matchesAny) {
      out.push({
        field: 'bh_entity_type',
        severity: 'warning',
        message: `"${row.bh_entity_type}" is not in the standard BH entity type list.`,
      });
    }
  }

  if (row.state && !NEVADA_STATE_VALUES.has(row.state.toLowerCase())) {
    out.push({
      field: 'state',
      severity: 'warning',
      message: `State is "${row.state}" — non-Nevada records may not appear on the Nevada map.`,
    });
  }

  if (row.zip && !/^\d{5}(-\d{4})?$/.test(row.zip)) {
    out.push({ field: 'zip', severity: 'warning', message: 'ZIP should be 5 digits or ZIP+4.' });
  }

  return out;
};

export const sortBySeverity = <T extends { validation_severity: ValidationSeverity | null }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => severityRank((b.validation_severity ?? 'valid')) - severityRank((a.validation_severity ?? 'valid')));
