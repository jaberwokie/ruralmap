import { useState, useMemo, type FormEvent } from 'react';
import { toast } from 'sonner';
import OpsLayout from '@/components/ops/OpsLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { logEvent } from '@/lib/metrics/logEvent';
import { nevadaCounties } from '@/data/nevada-counties';

type EntryType = 'chw_note' | 'attempted_contact';

export default function OpsDataCapture() {
  const ruralCounties = useMemo(
    () => nevadaCounties.filter((c) => !c.isPrimary).map((c) => c.name).sort(),
    [],
  );

  const [county, setCounty] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [entryType, setEntryType] = useState<EntryType>('chw_note');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!county) {
      toast.error('Select a county');
      return;
    }
    if (!note.trim()) {
      toast.error('Note is required');
      return;
    }
    setSubmitting(true);
    const payload = {
      county,
      provider_name: providerName.trim() || null,
      note: note.trim(),
    };
    if (entryType === 'chw_note') {
      logEvent('chw_note_added', payload);
      toast.success('CHW note logged');
    } else {
      logEvent('attempted_contact_marked', payload);
      toast.success('Attempted contact logged');
    }
    setCounty('');
    setProviderName('');
    setEntryType('chw_note');
    setNote('');
    setSubmitting(false);
  };

  return (
    <OpsLayout
      title="Field Data Entry"
      description="Log a CHW note or an attempted contact without locating a provider pin on the map."
    >
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="ops-county">County</Label>
          <Select value={county} onValueChange={setCounty}>
            <SelectTrigger id="ops-county">
              <SelectValue placeholder="Select a rural county" />
            </SelectTrigger>
            <SelectContent>
              {ruralCounties.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ops-provider">Provider name <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="ops-provider"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g. Battle Mountain General Hospital"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Entry type</Label>
          <RadioGroup
            value={entryType}
            onValueChange={(v) => setEntryType(v as EntryType)}
            className="flex flex-col gap-2 sm:flex-row sm:gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="entry-chw" value="chw_note" />
              <Label htmlFor="entry-chw" className="font-normal">CHW Note</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="entry-contact" value="attempted_contact" />
              <Label htmlFor="entry-contact" className="font-normal">Attempted Contact</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ops-note">Note</Label>
          <Textarea
            id="ops-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened, who you spoke with, next step…"
            rows={5}
            required
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Submit'}
          </Button>
        </div>
      </form>
    </OpsLayout>
  );
}
