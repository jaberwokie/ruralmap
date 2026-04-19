/**
 * Admin > Mapping > Provider Metadata Enrichment.
 *
 * Second-pass enrichment: attaches imported/unverified metadata to existing
 * providers. NEVER creates new pins. NEVER auto-applies ambiguous matches.
 * NEVER overwrites verified fields.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import MappingImportShell from '@/components/admin/MappingImportShell';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { PROVIDER_ENRICHMENT_TEMPLATE } from '@/utils/csvTemplates';
import {
  parseEnrichmentCsv,
  matchEnrichmentRows,
  buildEnrichmentRecord,
  type EnrichmentMatchResult,
  type EnrichmentParseResult,
  ENRICHMENT_OPTIONAL_FIELDS,
} from '@/utils/providerEnrichmentImport';
import {
  upsertEnrichmentRecords,
  appendEnrichmentAudit,
  getEnrichmentAudit,
} from '@/utils/providerEnrichmentStore';
import type { Filters } from '@/types/filters';

const EMPTY_FILTERS: Filters = { types: new Set<string>(), counties: new Set<string>(), serviceCategories: new Set<string>() };

const StatusBadge = ({ status }: { status: 'matched' | 'ambiguous' | 'unmatched' }) => {
  const cls =
    status === 'matched'
      ? 'border-staffing-high/40 bg-staffing-high/10 text-staffing-high'
      : status === 'ambiguous'
      ? 'border-engagement-watch/40 bg-engagement-watch/10 text-engagement-watch'
      : 'border-destructive/40 bg-destructive/10 text-destructive';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
};

export default function AdminMappingProviderMetadata() {
  const perms = usePermissions();
  const { facilities } = useFacilityData(EMPTY_FILTERS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<EnrichmentParseResult | null>(null);
  const [matches, setMatches] = useState<EnrichmentMatchResult[] | null>(null);
  const [applied, setApplied] = useState<{ count: number; at: string } | null>(null);

  const providerPool = useMemo(
    () => facilities.filter((f) => f.type === 'hospital' || f.type === 'clinic'),
    [facilities],
  );

  const counts = useMemo(() => {
    if (!matches) return null;
    return {
      total: matches.length,
      matched: matches.filter((m) => m.status === 'matched').length,
      ambiguous: matches.filter((m) => m.status === 'ambiguous').length,
      unmatched: matches.filter((m) => m.status === 'unmatched').length,
    };
  }, [matches]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are accepted.');
      return;
    }
    setParsing(true);
    setApplied(null);
    setParsed(null);
    setMatches(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => { toast.error('Failed to read file.'); setParsing(false); };
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) { toast.error('Failed to read file.'); setParsing(false); return; }
      const p = parseEnrichmentCsv(text);
      setParsed(p);
      if (p.headerErrors.length === 0 && p.rows.length > 0) {
        setMatches(matchEnrichmentRows(p.rows, providerPool));
      } else if (p.headerErrors.length > 0) {
        toast.error(p.headerErrors[0]);
      }
      setParsing(false);
    };
    reader.readAsText(file);
  }, [providerPool]);

  const onUploadClick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const applyEnrichment = () => {
    if (!matches || !fileName) return;
    if (!perms.canImportData) {
      toast.error('You do not have permission to apply enrichment.');
      return;
    }
    // Audit identity: prefer authenticated email, then user id, then a generic
    // fallback. Never use role as identity — role is permission, not identity.
    const actor =
      perms.user?.email ?? perms.user?.id ?? 'unknown-admin';
    const records = matches
      .map((m) => buildEnrichmentRecord(m, { sourceFileName: fileName, importedBy: actor }))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    upsertEnrichmentRecords(records);
    const audit = {
      timestamp: new Date().toISOString(),
      admin: actor,
      source_file_name: fileName,
      rows_processed: matches.length,
      rows_applied: records.length,
      rows_unmatched: matches.filter((m) => m.status === 'unmatched').length,
      rows_ambiguous: matches.filter((m) => m.status === 'ambiguous').length,
    };
    appendEnrichmentAudit(audit);
    setApplied({ count: records.length, at: audit.timestamp });
    toast.success(`Applied enrichment to ${records.length} provider${records.length === 1 ? '' : 's'}.`);
  };

  const recentAudit = useMemo(() => getEnrichmentAudit().slice(0, 5), [applied]);

  const uploadSlot = (
    <div className="mt-3 space-y-3">
      <Button onClick={onUploadClick} disabled={parsing} className="w-full">
        <Upload className="h-4 w-4 mr-1" />
        {parsing ? 'Parsing…' : 'Upload enrichment CSV'}
      </Button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      {parsed && parsed.headerErrors.length > 0 && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>{parsed.headerErrors.join(' · ')}</div>
          </div>
        </div>
      )}
      {counts && (
        <div className="rounded border border-border bg-muted/30 p-2 text-xs space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <div>Total rows: <span className="font-semibold">{counts.total}</span></div>
            <div>Matched: <span className="font-semibold text-staffing-high">{counts.matched}</span></div>
            <div>Ambiguous: <span className="font-semibold text-engagement-watch">{counts.ambiguous}</span></div>
            <div>Unmatched: <span className="font-semibold text-destructive">{counts.unmatched}</span></div>
          </div>
          {parsed && parsed.invalid.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {parsed.invalid.length} row{parsed.invalid.length === 1 ? '' : 's'} rejected before matching (missing required fields).
            </div>
          )}
          {!applied && counts.matched > 0 && (
            <Button onClick={applyEnrichment} size="sm" className="mt-2 w-full" disabled={!perms.canImportData}>
              Apply enrichment to {counts.matched} matched
            </Button>
          )}
          {applied && (
            <p className="mt-1 text-[11px] font-medium text-foreground inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-staffing-high" />
              Applied {applied.count} record{applied.count === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AdminMappingLayout
      title="Provider Metadata Enrichment"
      description="Attach imported/unverified metadata to existing providers. This workflow does not create map pins, does not overwrite verified fields, and does not auto-apply ambiguous matches."
    >
      <MappingImportShell
        title="Provider metadata enrichment"
        purpose="Match an uploaded CSV against existing providers and attach metadata as imported/unverified. The base Provider Mapping import remains the only path that creates pins."
        required={[
          { name: 'name', description: 'Provider/facility name (alias: provider_name)' },
          { name: 'county OR city OR npi', description: 'At least one match helper required' },
        ]}
        aliases={[
          { canonical: 'name', aliases: ['provider_name'] },
          { canonical: 'npi', aliases: ['provider_npi'] },
          { canonical: 'phone', aliases: ['provider_phone'] },
          { canonical: 'website', aliases: ['url'] },
          { canonical: 'medicaid_participation', aliases: ['medicaid'] },
          { canonical: 'psychiatric_flag', aliases: ['psychiatric'] },
          { canonical: 'inpatient_flag', aliases: ['inpatient'] },
        ]}
        optional={ENRICHMENT_OPTIONAL_FIELDS.map((f) => ({ name: f, description: 'Stored as imported/unverified on apply' }))}
        validationRules={[
          'Rows missing name are rejected.',
          'Rows lacking all of county, city, and npi are rejected (cannot be matched).',
          'Matching is deterministic: NPI → name+county → name+city → unique-name. No fuzzy matching.',
          'NPI matching is inactive in practice — current provider records do not carry NPI, so name+county and name+city are the operative match paths today.',
          'Ambiguous matches (multiple candidates) are never auto-applied — they remain in the preview only.',
          'Unmatched rows are visible in the preview and skipped on apply.',
          'Imported metadata never overwrites verified authoritative fields.',
        ]}
        sampleColumns={['name', 'county', 'city', 'npi', 'phone', 'medicaid_participation']}
        sampleRows={[
          { name: 'Battle Mountain General Hospital', county: 'Lander', city: 'Battle Mountain', npi: '1234567890', phone: '775-635-2550', medicaid_participation: 'yes' },
          { name: 'Pershing General Hospital', county: 'Pershing', city: 'Lovelock', npi: '', phone: '775-273-2621', medicaid_participation: 'yes' },
        ]}
        template={PROVIDER_ENRICHMENT_TEMPLATE}
        uploadSlot={uploadSlot}
        relatedLinks={[
          { label: 'Open Provider Mapping (location import)', to: '/admin/mapping/providers' },
          { label: 'Open Verification Priority Queue', to: '/admin/mapping/verification-queue' },
        ]}
        postUploadExplainer={
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Matched rows attach metadata to the existing provider as <strong>imported/unverified</strong>.</li>
            <li>Provider detail panel surfaces this in a separate "Imported / Unverified Metadata" section.</li>
            <li>Verified badges, freshness, and queue logic are unaffected.</li>
            <li>Re-uploading replaces the imported record for the same provider.</li>
          </ul>
        }
      />

      {/* Preview table */}
      {matches && (
        <section className="mt-6 rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview ({matches.length} row{matches.length === 1 ? '' : 's'})
          </h3>
          <div className="mt-2 overflow-auto rounded border border-border">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1">#</th>
                  <th className="text-left px-2 py-1">Status</th>
                  <th className="text-left px-2 py-1">Source name</th>
                  <th className="text-left px-2 py-1">County / City</th>
                  <th className="text-left px-2 py-1">NPI</th>
                  <th className="text-left px-2 py-1">Matched provider</th>
                  <th className="text-left px-2 py-1">Match path</th>
                  <th className="text-left px-2 py-1">Fields detected</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.row.rowIndex} className="border-t border-border align-top">
                    <td className="px-2 py-1 text-muted-foreground">{m.row.rowIndex}</td>
                    <td className="px-2 py-1"><StatusBadge status={m.status} /></td>
                    <td className="px-2 py-1">{m.row.source_name}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {[m.row.source_county, m.row.source_city].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-2 py-1 font-mono text-muted-foreground">{m.row.source_npi || '—'}</td>
                    <td className="px-2 py-1">
                      {m.matched ? m.matched.name : m.candidates && m.candidates.length > 0 ? (
                        <span className="text-muted-foreground">
                          {m.candidates.length} candidates
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{m.matchedBy ?? '—'}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {Object.keys(m.row.enrichment).length > 0
                        ? Object.keys(m.row.enrichment).join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Only rows with status <strong>matched</strong> are applied. Ambiguous and unmatched rows stay in this preview for manual review.
          </p>
        </section>
      )}

      {/* Recent audit */}
      {recentAudit.length > 0 && (
        <section className="mt-4 rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent enrichment activity
          </h3>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {recentAudit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono text-foreground">{new Date(a.timestamp).toLocaleString()}</span>
                <span>·</span>
                <span>{a.source_file_name}</span>
                <span>·</span>
                <span>applied {a.rows_applied}</span>
                <span>·</span>
                <span>ambiguous {a.rows_ambiguous}</span>
                <span>·</span>
                <span>unmatched {a.rows_unmatched}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminMappingLayout>
  );
}
