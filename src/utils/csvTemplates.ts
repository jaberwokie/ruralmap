/**
 * CSV template generator for Admin > Mapping modules.
 *
 * Produces a CSV with a header row + one example row, matching each module's
 * documented schema EXACTLY. Templates are generated client-side at click time
 * — they never touch the parser pipeline or any storage.
 */

export interface CsvTemplate {
  filename: string;
  headers: string[];
  exampleRow: Record<string, string>;
}

const escapeCell = (value: string): string => {
  if (value === undefined || value === null) return '';
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const buildCsv = (template: CsvTemplate): string => {
  const headerLine = template.headers.map(escapeCell).join(',');
  const valueLine = template.headers.map((h) => escapeCell(template.exampleRow[h] ?? '')).join(',');
  return `${headerLine}\n${valueLine}\n`;
};

export const downloadCsvTemplate = (template: CsvTemplate): void => {
  const csv = buildCsv(template);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = template.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Allow the browser to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

// ── Module templates ────────────────────────────────────────────

export const PROVIDER_TEMPLATE: CsvTemplate = {
  filename: 'provider-mapping-template.csv',
  headers: [
    'verified_name',
    'verified_lat',
    'verified_lng',
    'verified_address',
    'verified_city',
    'verified_county',
    'verified_state',
    'verified_zip',
    'verified_npi',
    'type',
    'source',
    'notes',
    'phone',
    'website',
  ],
  exampleRow: {
    verified_name: 'Battle Mountain General Hospital',
    verified_lat: '40.63812',
    verified_lng: '-116.93429',
    verified_address: '535 S Humboldt St',
    verified_city: 'Battle Mountain',
    verified_county: 'Lander',
    verified_state: 'NV',
    verified_zip: '89820',
    verified_npi: '1234567890',
    type: 'hospital',
    source: 'site visit 2025-01',
    notes: 'Primary service location confirmed',
    phone: '775-635-2550',
    website: 'https://battlemountaingeneral.com',
  },
};

export const SERVICE_TEMPLATE: CsvTemplate = {
  filename: 'service-mapping-template.csv',
  headers: [
    'name',
    'latitude',
    'longitude',
    'service_type',
    'category',
    'subcategory',
    'city',
    'county',
    'state',
    'zip',
    'address',
    'phone',
    'website',
    'organization',
    'eligibility',
    'hours',
    'notes',
    'source',
    'active',
    'medicaid_related',
    'tribal_affiliation',
  ],
  exampleRow: {
    name: 'Elko Community Food Pantry',
    latitude: '40.83242',
    longitude: '-115.76313',
    service_type: 'Food Assistance',
    category: 'Basic Needs',
    subcategory: 'Food',
    city: 'Elko',
    county: 'Elko',
    state: 'NV',
    zip: '89801',
    address: '123 Main St',
    phone: '775-555-0100',
    website: 'https://example.org',
    organization: 'Elko Community Org',
    eligibility: 'Open to all',
    hours: 'Mon-Fri 9am-5pm',
    notes: 'Sample row — replace with real data',
    source: 'community-listing',
    active: 'yes',
    medicaid_related: 'no',
    tribal_affiliation: '',
  },
};

export const BEHAVIORAL_HEALTH_TEMPLATE: CsvTemplate = {
  filename: 'behavioral-health-mapping-template.csv',
  headers: [
    'name',
    'latitude',
    'longitude',
    'bh_type',
    'city',
    'county',
    'state',
    'zip',
    'address',
    'phone',
    'website',
    'organization',
    'medicaid_participation',
    'psychiatric_flag',
    'outpatient_flag',
    'crisis_flag',
    'notes',
    'source',
    'active',
  ],
  exampleRow: {
    name: 'Rural Clinics Community Mental Health — Elko',
    latitude: '40.82613',
    longitude: '-115.76359',
    bh_type: 'Outpatient',
    city: 'Elko',
    county: 'Elko',
    state: 'NV',
    zip: '89801',
    address: '456 Idaho St',
    phone: '775-555-0200',
    website: 'https://example.org',
    organization: 'Rural Clinics',
    medicaid_participation: 'yes',
    psychiatric_flag: 'yes',
    outpatient_flag: 'yes',
    crisis_flag: 'no',
    notes: 'Sample row — replace with real data',
    source: 'state directory',
    active: 'yes',
  },
};
