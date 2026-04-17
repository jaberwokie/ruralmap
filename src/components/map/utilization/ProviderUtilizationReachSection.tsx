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

    // Source field `Provider Grand Total` is provider-wide (repeated identically on
    // every county row), NOT a per-county claim count. We surface it once as the
    // provider total and avoid summing it across counties (which would multiply it
    // by the number of counties).
    //
    // `Distinct Members` IS per-county (member county-scoped). De-dupe defensively
    // by county in case the source ever contains true row duplicates.
    const byCounty = new Map<string, { county: string; distinctMembers: number }>();
    for (const r of rows) {
      if (!r.county) continue;
      const existing = byCounty.get(r.county);
      if (!existing) {
        byCounty.set(r.county, { county: r.county, distinctMembers: r.distinctMembers });
      } else {
        // Same provider+county appearing twice: keep the larger member count.
        existing.distinctMembers = Math.max(existing.distinctMembers, r.distinctMembers);
      }
    }
    const countyRows = Array.from(byCounty.values())
      .filter((r) => r.distinctMembers > 0)
      .sort((a, b) => b.distinctMembers - a.distinctMembers);

    // Provider grand total: take the max across rows (they should all be identical;
    // max is robust if any row is missing/zero).
    const providerTotal = rows.reduce((m, r) => Math.max(m, r.providerGrandTotal), 0);

    return {
      countyRows,
      providerTotal,
      counties: countyRows.length,
      hasCountyBreakdown: countyRows.length > 0,
    };
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
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Provider Total Claims</div>
          <div className="text-[12px] font-semibold tabular-nums text-foreground">{fmtInt(result.providerTotal)}</div>
        </div>
      </div>
      {result.hasCountyBreakdown ? (
        <>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-muted-foreground">
            Members by county
          </div>
          <ul className="space-y-1">
            {result.countyRows.map((r) => (
              <li
                key={r.county}
                className="rounded-sm bg-background/60 px-1.5 py-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-foreground">{r.county}</span>
                  <span className="text-[11px] tabular-nums text-foreground">{fmtInt(r.distinctMembers)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="rounded-sm bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground">
          County-level utilization not available
        </div>
      )}
    </div>
  );
};

export default ProviderUtilizationReachSection;
