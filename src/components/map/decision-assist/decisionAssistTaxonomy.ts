/**
 * Decision Assist — domain/need taxonomy.
 *
 * Each need declares pure predicates over existing classification fields:
 *   - facilityMatch: filters Facility[] by type / BH-ness
 *   - serviceMatch:  filters RuralService[] by RuralServiceCategory
 *
 * No new tags. No data mutations. Selectors are read-only.
 */

import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import type { Domain, Need } from './decisionAssistTypes';

export interface NeedDef {
  id: Need;
  label: string;
  domain: Domain;
  /** Filter facilities. Return [] if not facility-driven. */
  facilityMatch: (facilities: Facility[], services: RuralService[]) => Facility[];
  /** Filter services. Return [] if not service-driven. */
  serviceMatch: (services: RuralService[]) => RuralService[];
  /** Fallback action when no matches exist. */
  fallbackAction: string;
  /** Pathway label for the result header. */
  pathway: string;
  /** True if a hotline / non-geographic resource should always be offered (e.g. crisis). */
  hotline?: { name: string; line: string };
  /** True if the County mobility manager should be the primary target (transportation only). */
  preferMobilityManager?: boolean;
}

export const DOMAIN_LABELS: Record<Domain, string> = {
  physical: 'Physical Health',
  behavioral: 'Behavioral Health',
  social: 'Social Health',
};

const nonBHClinics = (facilities: Facility[], services: RuralService[]) =>
  facilities.filter(f => f.type === 'clinic' && !facilityOffersBehavioralHealth(f, services));

const bhFacilities = (facilities: Facility[], services: RuralService[]) =>
  facilities.filter(f => facilityOffersBehavioralHealth(f, services));

const hospitals = (facilities: Facility[]) =>
  facilities.filter(f => f.type === 'hospital');

const byCategory = (cats: string[]) =>
  (services: RuralService[]) => services.filter(s => cats.includes(s.category));

export const NEEDS: NeedDef[] = [
  // ── Physical ─────────────────────────────────────────────
  {
    id: 'primary_care', label: 'Primary care', domain: 'physical',
    facilityMatch: nonBHClinics,
    serviceMatch: byCategory(['Physical Health']),
    fallbackAction: 'Refer to 211 Nevada — no in-network primary care record.',
    pathway: 'In-person primary care',
  },
  {
    id: 'urgent_care', label: 'Urgent care', domain: 'physical',
    facilityMatch: (f, s) => [...nonBHClinics(f, s), ...hospitals(f)],
    serviceMatch: () => [],
    fallbackAction: 'Direct to nearest ED if symptoms warrant; otherwise 211 Nevada.',
    pathway: 'Same-day urgent care',
  },
  {
    id: 'medication', label: 'Medication access', domain: 'physical',
    facilityMatch: (f, s) => [...nonBHClinics(f, s), ...hospitals(f)],
    serviceMatch: byCategory(['Physical Health']),
    fallbackAction: 'Call prescribing provider; refer to 211 Nevada for medication assistance.',
    pathway: 'Medication access',
  },
  {
    id: 'hospital_er', label: 'Hospital / emergency', domain: 'physical',
    facilityMatch: (f) => hospitals(f),
    serviceMatch: () => [],
    fallbackAction: 'Direct to nearest ED. If life-threatening, instruct member to call 911.',
    pathway: 'Hospital / emergency department',
  },
  {
    id: 'dental', label: 'Dental', domain: 'physical',
    facilityMatch: () => [],
    serviceMatch: () => [],
    fallbackAction: 'Refer to 211 Nevada — no in-network dental record.',
    pathway: 'Dental care',
  },
  {
    id: 'vision', label: 'Vision', domain: 'physical',
    facilityMatch: () => [],
    serviceMatch: () => [],
    fallbackAction: 'Refer to 211 Nevada — no in-network vision record.',
    pathway: 'Vision care',
  },

  // ── Behavioral ───────────────────────────────────────────
  {
    id: 'therapy', label: 'Therapy / counseling', domain: 'behavioral',
    facilityMatch: bhFacilities,
    serviceMatch: byCategory(['Mental Health']),
    fallbackAction: 'Offer telehealth-first intake; refer to 988 if acuity escalates.',
    pathway: 'Therapy / counseling',
  },
  {
    id: 'psychiatry', label: 'Psychiatry / medication management', domain: 'behavioral',
    facilityMatch: bhFacilities,
    serviceMatch: byCategory(['Mental Health']),
    fallbackAction: 'Default to telepsychiatry intake; in-person typically non-viable in rural counties.',
    pathway: 'Psychiatry / medication management',
  },
  {
    id: 'crisis', label: 'Crisis support', domain: 'behavioral',
    facilityMatch: bhFacilities,
    serviceMatch: byCategory(['Mental Health']),
    fallbackAction: 'Connect to 988 immediately; coordinate in-person follow-up after stabilization.',
    pathway: 'Behavioral health crisis',
    hotline: { name: '988 Suicide & Crisis Lifeline', line: '988' },
  },
  {
    id: 'substance_use', label: 'Substance use treatment', domain: 'behavioral',
    facilityMatch: bhFacilities,
    serviceMatch: byCategory(['Substance Use', 'Recovery/Boarding']),
    fallbackAction: 'Refer to SAMHSA helpline 1-800-662-4357.',
    pathway: 'Substance use treatment',
  },
  {
    id: 'case_mgmt', label: 'Case management', domain: 'behavioral',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Coordinated Entry', 'Family Services']),
    fallbackAction: 'Open NBH case management; coordinate with county FTE.',
    pathway: 'Case management',
  },
  {
    id: 'peer_support', label: 'Peer support', domain: 'behavioral',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Mental Health', 'Recovery/Boarding']),
    fallbackAction: 'Refer to Nevada Peer Support Network.',
    pathway: 'Peer support',
  },

  // ── Social ───────────────────────────────────────────────
  {
    id: 'housing', label: 'Housing', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Shelter', 'Supportive Housing', 'Housing (Low-Income)', 'Coordinated Entry']),
    fallbackAction: 'Refer to county Coordinated Entry; if none, 211 Nevada.',
    pathway: 'Housing assistance',
  },
  {
    id: 'food', label: 'Food', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Food']),
    fallbackAction: 'Refer to 211 Nevada food resources.',
    pathway: 'Food assistance',
  },
  {
    id: 'transportation', label: 'Transportation', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: () => [],
    fallbackAction: 'Coordinate via county Mobility Manager.',
    pathway: 'Transportation coordination',
    preferMobilityManager: true,
  },
  {
    id: 'benefits', label: 'Benefits / documentation', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Coordinated Entry', 'Senior Services', 'Disability Services']),
    fallbackAction: 'Refer to Nevada DWSS; back up with 211 Nevada.',
    pathway: 'Benefits and documentation',
  },
  {
    id: 'employment', label: 'Employment support', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Employment']),
    fallbackAction: 'Refer to Nevada JobConnect / Employ NV.',
    pathway: 'Employment support',
  },
  {
    id: 'safety_dv', label: 'Safety / domestic violence', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Shelter']),
    fallbackAction: 'Connect to National DV Hotline 1-800-799-7233; coordinate safe transport.',
    pathway: 'Safety / domestic violence',
    hotline: { name: 'National Domestic Violence Hotline', line: '1-800-799-7233' },
  },
  {
    id: 'legal_aid', label: 'Legal aid', domain: 'social',
    facilityMatch: () => [],
    serviceMatch: byCategory(['Legal']),
    fallbackAction: 'Refer to Nevada Legal Services; back up with VARN for rural counties.',
    pathway: 'Legal aid',
  },
];

export const NEEDS_BY_DOMAIN: Record<Domain, NeedDef[]> = {
  physical: NEEDS.filter(n => n.domain === 'physical'),
  behavioral: NEEDS.filter(n => n.domain === 'behavioral'),
  social: NEEDS.filter(n => n.domain === 'social'),
};

export const findNeed = (id: Need): NeedDef | undefined => NEEDS.find(n => n.id === id);
