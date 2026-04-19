/**
 * Renders an "Imported / Unverified Metadata" block in the provider detail
 * panel. Pulls from the local enrichment store. Strictly additive — never
 * overwrites verified fields, never alters badges or queue logic.
 */

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import {
  getEnrichmentForProvider,
  subscribeToEnrichment,
  type ProviderEnrichmentRecord,
} from '@/utils/providerEnrichmentStore';

const FIELD_LABELS: { key: keyof ProviderEnrichmentRecord; label: string }[] = [
  { key: 'imported_phone', label: 'Phone' },
  { key: 'imported_website', label: 'Website' },
  { key: 'imported_npi', label: 'NPI' },
  { key: 'imported_subtype', label: 'Subtype' },
  { key: 'imported_medicaid_participation', label: 'Medicaid (imported)' },
  { key: 'imported_psychiatric_flag', label: 'Psychiatric flag (imported)' },
  { key: 'imported_inpatient_flag', label: 'Inpatient flag (imported)' },
  { key: 'imported_state', label: 'State' },
  { key: 'imported_zip', label: 'ZIP' },
  { key: 'imported_source', label: 'Source' },
  { key: 'imported_notes', label: 'Notes' },
];

interface Props {
  providerId: string;
}

export const ImportedMetadataSection = ({ providerId }: Props) => {
  const [record, setRecord] = useState<ProviderEnrichmentRecord | undefined>(() =>
    getEnrichmentForProvider(providerId),
  );

  useEffect(() => {
    setRecord(getEnrichmentForProvider(providerId));
    return subscribeToEnrichment(() => setRecord(getEnrichmentForProvider(providerId)));
  }, [providerId]);

  if (!record) return null;

  const populated = FIELD_LABELS.filter(({ key }) => {
    const v = record[key];
    return typeof v === 'string' && v.trim() !== '';
  });

  if (populated.length === 0) return null;

  return (
    <div className="mt-3 rounded border border-dashed border-engagement-watch/40 bg-engagement-watch/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Tag className="h-3 w-3 text-engagement-watch" />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-engagement-watch">
          Imported / Unverified Metadata
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        {populated.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground" style={{ wordBreak: 'break-word' }}>{String(record[key])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        From {record.enrichment_source_file_name} · {new Date(record.enrichment_imported_at).toLocaleDateString()}
        . Not authoritative — does not override verified fields.
      </p>
    </div>
  );
};

export default ImportedMetadataSection;
