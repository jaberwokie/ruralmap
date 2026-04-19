/**
 * CHW Notes store (Phase 3).
 *
 * Lightweight, additive operational memory attached to a provider_id.
 * Strictly does NOT modify provider data, scoring, verification, badges,
 * routing tiers, or decision-support outputs. Append-only; no edits/deletes.
 *
 * Persistence: localStorage only (mirrors providerEnrichmentStore pattern).
 * Shape chosen so a future Supabase swap is a one-file change.
 */

const STORAGE_KEY = 'nbh_provider_notes_v1';
const EVENT_NAME = 'nbh:provider-notes-changed';
const MAX_NOTES = 200;

export type ProviderNoteType =
  | 'contact_attempt'
  | 'barrier'
  | 'scheduling'
  | 'referral_outcome'
  | 'needs_verification'
  | 'general';

export const PROVIDER_NOTE_TYPE_LABELS: Record<ProviderNoteType, string> = {
  contact_attempt: 'Contact Attempt',
  barrier: 'Barrier',
  scheduling: 'Scheduling',
  referral_outcome: 'Referral Outcome',
  needs_verification: 'Needs Verification',
  general: 'General',
};

export interface ProviderNote {
  id: string;
  provider_id: string;
  note_type: ProviderNoteType;
  text?: string;
  created_at: string; // ISO
  created_by?: string;
  source: 'chw';
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

const readAll = (): ProviderNote[] => {
  if (typeof window === 'undefined') return [];
  return safeParse<ProviderNote[]>(window.localStorage.getItem(STORAGE_KEY), []);
};

const writeAll = (next: ProviderNote[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[providerNotesStore] failed to persist', err);
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

/** Returns notes for a provider, newest first. */
export const getProviderNotes = (providerId: string): ProviderNote[] => {
  return readAll()
    .filter((n) => n.provider_id === providerId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};

/** Append a new note. Caps global store at MAX_NOTES (oldest dropped). */
export const addProviderNote = (note: ProviderNote): void => {
  const all = readAll();
  all.unshift(note);
  // Sort newest first then trim
  all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const trimmed = all.slice(0, MAX_NOTES);
  writeAll(trimmed);
};

/** Convenience: log a contact attempt as a note. */
export const markAttemptedContact = (
  providerId: string,
  createdBy?: string,
  text?: string,
): void => {
  addProviderNote({
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider_id: providerId,
    note_type: 'contact_attempt',
    text: text?.trim() || undefined,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    source: 'chw',
  });
};

/** Subscribe to changes scoped to a single provider id. */
export const subscribeToProviderNotes = (
  providerId: string,
  cb: () => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom as EventListener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom as EventListener);
  };
};
