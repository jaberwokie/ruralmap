/**
 * Verification Priority Queue panel with workflow tracking and CSV export.
 * Outreach state persisted in localStorage — no source data mutations.
 */
import { useCallback, useMemo, useState } from 'react';
import { Download, Pencil, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  deriveVerificationQueue,
  PRIORITY_TIER_LABELS,
  PRIORITY_TIER_COLORS,
  type VerificationPriorityRecord,
  type PriorityTier,
} from '@/utils/verificationPriorityQueue';
import { OPERATIONAL_ACCESS_LABELS, FRESHNESS_LABELS } from '@/types/service-lines';

// ── Outreach workflow types ──

export type OutreachStatus = 'not_started' | 'attempted' | 'reached' | 'confirmed' | 'not_offered' | 'wrong_listing' | 'call_back_later';

export interface OutreachRecord {
  verification_outreach_status: OutreachStatus;
  verification_outreach_date: string | null;
  verification_outreach_by: string | null;
  verification_outreach_notes: string | null;
}

const OUTREACH_STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'reached', label: 'Reached' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'not_offered', label: 'Not Offered' },
  { value: 'wrong_listing', label: 'Wrong Listing' },
  { value: 'call_back_later', label: 'Call Back Later' },
];

const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = Object.fromEntries(
  OUTREACH_STATUS_OPTIONS.map(o => [o.value, o.label])
) as Record<OutreachStatus, string>;

const OUTREACH_STATUS_COLORS: Record<OutreachStatus, string> = {
  not_started: 'text-muted-foreground',
  attempted: 'text-amber-600',
  reached: 'text-blue-600',
  confirmed: 'text-emerald-600',
  not_offered: 'text-muted-foreground',
  wrong_listing: 'text-destructive',
  call_back_later: 'text-amber-600',
};

// ── localStorage persistence ──

const STORAGE_KEY = 'nbh_verification_outreach';

function loadOutreachMap(): Map<string, OutreachRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, OutreachRecord>;
    return new Map(Object.entries(parsed));
  } catch { return new Map(); }
}

function saveOutreachMap(map: Map<string, OutreachRecord>) {
  const obj: Record<string, OutreachRecord> = {};
  map.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function outreachKey(entityId: string, serviceLine: string) {
  return `${entityId}::${serviceLine}`;
}

// ── CSV export ──

function exportQueueCsv(
  records: VerificationPriorityRecord[],
  outreachMap: Map<string, OutreachRecord>,
) {
  const headers = [
    'Priority Tier', 'Priority Score', 'Entity Name', 'County', 'Service Line',
    'Operational Access', 'Verification Status', 'Verification Freshness',
    'Fallback Destination', 'Dependent Counties', 'Priority Reasons',
    'Outreach Status', 'Outreach Date', 'Outreach By', 'Outreach Notes',
  ];

  const escCsv = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const rows = records.map(r => {
    const o = outreachMap.get(outreachKey(r.entity_id, r.service_line));
    return [
      PRIORITY_TIER_LABELS[r.priority_tier],
      String(r.priority_score),
      r.entity_name,
      r.county,
      r.service_line,
      r.operational_access ? (OPERATIONAL_ACCESS_LABELS[r.operational_access] ?? r.operational_access) : '',
      r.verification_status ?? '',
      r.verification_freshness ? FRESHNESS_LABELS[r.verification_freshness] : '',
      r.is_fallback_destination ? 'Yes' : 'No',
      r.dependent_counties.join('; '),
      r.priority_reason.join('; '),
      o ? OUTREACH_STATUS_LABELS[o.verification_outreach_status] : 'Not Started',
      o?.verification_outreach_date ?? '',
      o?.verification_outreach_by ?? '',
      o?.verification_outreach_notes ?? '',
    ].map(escCsv).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `verification_priority_queue_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Filters ──

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

// ── Inline edit form ──

const OutreachEditForm = ({
  record,
  initial,
  onSave,
  onCancel,
}: {
  record: VerificationPriorityRecord;
  initial: OutreachRecord | undefined;
  onSave: (rec: OutreachRecord) => void;
  onCancel: () => void;
}) => {
  const [status, setStatus] = useState<OutreachStatus>(initial?.verification_outreach_status ?? 'not_started');
  const [date, setDate] = useState(initial?.verification_outreach_date ?? new Date().toISOString().slice(0, 10));
  const [by, setBy] = useState(initial?.verification_outreach_by ?? '');
  const [notes, setNotes] = useState(initial?.verification_outreach_notes ?? '');

  return (
    <div className="rounded-md border border-border bg-card p-2 space-y-1.5 my-1" onClick={e => e.stopPropagation()}>
      <div className="text-[10px] font-semibold text-foreground truncate">{record.entity_name}</div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[9px] text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as OutreachStatus)}
            className="w-full rounded border border-border bg-secondary text-[10px] px-1 py-0.5 text-foreground"
          >
            {OUTREACH_STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded border border-border bg-secondary text-[10px] px-1 py-0.5 text-foreground"
          />
        </div>
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground">By</label>
        <input
          type="text"
          value={by}
          onChange={e => setBy(e.target.value)}
          placeholder="Staff name"
          className="w-full rounded border border-border bg-secondary text-[10px] px-1 py-0.5 text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Outreach details..."
          className="w-full rounded border border-border bg-secondary text-[10px] px-1 py-1 text-foreground placeholder:text-muted-foreground/50 resize-none"
        />
      </div>
      <div className="flex gap-1.5 justify-end">
        <button onClick={onCancel} className="px-2 py-0.5 rounded text-[10px] border border-border text-muted-foreground hover:bg-secondary">Cancel</button>
        <button
          onClick={() => onSave({
            verification_outreach_status: status,
            verification_outreach_date: date || null,
            verification_outreach_by: by || null,
            verification_outreach_notes: notes || null,
          })}
          className="px-2 py-0.5 rounded text-[10px] border border-foreground bg-foreground text-background hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
};

// ── Main panel ──

const VerificationPriorityPanel = () => {
  const queue = useMemo(() => deriveVerificationQueue(), []);
  const [serviceFilter, setServiceFilter] = useState<'all' | 'psychiatry' | 'inpatient'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | PriorityTier>('all');
  const [outreachMap, setOutreachMap] = useState(() => loadOutreachMap());
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let records = queue;
    if (serviceFilter !== 'all') records = records.filter(r => r.service_line === serviceFilter);
    if (tierFilter !== 'all') records = records.filter(r => r.priority_tier === tierFilter);
    return records;
  }, [queue, serviceFilter, tierFilter]);

  const highCount = queue.filter(r => r.priority_tier === 'high').length;
  const medCount = queue.filter(r => r.priority_tier === 'medium').length;

  const handleSaveOutreach = useCallback((key: string, rec: OutreachRecord) => {
    setOutreachMap(prev => {
      const next = new Map(prev);
      next.set(key, rec);
      saveOutreachMap(next);
      return next;
    });
    setEditingKey(null);
  }, []);

  return (
    <div className="space-y-2">
      {/* Summary + export */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-destructive tabular-nums">{highCount} High</span>
          <span className="text-[10px] font-bold text-amber-600 tabular-nums">{medCount} Medium</span>
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{queue.length} Total</span>
        </div>
        <button
          onClick={() => exportQueueCsv(filtered, outreachMap)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border border-border text-muted-foreground hover:bg-secondary/80 transition-colors"
          title="Export filtered queue as CSV"
        >
          <Download className="w-3 h-3" />
          CSV
        </button>
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
                <TableHead className="text-[9px] px-1.5 h-8">Outreach</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8">Last Date</TableHead>
                <TableHead className="text-[9px] px-1.5 h-8 w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => {
                const key = outreachKey(rec.entity_id, rec.service_line);
                const outreach = outreachMap.get(key);
                const isEditing = editingKey === key;
                const statusLabel = outreach ? OUTREACH_STATUS_LABELS[outreach.verification_outreach_status] : 'Not Started';
                const statusColor = outreach ? OUTREACH_STATUS_COLORS[outreach.verification_outreach_status] : 'text-muted-foreground';

                return (
                  <TableRow key={key}>
                    <TableCell className={`text-[10px] px-1.5 py-1 font-bold ${PRIORITY_TIER_COLORS[rec.priority_tier]}`}>
                      {PRIORITY_TIER_LABELS[rec.priority_tier]}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 font-medium text-foreground max-w-[120px]">
                      <div className="truncate" title={rec.entity_name}>{rec.entity_name}</div>
                      {isEditing && (
                        <OutreachEditForm
                          record={rec}
                          initial={outreach}
                          onSave={(r) => handleSaveOutreach(key, r)}
                          onCancel={() => setEditingKey(null)}
                        />
                      )}
                      {!isEditing && rec.priority_reason.length > 0 && (
                        <ul className="list-none mt-0.5">
                          {rec.priority_reason.slice(0, 2).map((r, i) => (
                            <li key={i} className="text-[9px] text-muted-foreground/70 leading-tight">• {r}</li>
                          ))}
                          {rec.priority_reason.length > 2 && (
                            <li className="text-[9px] text-muted-foreground/50 leading-tight">+{rec.priority_reason.length - 2} more</li>
                          )}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">{rec.county}</TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground capitalize">{rec.service_line}</TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">
                      {rec.verification_freshness ? FRESHNESS_LABELS[rec.verification_freshness] : '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground">
                      {rec.operational_access ? (OPERATIONAL_ACCESS_LABELS[rec.operational_access] ?? rec.operational_access) : '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground tabular-nums">
                      {rec.dependent_county_count > 0 ? rec.dependent_counties.join(', ') : '—'}
                    </TableCell>
                    <TableCell className={`text-[10px] px-1.5 py-1 font-medium ${statusColor}`}>
                      {statusLabel}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1 text-muted-foreground tabular-nums">
                      {outreach?.verification_outreach_date ?? '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-1.5 py-1">
                      <button
                        onClick={() => setEditingKey(isEditing ? null : key)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title={isEditing ? 'Close' : 'Edit outreach'}
                      >
                        {isEditing ? <X className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default VerificationPriorityPanel;
