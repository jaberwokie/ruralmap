/**
 * County-level utilization metrics — appended block on county detail panel.
 * Renders only when `enabled` AND a record exists for the county.
 * Returns null on empty data (no reserved space).
 *
 * Display-only. Not consumed by any filter/score/verification pipeline.
 */

import { useMemo } from 'react';
import type { CountyGapSummary } from '@/types/utilization';
import { useUtilizationData } from '@/hooks/useUtilizationData';
import { normalizeCounty } from '@/utils/utilizationNormalize';

interface Props {
  county: string;
  enabled: boolean;
}

const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—');
const fmtNum = (n: number, digits = 2) => (Number.isFinite(n) ? n.toFixed(digits) : '—');
const fmtPct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');
const fmtDateRange = (a: string | null, b: string | null) => {
  const norm = (d: string | null) => (d ? d.slice(0, 10) : null);
  const A = norm(a);
  const B = norm(b);
  if (!A && !B) return null;
  if (A && B) return `${A} → ${B}`;
  return A ?? B;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-[10px] text-muted-foreground">{label}</span>
    <span className="text-[11px] font-medium tabular-nums text-foreground">{value}</span>
  </div>
);

const CountyUtilizationSection = ({ county, enabled }: Props) => {
  const { data } = useUtilizationData(enabled);
  const record = useMemo<CountyGapSummary | undefined>(() => {
    if (!data) return undefined;
    return data.indices.countyGapByCounty.get(normalizeCounty(county));
  }, [data, county]);

  if (!enabled || !record) return null;

  const dateRange = fmtDateRange(record.firstServiceDate, record.lastServiceDate);

  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/40 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80">
          Utilization Metrics
        </span>
      </div>
      <div className="space-y-0">
        <Row label="ZIP Member Count" value={fmtInt(record.zipMemberCount)} />
        <Row label="Claims Unique Members" value={fmtInt(record.claimsUniqueMembers)} />
        <Row label="Member Count Gap" value={fmtInt(record.memberCountGap)} />
        <Row label="Total Claims" value={fmtInt(record.totalClaims)} />
        <Row label="Total Claim Lines" value={fmtInt(record.totalClaimLines)} />
        <Row label="Unique Claim Providers" value={fmtInt(record.uniqueClaimProviders)} />
        <Row label="Claims per Member" value={fmtNum(record.claimsPerMember)} />
        <Row label="Claims per ZIP Member" value={fmtNum(record.claimsPerZipMember)} />
        <Row label="Providers per 100 ZIP Members" value={fmtNum(record.providersPer100ZipMembers, 1)} />
        <Row label="Top Provider" value={record.topProviderName || '—'} />
        <Row label="Top Provider Share" value={fmtPct(record.topProviderSharePct)} />
        <Row label="Top 2 Provider Share" value={fmtPct(record.top2ProviderSharePct)} />
        {dateRange && <Row label="Service Date Span" value={dateRange} />}
      </div>
    </div>
  );
};

export default CountyUtilizationSection;
