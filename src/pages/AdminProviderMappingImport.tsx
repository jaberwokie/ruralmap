/**
 * Admin-only Provider Mapping Import (/admin/provider-mapping-import).
 *
 * Reuses the shared CSV parser (`parseFacilityCsv`) and the shared imported-
 * facilities store (`appendImportedFacilities`) — the exact same pipeline the
 * sidebar's Data Import section uses. No new map logic, no new validation
 * rules, no auto-verification.
 *
 * Workflow:
 *   1. Admin exports the CSV from /admin/unmapped-providers and fills the
 *      verified_* columns offline with confirmed service-location data.
 *   2. Admin uploads here.
 *   3. Rows pass through the same validation pipeline (lat/lng required,
 *      verified-mapping rows must have at least one verified_* field).
 *   4. Imported facilities appear on the map immediately, marked
 *      Unverified — they enter the existing verification workflow like
 *      any other unverified provider.
 */

import { useCallback, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { parseFacilityCsv, type CsvImportResult } from '@/utils/csvImport';
import { appendImportedFacilities } from '@/utils/importedFacilitiesStore';

export default function AdminProviderMappingImport() {
  const perms = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [imported, setImported] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are accepted.');
      return;
    }
    setParsing(true);
    setImported(false);
    setResult(null);
    const reader = new FileReader();
    reader.onerror = () => { toast.error('Failed to read file.'); setParsing(false); };
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) { toast.error('Failed to read file.'); setParsing(false); return; }
      const parsed = parseFacilityCsv(text);
      setResult(parsed);
      setParsing(false);
      if (parsed.valid.length === 0) {
        toast.error(parsed.errors[0] ?? 'No valid rows found in the CSV.');
      }
    };
    reader.readAsText(file);
  }, []);

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!result || result.valid.length === 0) return;
    if (!perms.canImportData) {
      toast.error('You do not have permission to import data.');
      return;
    }
    appendImportedFacilities(result.valid);
    toast.success(`Imported ${result.valid.length} provider${result.valid.length === 1 ? '' : 's'}.`);
    setImported(true);
  };

  if (perms.ready && !perms.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Link>
            </Button>
            <h1 className="text-xl font-semibold">Provider Mapping Import</h1>
          </div>
        </div>

        <div className="rounded border border-border bg-card p-4">
          <p className="text-sm">
            Upload a CSV with verified provider locations.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only confirmed service locations should be included. Billing or corporate addresses should not be used.
            Imported providers are added as <strong>Unverified</strong> and enter the existing verification workflow.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onUploadClick} size="sm" disabled={parsing}>
              <Upload className="h-4 w-4 mr-1" />
              {parsing ? 'Parsing…' : 'Upload CSV'}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/unmapped-providers">Open Unmapped Providers list</Link>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Required columns: <code>verified_name</code>, <code>verified_lat</code>, <code>verified_lng</code>
            {' '}(or legacy <code>name</code>, <code>latitude</code>, <code>longitude</code>).
            {' '}Rows with no filled <code>verified_*</code> fields are rejected.
          </p>
        </div>

        {result && (
          <div className="mt-4 rounded border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{result.valid.length}</span> valid ·{' '}
                <span className="text-muted-foreground">{result.invalidCount} skipped</span> ·{' '}
                <span className="text-muted-foreground">{result.totalRows} total</span>
                {result.isVerifiedMappingCsv && (
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    verified-mapping schema
                  </span>
                )}
              </div>
              {!imported && result.valid.length > 0 && (
                <Button onClick={confirmImport} size="sm" disabled={!perms.canImportData}>
                  Add {result.valid.length} to map
                </Button>
              )}
              {imported && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Imported · open the map to view
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {result.errors.length} validation issue{result.errors.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-0.5 max-h-48 overflow-auto pr-2">
                  {result.errors.slice(0, 200).map((err, i) => (
                    <li key={i} className="text-destructive/80">{err}</li>
                  ))}
                </ul>
              </details>
            )}

            {result.valid.length > 0 && (
              <div className="mt-3 max-h-64 overflow-auto rounded border border-border">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1">Name</th>
                      <th className="text-left px-2 py-1">City</th>
                      <th className="text-left px-2 py-1">County</th>
                      <th className="text-right px-2 py-1">Lat</th>
                      <th className="text-right px-2 py-1">Lng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.valid.slice(0, 50).map((f) => (
                      <tr key={f.id} className="border-t border-border">
                        <td className="px-2 py-1">{f.name}</td>
                        <td className="px-2 py-1">{f.city || '—'}</td>
                        <td className="px-2 py-1">{f.county || '—'}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.lat.toFixed(5)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{f.lng.toFixed(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.valid.length > 50 && (
                  <div className="px-2 py-1 text-[10px] text-muted-foreground">
                    Preview shows first 50 of {result.valid.length}. All will be imported.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
