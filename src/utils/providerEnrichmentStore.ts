/**
 * Provider Metadata Enrichment store.
 *
 * Distinct from importedFacilitiesStore. This DOES NOT create map pins,
 * does NOT participate in scoring, verification, queue, or filters. It is
 * a side-table of imported/unverified metadata keyed by stable provider id
 * that the detail panel can opt-in to surface as "Imported / Unverified".
 *
 * Persistence: localStorage only (matches existing import store pattern).
 * Shape is chosen so a future Supabase swap is a one-file change.
 */

const STORAGE_KEY = 'nbh_provider_enrichment_v1';
const AUDIT_KEY = 'nbh_provider_enrichment_audit_v1';
const EVENT_NAME = 'nbh:provider-enrichment-changed';

export interface ProviderEnrichmentRecord {
  /** Stable id of the matched Facility (Facility.id). */
  provider_id: string;
  /** Display name of the matched provider at apply time (audit aid). */
  matched_provider_name: string;

  imported_npi?: string;
  imported_phone?: string;
  imported_website?: string;
  imported_subtype?: string;
  imported_source?: string;
  imported_medicaid_participation?: string;
  imported_psychiatric_flag?: string;
  imported_inpatient_flag?: string;
  imported_state?: string;
  imported_zip?: string;
  imported_notes?: string;

  enrichment_source_file_name: string;
  enrichment_imported_at: string; // ISO
  enrichment_imported_by?: string; // admin email or id
  enrichment_status: 'imported_unverified';
}

export interface EnrichmentAuditEntry {
  timestamp: string;
  admin: string | null;
  source_file_name: string;
  rows_processed: number;
  rows_applied: number;
  rows_unmatched: number;
  rows_ambiguous: number;
}

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

// ── Records ────────────────────────────────────────────────
export const getEnrichmentRecords = (): Record<string, ProviderEnrichmentRecord> => {
  if (typeof window === 'undefined') return {};
  return safeParse<Record<string, ProviderEnrichmentRecord>>(
    window.localStorage.getItem(STORAGE_KEY),
    {},
  );
};

export const getEnrichmentForProvider = (providerId: string): ProviderEnrichmentRecord | undefined => {
  return getEnrichmentRecords()[providerId];
};

const writeEnrichmentRecords = (next: Record<string, ProviderEnrichmentRecord>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[providerEnrichmentStore] failed to persist', err);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

/** Replace-on-conflict per provider_id. Caller already filtered to applied rows. */
export const upsertEnrichmentRecords = (records: ProviderEnrichmentRecord[]): void => {
  const current = getEnrichmentRecords();
  for (const r of records) {
    current[r.provider_id] = r;
  }
  writeEnrichmentRecords(current);
};

export const clearEnrichmentRecords = (): void => writeEnrichmentRecords({});

export const subscribeToEnrichment = (cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
  const onCustom = () => cb();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom as EventListener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom as EventListener);
  };
};

// ── Audit ──────────────────────────────────────────────────
export const getEnrichmentAudit = (): EnrichmentAuditEntry[] => {
  if (typeof window === 'undefined') return [];
  return safeParse<EnrichmentAuditEntry[]>(window.localStorage.getItem(AUDIT_KEY), []);
};

export const appendEnrichmentAudit = (entry: EnrichmentAuditEntry): void => {
  if (typeof window === 'undefined') return;
  const next = [entry, ...getEnrichmentAudit()].slice(0, 200);
  try {
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[providerEnrichmentStore] failed to persist audit', err);
  }
};
