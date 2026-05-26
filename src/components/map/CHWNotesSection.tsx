/**
 * CHW Notes section (Phase 3).
 *
 * Append-only operational memory for a provider. Renders inside
 * CoverageDetailPanel's FacilityContent. Does not affect verification,
 * scoring, badges, queue, or decision-support outputs.
 */

import { useEffect, useMemo, useState } from 'react';
import { NotebookPen, PhoneCall, Plus, X } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { logEvent } from '@/lib/metrics/logEvent';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  addProviderNote,
  getProviderNotes,
  markAttemptedContact,
  subscribeToProviderNotes,
  PROVIDER_NOTE_TYPE_LABELS,
  type ProviderNote,
  type ProviderNoteType,
} from '@/utils/providerNotesStore';

interface CHWNotesSectionProps {
  providerId: string;
}

const NOTE_TYPE_OPTIONS: ProviderNoteType[] = [
  'contact_attempt',
  'barrier',
  'scheduling',
  'referral_outcome',
  'needs_verification',
  'general',
];

const formatTimestamp = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const CHWNotesSection = ({ providerId }: CHWNotesSectionProps) => {
  const perms = usePermissions();
  const identity = perms.user?.email ?? perms.user?.id ?? 'unknown-user';

  const [notes, setNotes] = useState<ProviderNote[]>(() => getProviderNotes(providerId));
  const [mode, setMode] = useState<'idle' | 'add' | 'attempt'>('idle');
  const [draftType, setDraftType] = useState<ProviderNoteType>('general');
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    setNotes(getProviderNotes(providerId));
    setMode('idle');
    setDraftType('general');
    setDraftText('');
    const unsub = subscribeToProviderNotes(providerId, () => {
      setNotes(getProviderNotes(providerId));
    });
    return unsub;
  }, [providerId]);

  const mostRecentId = notes[0]?.id;
  const count = notes.length;

  const resetDraft = () => {
    setMode('idle');
    setDraftType('general');
    setDraftText('');
  };

  const handleAddNote = () => {
    addProviderNote({
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider_id: providerId,
      note_type: draftType,
      text: draftText.trim() || undefined,
      created_at: new Date().toISOString(),
      created_by: identity,
      source: 'chw',
    });
    logEvent('chw_note_added', { provider: providerId, note_type: draftType });
    resetDraft();
  };

  const handleAttempt = () => {
    markAttemptedContact(providerId, identity, draftText.trim() || undefined);
    logEvent('attempted_contact_marked', { provider: providerId });
    resetDraft();
  };

  return (
    <div className="border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          CHW Notes{count > 0 ? ` · ${count}` : ''}
        </h4>
      </div>

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraftType('general');
              setDraftText('');
              setMode('add');
            }}
          >
            <Plus className="w-3 h-3" />
            Add Note
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraftText('');
              setMode('attempt');
            }}
          >
            <PhoneCall className="w-3 h-3" />
            Mark Attempted Contact
          </Button>
        </div>
      )}

      {mode === 'add' && (
        <div className="space-y-2 mb-3 p-2 rounded-md border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">New note</span>
            <button
              type="button"
              onClick={resetDraft}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Select value={draftType} onValueChange={(v) => setDraftType(v as ProviderNoteType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {PROVIDER_NOTE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Optional details…"
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetDraft}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={handleAddNote}>
              Save Note
            </Button>
          </div>
        </div>
      )}

      {mode === 'attempt' && (
        <div className="space-y-2 mb-3 p-2 rounded-md border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-foreground">Log contact attempt</span>
            <button
              type="button"
              onClick={resetDraft}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Optional: what happened? (no answer, voicemail, etc.)"
            className="min-h-[50px] text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetDraft}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={handleAttempt}>
              Log Attempt
            </Button>
          </div>
        </div>
      )}

      {count === 0 ? (
        <p className="text-[11px] text-muted-foreground/80 italic">No notes yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((n) => {
            const isRecent = n.id === mostRecentId;
            return (
              <li
                key={n.id}
                className={`text-xs rounded-md px-2 py-1.5 border ${
                  isRecent ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <NotebookPen className="w-3 h-3 text-muted-foreground" />
                    {PROVIDER_NOTE_TYPE_LABELS[n.note_type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(n.created_at)}
                  </span>
                </div>
                {n.text && (
                  <p className="mt-1 text-[11px] text-foreground/90" style={{ wordBreak: 'break-word' }}>
                    {n.text}
                  </p>
                )}
                {n.created_by && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">by {n.created_by}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CHWNotesSection;
