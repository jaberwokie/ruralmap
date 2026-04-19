/**
 * Shared visual structure for ALL Admin > Mapping ingestion modules
 * (Provider, Service, Behavioral Health).
 *
 * Renders:
 *   - Title + purpose statement
 *   - Required columns + accepted aliases + optional columns
 *   - Validation rules
 *   - Sample table
 *   - "Download CSV template" button (header row + one example row)
 *   - Upload button (active or disabled with "Pipeline pending")
 *   - Optional "What happens after upload" footer
 *   - Optional related-workflow links
 *
 * Pipeline-disabled modules render the FULL UI exactly the same as active
 * modules so users see the structure now and there is no rework later.
 * Disabled modules write nothing.
 */

import { type ReactNode } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { downloadCsvTemplate, type CsvTemplate } from '@/utils/csvTemplates';

export interface SchemaColumn {
  name: string;
  description?: string;
}

export interface SampleRow {
  [column: string]: string;
}

export interface MappingImportShellProps {
  title: string;
  purpose: string;
  required: SchemaColumn[];
  aliases?: { canonical: string; aliases: string[] }[];
  optional?: SchemaColumn[];
  validationRules: string[];
  sampleColumns: string[];
  sampleRows: SampleRow[];
  /** Active upload UI when provided; otherwise disabled placeholder. */
  uploadSlot?: ReactNode;
  /** Set true to show the disabled "Pipeline pending" upload button. */
  pipelinePending?: boolean;
  /** CSV template — drives the "Download template" button. */
  template: CsvTemplate;
  /** Bottom callouts e.g. "Open verification queue". */
  relatedLinks?: { label: string; to: string }[];
  /** Optional explainer block shown under the upload zone. */
  postUploadExplainer?: ReactNode;
}

export default function MappingImportShell({
  title,
  purpose,
  required,
  aliases,
  optional,
  validationRules,
  sampleColumns,
  sampleRows,
  uploadSlot,
  pipelinePending = false,
  template,
  relatedLinks,
  postUploadExplainer,
}: MappingImportShellProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: schema + rules */}
      <section className="lg:col-span-2 space-y-4">
        <div className="rounded border border-border bg-card p-4">
          <h2 className="text-sm font-semibold" style={{ color: '#064f88' }}>{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{purpose}</p>
        </div>

        <div className="rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Required columns
          </h3>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {required.map((c) => (
              <li key={c.name} className="text-xs">
                <code className="font-mono text-[11px] text-foreground">{c.name}</code>
                {c.description ? (
                  <span className="ml-1 text-muted-foreground"> — {c.description}</span>
                ) : null}
              </li>
            ))}
          </ul>

          {aliases && aliases.length > 0 ? (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accepted legacy aliases
              </h3>
              <ul className="mt-2 space-y-1 text-xs">
                {aliases.map((a) => (
                  <li key={a.canonical} className="text-muted-foreground">
                    {a.aliases.map((al) => (
                      <code key={al} className="mr-1 font-mono text-[11px] text-foreground">{al}</code>
                    ))}
                    <span>→ </span>
                    <code className="font-mono text-[11px] text-foreground">{a.canonical}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {optional && optional.length > 0 ? (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Optional columns
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {optional.map((c) => (
                  <code
                    key={c.name}
                    className="font-mono text-[11px] rounded border border-border bg-muted/40 px-1.5 py-0.5 text-foreground"
                    title={c.description}
                  >
                    {c.name}
                  </code>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Validation rules
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {validationRules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sample
          </h3>
          <div className="mt-2 overflow-auto rounded border border-border">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {sampleColumns.map((c) => (
                    <th key={c} className="text-left px-2 py-1 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {sampleColumns.map((c) => (
                      <td key={c} className="px-2 py-1 whitespace-nowrap">{row[c] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Right: upload zone + post-upload explainer */}
      <aside className="space-y-4">
        <div className={cn(
          'rounded border bg-card p-4',
          pipelinePending ? 'border-dashed border-[hsl(var(--brand-health)/0.4)]' : 'border-border',
        )}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upload
            </h3>
            <button
              type="button"
              onClick={() => downloadCsvTemplate(template)}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40"
              title={`Download ${template.filename}`}
            >
              <Download className="h-3 w-3" />
              CSV template
            </button>
          </div>
          {uploadSlot ?? (
            <div className="mt-3 space-y-3">
              <Button disabled className="w-full" title="Ingestion pipeline pending">
                <Upload className="h-4 w-4 mr-1" />
                Upload CSV
              </Button>
              <div className="rounded border border-[hsl(var(--brand-health)/0.4)] bg-[hsl(var(--brand-health)/0.06)] px-2 py-1.5">
                <p className="text-[11px] font-medium text-[hsl(var(--brand-health))]">
                  Pipeline pending
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Schema and structure are locked. Ingestion will activate here without changing the URL or fields. The downloadable template above already matches this schema.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What happens after upload
          </h3>
          {postUploadExplainer ?? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Entries appear on the operational map.</li>
              <li>Records follow the existing verification rules where applicable.</li>
              <li>Imports remain filterable through the same map layer controls.</li>
            </ul>
          )}
        </div>

        {relatedLinks && relatedLinks.length > 0 ? (
          <div className="rounded border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Related workflows
            </h3>
            <ul className="mt-2 space-y-1 text-xs">
              {relatedLinks.map((l) => (
                <li key={l.to}>
                  <a
                    href={l.to}
                    className="text-[hsl(var(--brand-health))] hover:underline"
                  >
                    {l.label} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
