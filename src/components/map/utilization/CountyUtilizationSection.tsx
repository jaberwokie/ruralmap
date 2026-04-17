/**
 * County-level utilization metrics — appended block on county detail panel.
 * Renders only when `enabled` AND a record exists for the county.
 * Returns null on empty data (no reserved space).
 *
 * Display-only. Not consumed by any filter/score/verification pipeline.
 */

import { useMemo, useState, useCallback } from 'react';
import type { CountyGapSummary } from '@/types/utilization';
import { useUtilizationData } from '@/hooks/useUtilizationData';
import { normalizeCounty } from '@/utils/utilizationNormalize';
import { formatProviderName } from '@/utils/providerNameFormat';
import { useUtilizationProviderClick } from '@/components/map/utilization/UtilizationTogglesContext';

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
  const onProviderClick = useUtilizationProviderClick();
  const normalizedCounty = useMemo(() => normalizeCounty(county), [county]);
  const record = useMemo<CountyGapSummary | undefined>(() => {
    if (!data) return undefined;
    return data.indices.countyGapByCounty.get(normalizedCounty);
  }, [data, normalizedCounty]);
  // Top providers derived from provider_util_flat — same metric (distinct members)
  // used by the share calculation in county_gap_summary. Aggregate labels already excluded.
  const topProviders = useMemo(() => {
    if (!data) return [] as string[];
    const rows = data.indices.providerUtilByCounty.get(normalizedCounty) ?? [];
    return rows.filter((r) => r.distinctMembers > 0).map((r) => r.providerName);
  }, [data, normalizedCounty]);

  if (!enabled || !record) return null;

  const dateRange = fmtDateRange(record.firstServiceDate, record.lastServiceDate);
  const topProvider1 = topProviders[0];
  const topProvider2 = topProviders[1];

  // Decision signals — display-only heuristics. Not used in scoring/filter/queue.
  const signals: Array<{ key: string; label: string; detail: string }> = [];
  const topShare = record.topProviderSharePct;
  const top2Share = record.top2ProviderSharePct;
  if ((Number.isFinite(topShare) && topShare >= 0.4) || (Number.isFinite(top2Share) && top2Share >= 0.6)) {
    signals.push({
      key: 'dependency',
      label: 'High Dependency Risk',
      detail: `Top ${fmtPct(topShare)} · Top 2 ${fmtPct(top2Share)}`,
    });
  }
  if (record.zipMemberCount > 0) {
    const engagement = record.claimsUniqueMembers / record.zipMemberCount;
    if (Number.isFinite(engagement) && engagement < 0.2) {
      signals.push({
        key: 'low-engagement',
        label: 'Low Engagement',
        detail: `${(engagement * 100).toFixed(1)}% of ZIP members with claims`,
      });
    }
  }
  if (record.zipMemberCount >= 100 && Number.isFinite(record.claimsPerZipMember) && record.claimsPerZipMember < 1.5) {
    signals.push({
      key: 'high-demand-low-util',
      label: 'High Demand / Low Utilization',
      detail: `${fmtInt(record.zipMemberCount)} ZIP members · ${fmtNum(record.claimsPerZipMember)} claims/member`,
    });
  }
  if (record.zipMemberCount < 25 || record.claimsUniqueMembers < 10) {
    signals.push({
      key: 'low-data-reliability',
      label: 'Low Data Reliability',
      detail: 'Small population size. Utilization patterns may not reflect stable access.',
    });
  }
  if (record.uniqueClaimProviders < 10 && record.zipMemberCount >= 50) {
    signals.push({
      key: 'thin-provider-base',
      label: 'Thin Provider Base',
      detail: 'Limited provider diversity for population size. Access may be constrained.',
    });
  }

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
        <Row label="Top Provider Share" value={fmtPct(record.topProviderSharePct)} />
        <Row label="Top 2 Provider Share" value={fmtPct(record.top2ProviderSharePct)} />
        {dateRange && <Row label="Service Date Span" value={dateRange} />}
      </div>
      {topProvider1 && (
        <div className="mt-2.5 border-t border-border pt-2">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Top Utilized Providers
          </div>
          <ol className="space-y-1">
            <ProviderEntry rank={1} bold rawName={topProvider1} onProviderClick={onProviderClick} unmatched={unmatched.has(topProvider1)} onUnmatched={markUnmatched} />
            {topProvider2 && (
              <ProviderEntry rank={2} bold={false} rawName={topProvider2} onProviderClick={onProviderClick} unmatched={unmatched.has(topProvider2)} onUnmatched={markUnmatched} />
            )}
          </ol>
        </div>
      )}
      {signals.length > 0 && (
        <div className="mt-2 border-t border-border/60 pt-1.5">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Decision Signals
          </div>
          <ul className="space-y-1">
            {signals.map((s) => (
              <li
                key={s.key}
                className="rounded-sm border border-border/60 bg-background/60 px-1.5 py-1"
              >
                <div className="text-[10px] font-medium text-foreground">{s.label}</div>
                <div className="text-[9px] text-muted-foreground">{s.detail}</div>
              </li>
            ))}
          </ul>
          <p className="mt-1 px-0.5 text-[8px] leading-snug text-muted-foreground/70">
            Heuristic signals — not verified conclusions.
          </p>
        </div>
      )}
    </div>
  );
};

export default CountyUtilizationSection;
