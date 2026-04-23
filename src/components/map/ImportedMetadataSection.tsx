/**
 * Renders an "Imported / Unverified Metadata" block in the provider detail
 * panel. Pulls from the local enrichment store. Strictly additive — never
 * overwrites verified fields, never alters badges or queue logic.
 *
 * Adds two interpretive cues (still clearly secondary to verified data):
 *   • Derived confidence chip (Low / Medium / High, unverified)
 *   • Conflict notice when imported values differ from verified record
 */

import { useEffect, useState } from 'react';
import { Tag, AlertTriangle } from 'lucide-react';
import { usePublicSafeMode } from '@/hooks/usePublicSafeMode';
import {
  getEnrichmentForProvider,
  subscribeToEnrichment,
  type ProviderEnrichmentRecord,
} from '@/utils/providerEnrichmentStore';
import {
  deriveEnrichmentConfidence,
  detectEnrichmentConflicts,
  ENRICHMENT_CONFIDENCE_LABELS,
  type EnrichmentConfidence,
} from '@/utils/enrichmentConfidence';
import type { Facility } from '@/data/facilities';

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

const CONFIDENCE_CHIP: Record<EnrichmentConfidence, { bg: string; color: string; border: string }> = {
  low:    { bg: 'hsl(0, 0%, 96%)',   color: 'hsl(0, 0%, 35%)',   border: 'hsl(0, 0%, 80%)' },
  medium: { bg: 'hsl(38, 85%, 96%)', color: 'hsl(38, 85%, 35%)', border: 'hsl(38, 85%, 80%)' },
  high:   { bg: 'hsl(142, 60%, 95%)', color: 'hsl(142, 60%, 30%)', border: 'hsl(142, 60%, 75%)' },
};

interface Props {
  providerId: string;
  facility?: Facility;
}

export const ImportedMetadataSection = ({ providerId, facility }: Props) => {
  const { isPublicSafe } = usePublicSafeMode();
  const [record, setRecord] = useState<ProviderEnrichmentRecord | undefined>(() =>
    getEnrichmentForProvider(providerId),
  );

  useEffect(() => {
    setRecord(getEnrichmentForProvider(providerId));
    return subscribeToEnrichment(() => setRecord(getEnrichmentForProvider(providerId)));
  }, [providerId]);

  // PUBLIC_SAFE_MODE: hide "Imported / Unverified Metadata" block entirely —
  // exposes internal enrichment workflow terminology in public screenshots.
  if (isPublicSafe) return null;

  if (!record) return null;

  const populated = FIELD_LABELS.filter(({ key }) => {
    const v = record[key];
    return typeof v === 'string' && v.trim() !== '';
  });

  if (populated.length === 0) return null;

  const confidence = deriveEnrichmentConfidence(record);
  const chip = CONFIDENCE_CHIP[confidence];
  const conflicts = facility ? detectEnrichmentConflicts(facility, record) : [];

  return (
    <div className="mt-3 rounded border border-dashed border-engagement-watch/40 bg-engagement-watch/5 p-2.5">
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Tag className="h-3 w-3 text-engagement-watch flex-shrink-0" />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-engagement-watch truncate">
            Imported / Unverified Metadata
          </span>
        </div>
        <span
          className="inline-flex items-center rounded border px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
          style={{ background: chip.bg, color: chip.color, borderColor: chip.border }}
          title="Derived from imported fields. Not a verification signal."
        >
          {ENRICHMENT_CONFIDENCE_LABELS[confidence]} (unverified)
        </span>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-1.5 rounded border border-destructive/40 bg-destructive/5 px-1.5 py-1">
          <div className="flex items-center gap-1 mb-0.5">
            <AlertTriangle className="h-2.5 w-2.5 text-destructive flex-shrink-0" />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-destructive">
              Imported data differs from verified record
            </span>
          </div>
          <ul className="text-[10px] text-foreground/85 space-y-0.5">
            {conflicts.map((c) => (
              <li key={c.field}>
                <span className="capitalize">{c.field}</span>: imported "{c.imported}" vs verified "{c.verified}"
              </li>
            ))}
          </ul>
        </div>
      )}

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
