/**
 * Admin-only review surface (/admin/unmapped-providers).
 *
 * Lists top utilized providers from the utilization dataset that are NOT
 * confidently matched against any currently mapped facility or rural
 * service. Read-only and advisory:
 *   - No pins are added to the map from this page.
 *   - No scoring, queue, or verification logic is touched.
 *   - Reviewers export a CSV, fill in verified address + lat/lng offline,
 *     and import via the existing CSV import flow.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadUtilizationDataset } from '@/data/utilization';
import {
  analyzeUnmappedProviders,
  type MatchConfidence,
  type UnmappedProviderRow,
} from '@/utils/unmappedProviders';
import { exportCsv } from '@/utils/csvExport';

const confidenceBadge = (c: MatchConfidence) => {
  switch (c) {
    case 'high': return <Badge variant="secondary">High</Badge>;
    case 'medium': return <Badge variant="outline">Medium</Badge>;
    case 'low': return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
    case 'none': return <Badge variant="outline" className="text-muted-foreground">None</Badge>;
  }
};

export default function AdminUnmappedProviders() {
  const perms = usePermissions();
  const [rows, setRows] = useState<UnmappedProviderRow[]>([]);
  const [totals, setTotals] = useState({ providersChecked: 0, alreadyMapped: 0, unmapped: 0, nonSiteCandidates: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideNonSite, setHideNonSite] = useState(false);

  useEffect(() => {
    if (!perms.ready || !perms.isAdmin) return;
    let cancelled = false;
    setLoading(true);
    loadUtilizationDataset()
      .then((ds) => {
        if (cancelled) return;
        const result = analyzeUnmappedProviders(ds.providerUtil, { minGrandTotal: 20 });
        setRows(result.rows);
        setTotals(result.totals);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load utilization data');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [perms.ready, perms.isAdmin]);

  const visibleRows = useMemo(
    () => (hideNonSite ? rows.filter((r) => !r.excludedReason) : rows),
    [rows, hideNonSite],
  );

  const handleExport = () => {
    if (visibleRows.length === 0) return;
    exportCsv(
      visibleRows.map((r) => ({
        provider_name: r.providerName,
        provider_grand_total: r.providerGrandTotal,
        total_distinct_members: r.totalDistinctMembers,
        county_count: r.countyCount,
        top_county: r.topCounty ?? '',
        top_county_members: r.topCountyMembers,
        all_counties: r.counties.join('; '),
        candidate_match: r.candidateMatch ?? '',
        match_confidence: r.matchConfidence,
        excluded_reason: r.excludedReason ?? '',
        // Empty columns for reviewer to fill in for the import flow
        verified_address: '',
        verified_city: '',
        verified_county: '',
        verified_lat: '',
        verified_lng: '',
        npi: '',
        notes: '',
      })),
      [
        { key: 'provider_name', header: 'Provider Name' },
        { key: 'provider_grand_total', header: 'Provider Grand Total' },
        { key: 'total_distinct_members', header: 'Total Distinct Members (sum)' },
        { key: 'county_count', header: 'County Count' },
        { key: 'top_county', header: 'Top County' },
        { key: 'top_county_members', header: 'Top County Members' },
        { key: 'all_counties', header: 'All Counties' },
        { key: 'candidate_match', header: 'Candidate Match' },
        { key: 'match_confidence', header: 'Match Confidence' },
        { key: 'excluded_reason', header: 'Likely Non-Site Reason' },
        { key: 'verified_address', header: 'Verified Address' },
        { key: 'verified_city', header: 'Verified City' },
        { key: 'verified_county', header: 'Verified County' },
        { key: 'verified_lat', header: 'Verified Lat' },
        { key: 'verified_lng', header: 'Verified Lng' },
        { key: 'npi', header: 'NPI' },
        { key: 'notes', header: 'Notes' },
      ],
      `unmapped_top_utilized_providers_${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  if (perms.ready && !perms.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Back to Map</Link>
            </Button>
            <h1 className="text-xl font-semibold">Unmapped Top Utilized Providers</h1>
          </div>
          <Button onClick={handleExport} disabled={visibleRows.length === 0} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          Read-only review list. Compares top utilized providers (Provider Grand Total ≥ 20) against currently mapped
          facilities and services. No pins are added from this page. To add a provider, fill the verified
          address and coordinates in the exported CSV and use the existing Data Import flow.
        </p>

        {/* Summary bar */}
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Providers Checked</div>
            <div className="font-semibold">{totals.providersChecked}</div>
          </div>
          <div className="rounded border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Already Mapped</div>
            <div className="font-semibold">{totals.alreadyMapped}</div>
          </div>
          <div className="rounded border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Unmapped</div>
            <div className="font-semibold">{totals.unmapped}</div>
          </div>
          <div className="rounded border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Likely Non-Site</div>
            <div className="font-semibold">{totals.nonSiteCandidates}</div>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideNonSite}
              onChange={(e) => setHideNonSite(e.target.checked)}
              className="h-3 w-3"
            />
            Hide likely non-site billers (labs, radiology, transport, etc.)
          </label>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading utilization data…</div>}
        {error && <div className="text-sm text-destructive">Error: {error}</div>}

        {!loading && !error && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Provider</th>
                  <th className="text-right px-2 py-2">Grand Total</th>
                  <th className="text-right px-2 py-2">Σ Members</th>
                  <th className="text-left px-2 py-2">Top County</th>
                  <th className="text-right px-2 py-2">Counties</th>
                  <th className="text-left px-2 py-2">Candidate Match</th>
                  <th className="text-left px-2 py-2">Confidence</th>
                  <th className="text-left px-2 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.providerKey} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{r.providerName}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.providerGrandTotal}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.totalDistinctMembers}</td>
                    <td className="px-2 py-1.5">
                      {r.topCounty ? `${r.topCounty} (${r.topCountyMembers})` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.countyCount}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.candidateMatch ?? '—'}</td>
                    <td className="px-2 py-1.5">{confidenceBadge(r.matchConfidence)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.excludedReason ?? ''}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">No rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
