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
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

// ── Module templates ────────────────────────────────────────────

export const PROVIDER_TEMPLATE: CsvTemplate = {
  filename: 'provider-mapping-template.csv',
  headers: [
    'verified_name', 'verified_lat', 'verified_lng', 'verified_address',
    'verified_city', 'verified_county', 'verified_state', 'verified_zip',
    'verified_npi', 'type', 'source', 'notes', 'phone', 'website',
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

/**
 * Service Mapping template — headers MATCH `csvToStagingService` parser exactly
 * (parser also accepts a few aliases, but template uses the canonical names).
 */
export const SERVICE_TEMPLATE: CsvTemplate = {
  filename: 'service-mapping-template.csv',
  headers: [
    'name',
    'service_category',
    'service_subcategory',
    'organization_name',
    'description',
    'target_population',
    'eligibility_notes',
    'street_address',
    'city',
    'state',
    'zip',
    'county',
    'latitude',
    'longitude',
    'phone',
    'website',
    'email',
    'referral_required',
    'walk_in_allowed',
    'appointment_required',
    'hours_of_operation',
    'languages_supported',
    'active_status',
    'access_notes',
    'transportation_notes',
    'medicaid_relevance',
    'verification_source',
  ],
  exampleRow: {
    name: 'Elko Community Food Pantry',
    service_category: 'Food',
    service_subcategory: 'Pantry',
    organization_name: 'Elko Community Org',
    description: 'Weekly community food distribution',
    target_population: 'Low-income households',
    eligibility_notes: 'Open to all; no documentation required',
    street_address: '123 Main St',
    city: 'Elko',
    state: 'NV',
    zip: '89801',
    county: 'Elko',
    latitude: '40.83242',
    longitude: '-115.76313',
    phone: '775-555-0100',
    website: 'https://example.org',
    email: 'contact@example.org',
    referral_required: 'no',
    walk_in_allowed: 'yes',
    appointment_required: 'no',
    hours_of_operation: 'Mon-Fri 9am-5pm',
    languages_supported: 'English, Spanish',
    active_status: 'yes',
    access_notes: 'Accessible parking on east side',
    transportation_notes: 'On RTC bus route 4',
    medicaid_relevance: 'no',
    verification_source: 'community-listing 2025-04',
  },
};

/**
 * Behavioral Health Mapping template — headers MATCH `csvToStagingBh` parser
 * exactly. NPI must be 10 digits when present.
 */
export const BEHAVIORAL_HEALTH_TEMPLATE: CsvTemplate = {
  filename: 'behavioral-health-mapping-template.csv',
  headers: [
    'name',
    'bh_entity_type',
    'bh_service_type',
    'organization_name',
    'facility_type',
    'description',
    'npi',
    'license_type',
    'specialties',
    'age_groups_served',
    'populations_served',
    'street_address',
    'city',
    'state',
    'zip',
    'county',
    'latitude',
    'longitude',
    'phone',
    'website',
    'fax',
    'referral_required',
    'walk_in_allowed',
    'appointment_required',
    'accepts_new_patients',
    'telehealth_available',
    'hours_of_operation',
    'languages_supported',
    'medicaid_participation_status',
    'payer_notes',
    'crisis_capable',
    'detox_capable',
    'residential_capable',
    'outpatient_capable',
    'mat_capable',
    'active_status',
    'access_notes',
    'verification_source',
  ],
  exampleRow: {
    name: 'Rural Clinics Community Mental Health — Elko',
    bh_entity_type: 'outpatient',
    bh_service_type: 'mental health',
    organization_name: 'Rural Clinics',
    facility_type: 'Clinic',
    description: 'Outpatient behavioral health services',
    npi: '1234567890',
    license_type: 'State-licensed BH facility',
    specialties: 'Adult, Adolescent',
    age_groups_served: 'Adults, Adolescents',
    populations_served: 'Medicaid, Uninsured',
    street_address: '456 Idaho St',
    city: 'Elko',
    state: 'NV',
    zip: '89801',
    county: 'Elko',
    latitude: '40.82613',
    longitude: '-115.76359',
    phone: '775-555-0200',
    website: 'https://example.org',
    fax: '775-555-0201',
    referral_required: 'no',
    walk_in_allowed: 'yes',
    appointment_required: 'yes',
    accepts_new_patients: 'yes',
    telehealth_available: 'yes',
    hours_of_operation: 'Mon-Fri 8am-5pm',
    languages_supported: 'English, Spanish',
    medicaid_participation_status: 'in-network',
    payer_notes: 'Most major payers accepted',
    crisis_capable: 'no',
    detox_capable: 'no',
    residential_capable: 'no',
    outpatient_capable: 'yes',
    mat_capable: 'no',
    active_status: 'yes',
    access_notes: 'ADA accessible',
    verification_source: 'state directory 2025-04',
  },
};

export const PROVIDER_ENRICHMENT_TEMPLATE: CsvTemplate = {
  filename: 'provider-metadata-enrichment-template.csv',
  headers: [
    'name', 'county', 'city', 'npi', 'phone', 'website', 'subtype',
    'source', 'medicaid_participation', 'psychiatric_flag', 'inpatient_flag',
    'state', 'zip', 'notes',
  ],
  exampleRow: {
    name: 'Battle Mountain General Hospital',
    county: 'Lander',
    city: 'Battle Mountain',
    npi: '1234567890',
    phone: '775-635-2550',
    website: 'https://battlemountaingeneral.com',
    subtype: 'CAH',
    source: 'state directory 2025-04',
    medicaid_participation: 'yes',
    psychiatric_flag: 'no',
    inpatient_flag: 'yes',
    state: 'NV',
    zip: '89820',
    notes: 'Sample enrichment row — replace with real data',
  },
};
