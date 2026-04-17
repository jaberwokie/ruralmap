/**
 * Shared CSV → Facility[] parser.
 *
 * Used by:
 *   - The sidebar's Data Import section (existing flow).
 *   - The admin "Provider Mapping Import" surface (/admin), which reuses
 *     this exact pipeline so behavior never diverges.
 *
 * Header support:
 *   - Legacy:  name, lat/latitude, lng/lon/longitude, type, city, county, notes, tier
 *   - Verified-mapping CSV (from /admin/unmapped-providers export):
 *       verified_name, verified_lat, verified_lng, verified_address,
 *       verified_city, verified_county, verified_state, verified_zip,
 *       verified_npi, provider_name (fallback for name)
 *
 * Validation rules (kept identical to the previous sidebar pipeline,
 * with one addition mandated by the verified-mapping spec):
 *   - Row must have a non-empty name.
 *   - Row must have finite lat AND finite lng. (Address-only rows are
 *     rejected — coordinates are never invented client-side.)
 *   - Verified-mapping CSVs must additionally have at least one of:
 *       verified_address  OR  (verified_lat + verified_lng)
 *     Since we already require lat/lng, this is automatically satisfied.
 *   - Rows where every verified_* field is empty are rejected.
 */

import type { Facility, FacilityType } from '@/data/facilities';

export interface CsvImportResult {
  valid: Facility[];
  invalidCount: number;
  errors: string[];
  totalRows: number;
  /** True when the source CSV uses the verified_* schema. */
  isVerifiedMappingCsv: boolean;
}

const normalizeHeader = (h: string): string =>
  String(h).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const parseCSVLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

const stripLineQuotes = (line: string): string => {
  const trimmed = line.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
};

/** Resolve the first matching column index from a list of header aliases. */
const findCol = (norm: string[], aliases: string[]): number => {
  for (const a of aliases) {
    const idx = norm.indexOf(a);
    if (idx !== -1) return idx;
  }
  for (const a of aliases) {
    const idx = norm.findIndex((h) => h.startsWith(a));
    if (idx !== -1) return idx;
  }
  for (const a of aliases) {
    const idx = norm.findIndex((h) => h.includes(a));
    if (idx !== -1) return idx;
  }
  return -1;
};

export const parseFacilityCsv = (text: string): CsvImportResult => {
  const empty: CsvImportResult = {
    valid: [], invalidCount: 0, errors: [], totalRows: 0, isVerifiedMappingCsv: false,
  };

  let cleaned = text;
  if (cleaned.startsWith('\uFEFF')) cleaned = cleaned.substring(1);

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { ...empty, errors: ['CSV file has no data rows.'] };
  }

  const headers = parseCSVLine(stripLineQuotes(lines[0]));
  const norm = headers.map(normalizeHeader);
  const isVerified = norm.some((h) => h.startsWith('verified_'));

  const nameIdx = isVerified
    ? findCol(norm, ['verified_name', 'provider_name', 'name'])
    : findCol(norm, ['name']);
  const latIdx = findCol(norm, isVerified ? ['verified_lat', 'lat', 'latitude'] : ['lat', 'latitude']);
  const lngIdx = findCol(norm, isVerified ? ['verified_lng', 'verified_lon', 'lng', 'lon', 'longitude'] : ['lng', 'lon', 'longitude']);
  const typeIdx = findCol(norm, ['type']);
  const cityIdx = findCol(norm, isVerified ? ['verified_city', 'city'] : ['city']);
  const countyIdx = findCol(norm, isVerified ? ['verified_county', 'county'] : ['county']);
  const addressIdx = isVerified ? findCol(norm, ['verified_address', 'address']) : findCol(norm, ['address']);
  const notesIdx = findCol(norm, ['notes', 'note']);
  const tierIdx = findCol(norm, ['tier']);

  if (nameIdx === -1 || latIdx === -1 || lngIdx === -1) {
    const missing = [
      nameIdx === -1 && (isVerified ? 'verified_name' : 'name'),
      latIdx === -1 && (isVerified ? 'verified_lat' : 'latitude'),
      lngIdx === -1 && (isVerified ? 'verified_lng' : 'longitude'),
    ].filter(Boolean).join(', ');
    return {
      ...empty,
      totalRows: lines.length - 1,
      isVerifiedMappingCsv: isVerified,
      errors: [`Missing required columns: ${missing}`],
    };
  }

  const valid: Facility[] = [];
  const errors: string[] = [];
  let invalidCount = 0;
  const totalRows = lines.length - 1;

  // Verified-mapping rule: reject row if every verified_* cell is empty.
  const verifiedColIdxs = isVerified
    ? norm.map((h, i) => (h.startsWith('verified_') ? i : -1)).filter((i) => i !== -1)
    : [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(stripLineQuotes(lines[i]));
    const name = cols[nameIdx]?.trim();
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);

    if (!name) { invalidCount++; errors.push(`Row ${i}: missing name`); continue; }

    if (isVerified && verifiedColIdxs.length > 0) {
      const allEmpty = verifiedColIdxs.every((vi) => !(cols[vi] ?? '').trim());
      if (allEmpty) {
        invalidCount++;
        errors.push(`Row ${i}: "${name}" has no verified location fields filled`);
        continue;
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      invalidCount++;
      errors.push(`Row ${i}: invalid coordinates for "${name}"`);
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      invalidCount++;
      errors.push(`Row ${i}: out-of-range coordinates for "${name}"`);
      continue;
    }

    const rawType = (typeIdx !== -1 ? cols[typeIdx] || '' : '').toLowerCase();
    const type: FacilityType = rawType.includes('hospital') ? 'hospital' : 'clinic';

    const address = addressIdx !== -1 ? (cols[addressIdx] || '').trim() : '';
    const notesRaw = notesIdx !== -1 ? (cols[notesIdx] || '').trim() : '';
    const notes = isVerified
      ? [notesRaw, 'Imported via Provider Mapping Import — pending verification'].filter(Boolean).join(' · ')
      : notesRaw || undefined;

    valid.push({
      id: `csv-${Date.now()}-${i}`,
      name,
      type,
      city: cityIdx !== -1 ? (cols[cityIdx] || '').trim() : '',
      county: countyIdx !== -1 ? (cols[countyIdx] || '').trim() : '',
      address: address || undefined,
      lat,
      lng,
      notes: notes || undefined,
      tier: tierIdx !== -1 ? (cols[tierIdx] as Facility['tier']) : undefined,
      // Critical: NEVER auto-mark verified. Imported entries enter the same
      // verification queue as any other unverified provider.
      dataConfidence: 'Unverified',
    });
  }

  return { valid, invalidCount, errors, totalRows, isVerifiedMappingCsv: isVerified };
};
