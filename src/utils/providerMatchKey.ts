/**
 * Provider deterministic match-key logic for upsert-on-promote.
 *
 * Priority (first match wins):
 *   1. NPI (when both records have one)
 *   2. name + county + city
 *   3. name + phone
 *   4. name + normalized street_address
 *
 * If none of the above match but a same-name record exists with different
 * identifying fields, the candidate is ambiguous → conflict (do not auto-merge).
 */

import type { Facility } from '@/data/facilities';
import { normalizeCounty } from '@/utils/countyNormalize';

export interface MatchableProvider {
  id?: string;
  name?: string | null;
  npi?: string | null;
  city?: string | null;
  county?: string | null;
  phone?: string | null;
  street_address?: string | null;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
const stripPunct = (s: string) => s.replace(/[^\p{L}\p{N}\s]/gu, ' ');

export const normalizeName = (v: string | null | undefined): string => {
  if (!v) return '';
  return collapse(stripPunct(String(v).toLowerCase()));
};

export const normalizePhone = (v: string | null | undefined): string => {
  if (!v) return '';
  const digits = String(v).replace(/\D/g, '');
  // Strip US country code prefix
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

export const normalizeStreet = (v: string | null | undefined): string => {
  if (!v) return '';
  let s = collapse(stripPunct(String(v).toLowerCase()));
  // Common abbreviations
  const abbr: Record<string, string> = {
    street: 'st', road: 'rd', avenue: 'ave', boulevard: 'blvd',
    drive: 'dr', lane: 'ln', highway: 'hwy', court: 'ct',
    parkway: 'pkwy', north: 'n', south: 's', east: 'e', west: 'w',
  };
  s = s.split(' ').map((w) => abbr[w] ?? w).join(' ');
  return s;
};

export const normalizeNpi = (v: string | null | undefined): string => {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  return d.length === 10 ? d : '';
};

const facilityNpi = (f: Facility): string => {
  // Facility doesn't carry NPI directly; some imports may stash it in notes.
  // Prefer explicit field if present in the raw object.
  const anyF = f as unknown as { npi?: string | null };
  return normalizeNpi(anyF.npi ?? null);
};

export interface MatchResult {
  outcome: 'match' | 'conflict' | 'none';
  matched?: Facility;
  /** Strategy used for the unique match. */
  strategy?: 'npi' | 'name_county_city' | 'name_phone' | 'name_street';
  /** When conflict, the candidate facilities considered ambiguous. */
  candidates?: Facility[];
}

export const findProviderMatch = (
  candidate: MatchableProvider,
  existing: Facility[],
): MatchResult => {
  const cName = normalizeName(candidate.name);
  if (!cName) return { outcome: 'none' };

  const cNpi = normalizeNpi(candidate.npi);
  const cCity = normalizeName(candidate.city);
  const cCounty = normalizeCounty(candidate.county);
  const cPhone = normalizePhone(candidate.phone);
  const cStreet = normalizeStreet(candidate.street_address);

  // 1. NPI
  if (cNpi) {
    const hits = existing.filter((f) => facilityNpi(f) === cNpi);
    if (hits.length === 1) return { outcome: 'match', matched: hits[0], strategy: 'npi' };
    if (hits.length > 1) return { outcome: 'conflict', candidates: hits };
  }

  const sameName = existing.filter((f) => normalizeName(f.name) === cName);
  if (sameName.length === 0) return { outcome: 'none' };

  // 2. name + county + city
  if (cCounty && cCity) {
    const hits = sameName.filter((f) =>
      normalizeCounty(f.county) === cCounty && normalizeName(f.city) === cCity);
    if (hits.length === 1) return { outcome: 'match', matched: hits[0], strategy: 'name_county_city' };
    if (hits.length > 1) return { outcome: 'conflict', candidates: hits };
  }

  // 3. name + phone
  if (cPhone) {
    const hits = sameName.filter((f) => normalizePhone(f.phone) === cPhone);
    if (hits.length === 1) return { outcome: 'match', matched: hits[0], strategy: 'name_phone' };
    if (hits.length > 1) return { outcome: 'conflict', candidates: hits };
  }

  // 4. name + street
  if (cStreet) {
    const hits = sameName.filter((f) => normalizeStreet(f.address) === cStreet);
    if (hits.length === 1) return { outcome: 'match', matched: hits[0], strategy: 'name_street' };
    if (hits.length > 1) return { outcome: 'conflict', candidates: hits };
  }

  // Same name exists but no priority-key agreed → ambiguous.
  return { outcome: 'conflict', candidates: sameName };
};
