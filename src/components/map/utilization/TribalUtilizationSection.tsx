/**
 * Tribal Utilization — appended block. Only renders when:
 *   - `enabled` (tribalUtilization toggle on)
 *   - `tribalLayerOn` (Tribal Nations layer on)
 *   - a tribal-flag=true row exists for the county with non-zero activity.
 *
 * Display-only. Identification is name-pattern based and directional, not verified.
 */

import { useMemo } from 'react';
import { useUtilizationData } from '@/hooks/useUtilizationData';
import { normalizeCounty } from '@/utils/utilizationNormalize';

interface Props {
  county: string;
  enabled: boolean;
  tribalLayerOn: boolean;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[10px] text-muted-foreground">{label}</span>
    <span className="text-[11px] font-medium tabular-nums text-foreground">{value}</span>
  </div>
);

const TribalUtilizationSection = ({ county, enabled, tribalLayerOn }: Props) => {
  const { data } = useUtilizationData(enabled && tribalLayerOn);

  const record = useMemo(() => {
    if (!data) return null;
    const r = data.indices.tribalByCounty.get(normalizeCounty(county));
    if (!r || !r.tribalProviderFlag) return null;
    if (r.totalClaims <= 0 && r.uniqueMembers <= 0 && r.uniqueProviders <= 0) return null;
    return r;
  }, [data, county]);

  if (!enabled || !tribalLayerOn || !record) return null;

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
        Tribal Utilization
      </div>
      <Row label="Tribal Provider Claims" value={fmtInt(record.totalClaims)} />
      <Row label="Tribal Unique Members" value={fmtInt(record.uniqueMembers)} />
      <Row label="Tribal Provider Count" value={fmtInt(record.uniqueProviders)} />
      <p className="mt-1 text-[9px] leading-snug text-muted-foreground/80">
        Tribal provider identification is based on provider name pattern matching and is directional, not verified.
      </p>
    </div>
  );
};

export default TribalUtilizationSection;
