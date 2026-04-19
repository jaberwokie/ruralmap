/**
 * Admin > Mapping > Provider Mapping (live ingestion).
 *
 * Reuses the existing parseFacilityCsv + appendImportedFacilities pipeline
 * exactly as the legacy /admin/provider-mapping-import page did. No new
 * validation rules, no auto-verification.
 */

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import MappingImportShell from '@/components/admin/MappingImportShell';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/contexts/AuthContext';
import { parseFacilityCsv, type CsvImportResult } from '@/utils/csvImport';
import { appendImportedFacilities } from '@/utils/importedFacilitiesStore';
import { PROVIDER_TEMPLATE } from '@/utils/csvTemplates';

export default function AdminMappingProviders() {
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

  const uploadSlot = (
    <div className="mt-3 space-y-3">
      <Button onClick={onUploadClick} disabled={parsing} className="w-full">
        <Upload className="h-4 w-4 mr-1" />
        {parsing ? 'Parsing…' : 'Upload CSV'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChange}
      />
      {result && (
        <div className="rounded border border-border bg-muted/30 p-2 text-xs">
          <div>
            <span className="font-medium">{result.valid.length}</span> valid ·{' '}
            <span className="text-muted-foreground">{result.invalidCount} skipped</span> ·{' '}
            <span className="text-muted-foreground">{result.totalRows} total</span>
          </div>
          {!imported && result.valid.length > 0 && (
            <Button onClick={confirmImport} size="sm" className="mt-2 w-full" disabled={!perms.canImportData}>
              Add {result.valid.length} to map
            </Button>
          )}
          {imported && (
            <p className="mt-2 text-[11px] font-medium text-foreground">
              Imported · open the map to view.
            </p>
          )}
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-muted-foreground">
                {result.errors.length} validation issue{result.errors.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto pr-2">
                {result.errors.slice(0, 100).map((err, i) => (
                  <li key={i} className="text-destructive/80">{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AdminMappingLayout
      title="Provider Mapping"
      description="Verified provider and facility locations for map placement. Imported entries enter the existing verification workflow as Unverified."
    >
      <MappingImportShell
        title="Provider location ingestion"
        purpose="Upload verified service-location data for providers and facilities. Billing and corporate addresses must not be used."
        required={[
          { name: 'verified_name', description: 'Provider/facility name' },
          { name: 'verified_lat', description: 'Latitude (-90 to 90)' },
          { name: 'verified_lng', description: 'Longitude (-180 to 180)' },
        ]}
        aliases={[
          { canonical: 'verified_name', aliases: ['name', 'provider_name'] },
          { canonical: 'verified_lat', aliases: ['latitude', 'lat'] },
          { canonical: 'verified_lng', aliases: ['longitude', 'lng', 'lon'] },
        ]}
        optional={[
          { name: 'verified_address' }, { name: 'verified_city' }, { name: 'verified_county' },
          { name: 'verified_state' }, { name: 'verified_zip' }, { name: 'verified_npi' },
          { name: 'type' }, { name: 'subtype' }, { name: 'source' }, { name: 'notes' },
          { name: 'phone' }, { name: 'website' }, { name: 'medicaid_participation' },
          { name: 'psychiatric_flag' }, { name: 'inpatient_flag' },
        ]}
        validationRules={[
          'Coordinates must parse as valid finite numbers within range.',
          'Rows missing both canonical and legacy name/coordinate fields are rejected.',
          'Verified-mapping rows must have at least one filled verified_* field.',
          'Imports never auto-mark verified — entries enter the verification queue as Unverified.',
        ]}
        sampleColumns={['verified_name', 'verified_lat', 'verified_lng', 'verified_city', 'verified_county']}
        sampleRows={[
          { verified_name: 'Battle Mountain General Hospital', verified_lat: '40.63812', verified_lng: '-116.93429', verified_city: 'Battle Mountain', verified_county: 'Lander' },
          { verified_name: 'Pershing General Hospital', verified_lat: '40.42178', verified_lng: '-118.12631', verified_city: 'Lovelock', verified_county: 'Pershing' },
        ]}
        uploadSlot={uploadSlot}
        relatedLinks={[
          { label: 'Open Unmapped Providers list', to: '/admin/unmapped-providers' },
          { label: 'Open Verification Priority Queue', to: '/admin/mapping/verification-queue' },
        ]}
      />
    </AdminMappingLayout>
  );
}
