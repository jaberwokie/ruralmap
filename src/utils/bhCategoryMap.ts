/**
 * Controlled Behavioral Health category list + auto-mapper.
 *
 * Mirrors the Services controlled-category approach. `category_raw` on
 * staging_bh / verified_bh preserves the original CSV value (audit);
 * `category_mapped` must be one of BH_CATEGORIES before promotion.
 *
 * Matching strategy (scored, not first-match):
 *   1. Exact canonical category match wins outright.
 *   2. Otherwise every pattern that hits the lowercased raw string
 *      contributes a score = (token count) * 10 + length. Multi-word
 *      clinical phrases beat generic single tokens.
 *   3. "Community Behavioral Health" is the low-priority fallback.
 *
 * Expected mappings (sanity examples):
 *   "mental health counseling"      → Therapy / Counseling
 *   "behavioral health clinic"      → Community Behavioral Health
 *   "psychiatry"                    → Psychiatry
 *   "psychiatric medication"        → Psychiatry
 *   "medication assisted treatment" → Medication Assisted Treatment
 *   "MAT"                           → Medication Assisted Treatment
 *   "detox"                         → Detox
 *   "substance use treatment"       → Substance Use
 *   "crisis stabilization"          → Crisis Services
 *   "mobile crisis"                 → Crisis Services
 *   "peer recovery"                 → Peer Support
 *   "case management"               → Case Management
 *   "residential treatment"         → Residential Treatment
 *   "outpatient treatment"          → Outpatient Treatment
 *   "youth therapy"                 → Youth Behavioral Health
 *   "domestic violence counseling"  → Domestic Violence / Trauma
 *   "frobnicator"                   → null
 */

export const BH_CATEGORIES = [
  'Mental Health',
  'Substance Use',
  'Crisis Services',
  'Psychiatry',
  'Therapy / Counseling',
  'Peer Support',
  'Case Management',
  'Residential Treatment',
  'Outpatient Treatment',
  'Medication Assisted Treatment',
  'Detox',
  'Recovery Support',
  'Youth Behavioral Health',
  'Domestic Violence / Trauma',
  'Community Behavioral Health',
] as const;

export type BHCategory = typeof BH_CATEGORIES[number];

export const isBHCategory = (v: unknown): v is BHCategory =>
  typeof v === 'string' && (BH_CATEGORIES as readonly string[]).includes(v);

const PATTERNS: Array<{ pattern: string; category: BHCategory }> = [
  // Domestic Violence / Trauma — must outrank generic counseling/therapy
  { category: 'Domestic Violence / Trauma',  pattern: 'domestic violence counseling' },
  { category: 'Domestic Violence / Trauma',  pattern: 'domestic violence' },
  { category: 'Domestic Violence / Trauma',  pattern: 'intimate partner' },
  { category: 'Domestic Violence / Trauma',  pattern: 'trauma-informed' },
  { category: 'Domestic Violence / Trauma',  pattern: 'trauma therapy' },
  { category: 'Domestic Violence / Trauma',  pattern: 'ipv' },

  // Youth BH — outrank generic therapy/counseling
  { category: 'Youth Behavioral Health',     pattern: 'youth behavioral health' },
  { category: 'Youth Behavioral Health',     pattern: 'youth therapy' },
  { category: 'Youth Behavioral Health',     pattern: 'youth counseling' },
  { category: 'Youth Behavioral Health',     pattern: 'adolescent' },
  { category: 'Youth Behavioral Health',     pattern: 'pediatric behavioral' },
  { category: 'Youth Behavioral Health',     pattern: 'child therapy' },

  // Medication Assisted Treatment — specific phrases first
  { category: 'Medication Assisted Treatment', pattern: 'medication assisted treatment' },
  { category: 'Medication Assisted Treatment', pattern: 'medication-assisted treatment' },
  { category: 'Medication Assisted Treatment', pattern: 'mat program' },
  { category: 'Medication Assisted Treatment', pattern: 'mat clinic' },
  { category: 'Medication Assisted Treatment', pattern: 'suboxone' },
  { category: 'Medication Assisted Treatment', pattern: 'methadone' },
  { category: 'Medication Assisted Treatment', pattern: 'buprenorphine' },
  { category: 'Medication Assisted Treatment', pattern: 'mat ' },
  { category: 'Medication Assisted Treatment', pattern: ' mat' },

  // Detox
  { category: 'Detox',                       pattern: 'detoxification' },
  { category: 'Detox',                       pattern: 'detox' },
  { category: 'Detox',                       pattern: 'withdrawal management' },

  // Crisis Services — specific first
  { category: 'Crisis Services',             pattern: 'crisis stabilization' },
  { category: 'Crisis Services',             pattern: 'mobile crisis' },
  { category: 'Crisis Services',             pattern: 'crisis intervention' },
  { category: 'Crisis Services',             pattern: 'crisis response' },
  { category: 'Crisis Services',             pattern: 'crisis services' },
  { category: 'Crisis Services',             pattern: 'crisis line' },
  { category: 'Crisis Services',             pattern: 'crisis' },

  // Residential / Outpatient / Recovery
  { category: 'Residential Treatment',       pattern: 'residential treatment' },
  { category: 'Residential Treatment',       pattern: 'inpatient treatment' },
  { category: 'Residential Treatment',       pattern: 'residential' },
  { category: 'Outpatient Treatment',        pattern: 'intensive outpatient' },
  { category: 'Outpatient Treatment',        pattern: 'partial hospitalization' },
  { category: 'Outpatient Treatment',        pattern: 'outpatient treatment' },
  { category: 'Outpatient Treatment',        pattern: 'outpatient' },
  { category: 'Outpatient Treatment',        pattern: 'iop' },
  { category: 'Outpatient Treatment',        pattern: 'php' },
  { category: 'Recovery Support',            pattern: 'recovery support' },
  { category: 'Recovery Support',            pattern: 'recovery housing' },
  { category: 'Recovery Support',            pattern: 'sober living' },

  // Peer Support — "peer recovery" must outrank Recovery Support
  { category: 'Peer Support',                pattern: 'peer recovery' },
  { category: 'Peer Support',                pattern: 'peer support' },
  { category: 'Peer Support',                pattern: 'peer specialist' },
  { category: 'Peer Support',                pattern: 'recovery coach' },

  // Case Management
  { category: 'Case Management',             pattern: 'case management' },
  { category: 'Case Management',             pattern: 'care coordination' },
  { category: 'Case Management',             pattern: 'care navigator' },

  // Psychiatry — "psychiatric medication" must outrank generic Mental Health
  { category: 'Psychiatry',                  pattern: 'psychiatric medication' },
  { category: 'Psychiatry',                  pattern: 'medication management' },
  { category: 'Psychiatry',                  pattern: 'psychiatrist' },
  { category: 'Psychiatry',                  pattern: 'psychiatry' },
  { category: 'Psychiatry',                  pattern: 'psychiatric' },

  // Therapy / Counseling — "mental health counseling" must outrank Mental Health
  { category: 'Therapy / Counseling',        pattern: 'mental health counseling' },
  { category: 'Therapy / Counseling',        pattern: 'individual therapy' },
  { category: 'Therapy / Counseling',        pattern: 'group therapy' },
  { category: 'Therapy / Counseling',        pattern: 'family therapy' },
  { category: 'Therapy / Counseling',        pattern: 'counseling' },
  { category: 'Therapy / Counseling',        pattern: 'counselor' },
  { category: 'Therapy / Counseling',        pattern: 'psychotherapy' },
  { category: 'Therapy / Counseling',        pattern: 'therapist' },
  { category: 'Therapy / Counseling',        pattern: 'therapy' },

  // Substance Use — specific phrases first; generic "substance" last
  { category: 'Substance Use',               pattern: 'substance use treatment' },
  { category: 'Substance Use',               pattern: 'substance use disorder' },
  { category: 'Substance Use',               pattern: 'substance abuse' },
  { category: 'Substance Use',               pattern: 'substance use' },
  { category: 'Substance Use',               pattern: 'addiction treatment' },
  { category: 'Substance Use',               pattern: 'addiction' },
  { category: 'Substance Use',               pattern: 'opioid' },
  { category: 'Substance Use',               pattern: 'alcohol use' },
  { category: 'Substance Use',               pattern: 'sud' },

  // Mental Health — generic clinical category
  { category: 'Mental Health',               pattern: 'mental health' },
  { category: 'Mental Health',               pattern: 'behavioral health services' },

  // Community Behavioral Health — low-priority fallback
  { category: 'Community Behavioral Health', pattern: 'community behavioral health' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health clinic' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health center' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health' },
  { category: 'Community Behavioral Health', pattern: 'community mental health' },
  { category: 'Community Behavioral Health', pattern: 'cmhc' },
  { category: 'Community Behavioral Health', pattern: 'bh clinic' },
];

const tokenCount = (s: string) => s.trim().split(/\s+/).length;

const scoreFor = (pattern: string, category: BHCategory): number => {
  const base = tokenCount(pattern) * 10 + pattern.length;
  // Community Behavioral Health is fallback-only.
  if (category === 'Community Behavioral Health') return base - 1000;
  return base;
};

export const autoMapBHCategory = (raw: string | null | undefined): BHCategory | null => {
  if (!raw) return null;
  const lc = raw.toLowerCase().trim();
  if (lc.length === 0) return null;

  // 1. Exact canonical match wins.
  for (const c of BH_CATEGORIES) {
    if (lc === c.toLowerCase()) return c;
  }

  // Common acronym shorthands (whole-string).
  if (lc === 'mat') return 'Medication Assisted Treatment';
  if (lc === 'sud') return 'Substance Use';
  if (lc === 'cmhc') return 'Community Behavioral Health';
  if (lc === 'iop' || lc === 'php') return 'Outpatient Treatment';

  // 2. Scored substring match.
  // Pad with spaces so " mat" / "mat " patterns can match standalone tokens.
  const padded = ` ${lc} `;
  let bestCategory: BHCategory | null = null;
  let bestScore = -Infinity;

  for (const { pattern, category } of PATTERNS) {
    if (!padded.includes(pattern)) continue;
    const score = scoreFor(pattern, category);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
};
