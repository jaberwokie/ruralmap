/**
 * /admin/training — staff training packet for Rural Map + Decision Assist.
 *
 * Renders the training content on screen and offers .docx / .pdf download.
 * Admin-gated (matches AdminHome pattern). Additive: rollback by deleting
 * this file, the src/pages/admin-training/ folder, and the route line in
 * src/App.tsx.
 */

import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  TRAINING_SECTIONS,
  TRAINING_SUBTITLE,
  TRAINING_TITLE,
  type TrainingBlock,
  type TrainingSection,
} from './admin-training/trainingContent';
import { downloadTrainingDocx, downloadTrainingPdf } from './admin-training/trainingExport';

function RenderBlock({ block }: { block: TrainingBlock }) {
  switch (block.kind) {
    case 'h1':
      return <h2 className="mt-6 text-xl font-semibold">{block.text}</h2>;
    case 'h2':
      return <h3 className="mt-5 text-base font-semibold">{block.text}</h3>;
    case 'h3':
      return <h4 className="mt-4 text-sm font-semibold">{block.text}</h4>;
    case 'p':
      return <p className="mt-2 text-sm leading-relaxed text-foreground">{block.text}</p>;
    case 'note':
      return (
        <p className="mt-2 text-sm italic text-muted-foreground">
          Note: {block.text}
        </p>
      );
    case 'bullets':
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {block.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      );
    case 'steps':
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {block.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      );
    case 'screenshot':
      return (
        <div className="mt-3 rounded border border-dashed border-border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {block.label}
          </div>
          <p className="mt-1 text-sm italic text-muted-foreground">
            Capture instruction: {block.instruction}
          </p>
        </div>
      );
  }
}

function RenderSection({ section }: { section: TrainingSection }) {
  return (
    <section className="mb-8 training-section">
      <h2 className="border-b border-border pb-1 text-lg font-semibold" style={{ color: '#064f88' }}>
        {section.title}
      </h2>
      <div>
        {section.blocks.map((b, i) => (
          <RenderBlock key={i} block={b} />
        ))}
      </div>
    </section>
  );
}

/**
 * Print-only styles. Scoped to /admin/training via the .training-print-root
 * wrapper class. Does not affect screen rendering or export logic.
 */
const PRINT_STYLES = `
@media print {
  .training-print-root .no-print { display: none !important; }
  .training-print-root { background: white !important; color: black !important; }
  .training-print-root main { padding: 0 !important; max-width: none !important; }
  .training-print-root article {
    border: none !important;
    background: white !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .training-print-root h1 { font-size: 22pt; margin: 0 0 4pt; }
  .training-print-root h2 { font-size: 15pt; margin: 14pt 0 6pt; }
  .training-print-root h3 { font-size: 12pt; margin: 10pt 0 4pt; }
  .training-print-root h4 { font-size: 11pt; margin: 8pt 0 3pt; }
  .training-print-root p,
  .training-print-root li { font-size: 10.5pt; line-height: 1.45; }
  .training-print-root ul,
  .training-print-root ol { margin: 4pt 0 8pt 18pt; }
  .training-print-root .training-section {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 14pt;
  }
  .training-print-root h2,
  .training-print-root h3,
  .training-print-root h4 {
    break-after: avoid;
    page-break-after: avoid;
  }
  @page { margin: 0.6in; }
}
`;

export default function AdminTraining() {
  const perms = usePermissions();
  const { toast } = useToast();
  const [busy, setBusy] = useState<'docx' | 'pdf' | null>(null);

  if (perms.ready && !perms.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const onDocx = async () => {
    try {
      setBusy('docx');
      await downloadTrainingDocx(TRAINING_SECTIONS, TRAINING_TITLE, TRAINING_SUBTITLE);
      toast({ title: 'Training downloaded', description: 'DOCX file saved.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Download failed', description: 'Could not generate DOCX.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const onPdf = () => {
    try {
      setBusy('pdf');
      downloadTrainingPdf(TRAINING_SECTIONS, TRAINING_TITLE, TRAINING_SUBTITLE);
      toast({ title: 'Training downloaded', description: 'PDF file saved.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Download failed', description: 'Could not generate PDF.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground training-print-root">
      <style>{PRINT_STYLES}</style>
      <div className="border-b border-border bg-card no-print">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Admin
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: '#064f88' }}>
              Training
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onPdf} disabled={busy !== null}>
              <FileText className="mr-1 h-4 w-4" />
              {busy === 'pdf' ? 'Generating…' : 'Download as PDF'}
            </Button>
            <Button size="sm" onClick={onDocx} disabled={busy !== null}>
              <Download className="mr-1 h-4 w-4" />
              {busy === 'docx' ? 'Generating…' : 'Download Training (.docx)'}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: '#064f88' }}>
            {TRAINING_TITLE}
          </h1>
          <p className="mt-1 text-sm italic text-muted-foreground">{TRAINING_SUBTITLE}</p>
        </header>

        <article className="rounded border border-border bg-card p-6">
          {TRAINING_SECTIONS.map((s) => (
            <RenderSection key={s.id} section={s} />
          ))}
        </article>
      </main>
    </div>
  );
}
