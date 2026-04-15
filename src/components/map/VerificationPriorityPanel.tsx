/**
 * Verification Priority Queue panel — a simple table view of derived priority records.
 * Reuses existing visual patterns (table, muted colors, semantic tokens).
 */
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  deriveVerificationQueue,
  PRIORITY_TIER_LABELS,
  PRIORITY_TIER_COLORS,
  type VerificationPriorityRecord,
  type PriorityTier,
} from '@/utils/verificationPriorityQueue';
import { OPERATIONAL_ACCESS_LABELS, FRESHNESS_LABELS } from '@/types/service-lines';

const FILTER_OPTIONS: { value: 'all' | 'psychiatry' | 'inpatient'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'inpatient', label: 'Inpatient' },
];

const TIER_FILTER_OPTIONS: { value: 'all' | PriorityTier; label: string }[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const VerificationPriorityPanel = () => {
  const queue = useMemo(() => deriveVerificationQueue(), []);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'psychiatry' | 'inpatient'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | PriorityTier>('all');

  const filtered = useMemo(() => {
    let records = queue;
    if (serviceFilter !== 'all') records = records.filter(r => r.service_line === serviceFilter);
    if (tierFilter !== 'all') records = records.filter(r => r.priority_tier === tierFilter);
    return records;
  }, [queue, serviceFilter, tierFilter]);

  const highCount = queue.filter(r => r.priority_tier === 'high').length;
  const medCount = queue.filter(r => r.priority_tier === 'medium').length;

  return (
    <div className="space-y-2">
      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-destructive tabular-nums">{highCount} High</span>
        <span className="text-[10px] font-bold text-amber-600 tabular-nums">{medCount} Medium</span>
        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{queue.length} Total</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setServiceFilter(opt.value)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              serviceFilter === opt.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-muted-foreground text-[9px]">·</span>
        {TIER_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTierFilter(opt.value)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              tierFilter === opt.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic py-2">No records match current filters.</p>
      ) : (
        <div className="max-h-[400px] overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[9px] px-1.5 h-8">Tier</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Entity</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">County</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Line</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Freshness</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Access</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Dep.</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => (
                <TableRow key={`${rec.entity_id}-${rec.service_line}`}>
                  <TableCell className={`text-[10px] px-1.5 py-1 font-bold ${PRIORITY_TIER_COLORS[rec.priority_tier]}`}>
                    {PRIORITY_TIER_LABELS[rec.priority_tier]}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 font-medium text-foreground max-w-[120px] truncate">
                    {rec.entity_name}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">
                    {rec.county}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground capitalize">
                    {rec.service_line}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">
                    {rec.verification_freshness ? FRESHNESS_LABELS[rec.verification_freshness] : '—'}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">
                    {rec.operational_access ? (OPERATIONAL_ACCESS_LABELS[rec.operational_access] ?? rec.operational_access) : '—'}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground tabular-nums">
                    {rec.dependent_county_count > 0 ? rec.dependent_counties.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground max-w-[160px]">
                    <ul className="list-none space-y-0.5">
                      {rec.priority_reason.map((r, i) => (
                        <li key={i} className="leading-tight">• {r}</li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default VerificationPriorityPanel;
