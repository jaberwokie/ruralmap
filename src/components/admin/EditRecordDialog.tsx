/**
 * Modal-based editor for staging or verified Service / BH records.
 *
 * Renders a fixed list of editable fields (passed via `fields`). Changes are
 * diffed against `initial` and only modified fields are submitted. Submission
 * goes through the parent's `onSave` which is responsible for writing the
 * audit entry and refreshing data.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export type EditableFieldType = 'text' | 'number' | 'textarea';

export interface EditableField {
  key: string;
  label: string;
  type?: EditableFieldType;
  placeholder?: string;
}

interface EditRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  scopeLabel: string;
  fields: EditableField[];
  initial: Record<string, unknown>;
  onSave: (changes: Record<string, unknown>) => Promise<void>;
}

const toInputValue = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
};

const coerce = (raw: string, type: EditableFieldType): unknown => {
  if (type === 'number') {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw.trim() === '' ? null : raw;
};

export default function EditRecordDialog({
  open, onOpenChange, title, scopeLabel, fields, initial, onSave,
}: EditRecordDialogProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    fields.forEach((f) => { next[f.key] = toInputValue(initial[f.key]); });
    setDraft(next);
    setErr(null);
  }, [open, fields, initial]);

  const changes = useMemo(() => {
    const out: Record<string, unknown> = {};
    fields.forEach((f) => {
      const next = coerce(draft[f.key] ?? '', f.type ?? 'text');
      const prev = initial[f.key] ?? null;
      const prevNorm = prev === undefined ? null : prev;
      if (next !== prevNorm) out[f.key] = next;
    });
    return out;
  }, [draft, fields, initial]);

  const changedCount = Object.keys(changes).length;

  const handleSubmit = async () => {
    if (changedCount === 0) { onOpenChange(false); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(changes);
      onOpenChange(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="text-[11px]">
            Editing {scopeLabel}. Only modified fields are written; an audit entry is recorded for every change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`edit-${f.key}`} className="text-[11px] text-muted-foreground">
                {f.label}
              </Label>
              {f.type === 'textarea' ? (
                <Textarea
                  id={`edit-${f.key}`}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[12px] min-h-[60px]"
                />
              ) : (
                <Input
                  id={`edit-${f.key}`}
                  type={f.type === 'number' ? 'number' : 'text'}
                  step={f.type === 'number' ? 'any' : undefined}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-[12px] h-8"
                />
              )}
            </div>
          ))}
        </div>
        {err ? <p className="text-[11px] text-rose-600">{err}</p> : null}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {changedCount === 0 ? 'No changes' : `${changedCount} field${changedCount === 1 ? '' : 's'} modified`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || changedCount === 0}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
