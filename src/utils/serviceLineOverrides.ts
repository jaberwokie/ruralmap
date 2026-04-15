/**
 * Service-line verification override persistence.
 * Applies localStorage overrides to defaultFacilities psychiatric/inpatient fields
 * so all derived computations (freshness, access, fallback, queue) recompute naturally.
 */
import { defaultFacilities } from '@/data/facilities';
import type { PsychiatricServiceFields, InpatientServiceFields } from '@/types/service-lines';

const STORAGE_KEY = 'nbh_serviceline_overrides';

export interface ServiceLineOverride {
  entity_id: string;
  service_line: 'psychiatry' | 'inpatient';
  fields: Partial<PsychiatricServiceFields> | Partial<InpatientServiceFields>;
  applied_at: string;
  applied_by: string | null;
}

function loadOverrides(): ServiceLineOverride[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOverrides(overrides: ServiceLineOverride[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

/** Apply all stored overrides to defaultFacilities in-place */
export function applyStoredOverrides() {
  const overrides = loadOverrides();
  for (const o of overrides) {
    const fac = defaultFacilities.find(f => f.id === o.entity_id);
    if (!fac) continue;
    if (o.service_line === 'psychiatry') {
      fac.psychiatric = { ...fac.psychiatric, ...(o.fields as Partial<PsychiatricServiceFields>) };
    } else {
      fac.inpatient = { ...fac.inpatient, ...(o.fields as Partial<InpatientServiceFields>) };
    }
  }
}

/** Save a new override and apply it immediately */
export function applyVerificationOverride(override: ServiceLineOverride) {
  const existing = loadOverrides();
  // Replace if same entity+service_line already exists
  const idx = existing.findIndex(o => o.entity_id === override.entity_id && o.service_line === override.service_line);
  if (idx >= 0) existing[idx] = override;
  else existing.push(override);
  saveOverrides(existing);

  // Apply to in-memory facility
  const fac = defaultFacilities.find(f => f.id === override.entity_id);
  if (!fac) return;
  if (override.service_line === 'psychiatry') {
    fac.psychiatric = { ...fac.psychiatric, ...(override.fields as Partial<PsychiatricServiceFields>) };
  } else {
    fac.inpatient = { ...fac.inpatient, ...(override.fields as Partial<InpatientServiceFields>) };
  }
}

/** Get count of applied overrides */
export function getOverrideCount(): number {
  return loadOverrides().length;
}

// Apply on module load so all downstream code sees overrides
applyStoredOverrides();
