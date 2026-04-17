/**
 * Provider Utilization Reach — appended block on facility (billing/rendering provider)
 * detail panel. Renders only when `enabled` AND an EXACT normalized provider-name
 * match exists in the dataset. No fuzzy matching. Returns null on empty data.
 *
 * Display-only. Not consumed by any filter/score/verification pipeline.
 */

import { useMemo } from 'react';
import { useUtilizationData } from '@/hooks/useUtilizationData';
import { normalizeProviderName } from '@/utils/utilizationNormalize';

interface Props {
  providerName: string;
  enabled: boolean;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();

const ProviderUtilizationReachSection = ({ providerName, enabled }: Props) => {
  const { data } = useUtilizationData(enabled);

  const result = useMemo(() => {
    if (!data) return null;
    const key = normalizeProviderName(providerName);
    if (!key) return null;
    const rows = data.indices.providerUtilByKey.get(key);
    if (!rows || rows.length === 0) return null;
    const total = rows.reduce((acc, r) => acc + r.providerGrandTotal, 0);
    return { rows, total, counties: rows.length };
  }, [data, providerName]);

  if (!enabled || !result) return null;

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
          Utilization Reach
        </span>
      </div>
      <div className="mb-1.5 grid grid-cols-2 gap-1">
        <div className="rounded-sm bg-background/60 px-1.5 py-1">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Counties</div>
          <div className="text-[12px] font-semibold tabular-nums text-foreground">{result.counties}</div>
        </div>
        <div className="rounded-sm bg-background/60 px-1.5 py-1">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Total Utilization</div>
          <div className="text-[12px] font-semibold tabular-nums text-foreground">{fmtInt(result.total)}</div>
        </div>
      </div>
      <ul className="space-y-1">
        {result.rows.map((r) => (
          <li
            key={`${r.county}-${r.providerKey}`}
            className="rounded-sm bg-background/60 px-1.5 py-1"
          >
            <div className="truncate text-[11px] font-medium text-foreground">{r.county}</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Members</span>
              <span className="text-[11px] tabular-nums text-foreground">{fmtInt(r.distinctMembers)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Claims</span>
              <span className="text-[11px] tabular-nums text-foreground">{fmtInt(r.providerGrandTotal)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProviderUtilizationReachSection;
