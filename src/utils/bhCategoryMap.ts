/**
 * Controlled Behavioral Health category list + auto-mapper.
 *
 * Mirrors the Services controlled-category approach. `category_raw` on
 * staging_bh / verified_bh preserves the original CSV value (audit);
 * `category_mapped` must be one of BH_CATEGORIES before promotion.
 *
 * Matching strategy (scored, not first-match):
 *   1. Exact canonical category match wins outright.
 *   2. Otherwise every pattern that matches the lowercased raw string
 *      contributes a score:
 *        - phrase patterns (>4 chars):   tokenCount*100 + length
 *        - acronym patterns (<=4 chars): 50 (word-boundary, moderate)
 *      Multi-word clinical phrases beat generic single tokens; acronyms
 *      sit between phrases and generic terms.
 *   3. "Community Behavioral Health" is the low-priority fallback
 *      (heavily penalized), unless a high-priority explicit phrase
 *      ("behavioral health clinic", etc.) is present.
 *   4. Unknown raw values return null → row stages, promotion blocked.
 *
 * Expected mappings (sanity examples):
 *   "mental health counseling"      → Therapy / Counseling
 *   "behavioral health clinic"      → Community Behavioral Health
 *   "mental health clinic"          → Mental Health
 *   "psychiatric clinic"            → Psychiatry
 *   "psychiatry"                    → Psychiatry
 *   "psychiatric medication"        → Psychiatry
 *   "medication assisted treatment" → Medication Assisted Treatment
 *   "MAT" / "MAT program"           → Medication Assisted Treatment
 *   "maternal health"               → null (no false MAT match)
 *   "detox"                         → Detox
 *   "substance use treatment"       → Substance Use
 *   "substance use disorder"        → Substance Use
 *   "SUD services"                  → Substance Use
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

type Pattern = { pattern: string; category: BHCategory };

/**
 * Phrase patterns — matched as plain lowercased substrings.
 * Order does not matter for scoring (score wins), but more specific phrases
 * naturally score higher because of token count + length.
 */
const PHRASES: Pattern[] = [
  // Domestic Violence / Trauma — outrank generic counseling/therapy
  { category: 'Domestic Violence / Trauma',  pattern: 'domestic violence counseling' },
  { category: 'Domestic Violence / Trauma',  pattern: 'domestic violence' },
  { category: 'Domestic Violence / Trauma',  pattern: 'intimate partner' },
  { category: 'Domestic Violence / Trauma',  pattern: 'trauma-informed' },
  { category: 'Domestic Violence / Trauma',  pattern: 'trauma therapy' },

  // Youth BH — outrank generic therapy/counseling
  { category: 'Youth Behavioral Health',     pattern: 'youth behavioral health' },
  { category: 'Youth Behavioral Health',     pattern: 'youth therapy' },
  { category: 'Youth Behavioral Health',     pattern: 'youth counseling' },
  { category: 'Youth Behavioral Health',     pattern: 'adolescent' },
  { category: 'Youth Behavioral Health',     pattern: 'pediatric behavioral' },
  { category: 'Youth Behavioral Health',     pattern: 'child therapy' },

  // Medication Assisted Treatment — phrases only (acronym handled below)
  { category: 'Medication Assisted Treatment', pattern: 'medication assisted treatment' },
  { category: 'Medication Assisted Treatment', pattern: 'medication-assisted treatment' },
  { category: 'Medication Assisted Treatment', pattern: 'mat program' },
  { category: 'Medication Assisted Treatment', pattern: 'mat clinic' },
  { category: 'Medication Assisted Treatment', pattern: 'mat services' },
  { category: 'Medication Assisted Treatment', pattern: 'suboxone' },
  { category: 'Medication Assisted Treatment', pattern: 'methadone' },
  { category: 'Medication Assisted Treatment', pattern: 'buprenorphine' },

  // Detox
  { category: 'Detox',                       pattern: 'detoxification' },
  { category: 'Detox',                       pattern: 'detox' },
  { category: 'Detox',                       pattern: 'withdrawal management' },

  // Crisis Services — explicit high-priority phrases
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
  { category: 'Recovery Support',            pattern: 'recovery support' },
  { category: 'Recovery Support',            pattern: 'recovery housing' },
  { category: 'Recovery Support',            pattern: 'sober living' },

  // Peer Support
  { category: 'Peer Support',                pattern: 'peer recovery' },
  { category: 'Peer Support',                pattern: 'peer support' },
  { category: 'Peer Support',                pattern: 'peer specialist' },
  { category: 'Peer Support',                pattern: 'recovery coach' },

  // Case Management
  { category: 'Case Management',             pattern: 'case management' },
  { category: 'Case Management',             pattern: 'care coordination' },
  { category: 'Case Management',             pattern: 'care navigator' },

  // Psychiatry — "psychiatric clinic" must outrank generic Mental Health/CBH
  { category: 'Psychiatry',                  pattern: 'psychiatric clinic' },
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
  { category: 'Therapy / Counseling',        pattern: 'psychotherapy' },
  { category: 'Therapy / Counseling',        pattern: 'counseling' },
  { category: 'Therapy / Counseling',        pattern: 'counselor' },
  { category: 'Therapy / Counseling',        pattern: 'therapist' },
  { category: 'Therapy / Counseling',        pattern: 'therapy' },

  // Substance Use — phrases; acronym handled separately
  { category: 'Substance Use',               pattern: 'substance use treatment' },
  { category: 'Substance Use',               pattern: 'substance use disorder' },
  { category: 'Substance Use',               pattern: 'substance abuse' },
  { category: 'Substance Use',               pattern: 'substance use' },
  { category: 'Substance Use',               pattern: 'addiction treatment' },
  { category: 'Substance Use',               pattern: 'addiction' },
  { category: 'Substance Use',               pattern: 'opioid' },
  { category: 'Substance Use',               pattern: 'alcohol use' },

  // Mental Health — "mental health clinic" / "mental health services" pinned high
  { category: 'Mental Health',               pattern: 'mental health clinic' },
  { category: 'Mental Health',               pattern: 'mental health services' },
  { category: 'Mental Health',               pattern: 'mental health' },
  { category: 'Mental Health',               pattern: 'behavioral health services' },

  // Community Behavioral Health — explicit high-priority phrase wins;
  // bare "behavioral health" stays here as low-priority fallback.
  { category: 'Community Behavioral Health', pattern: 'community behavioral health' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health clinic' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health center' },
  { category: 'Community Behavioral Health', pattern: 'community mental health' },
  { category: 'Community Behavioral Health', pattern: 'bh clinic' },
  { category: 'Community Behavioral Health', pattern: 'behavioral health' },
];

/**
 * Acronym patterns — matched with word boundaries so "mat" never hits
 * "maternal" and "sud" never hits "sudden". Moderate fixed score.
 */
const ACRONYMS: Pattern[] = [
  { category: 'Medication Assisted Treatment', pattern: 'mat' },
  { category: 'Substance Use',                 pattern: 'sud' },
  { category: 'Outpatient Treatment',          pattern: 'iop' },
  { category: 'Outpatient Treatment',          pattern: 'php' },
  { category: 'Domestic Violence / Trauma',    pattern: 'ipv' },
  { category: 'Community Behavioral Health',   pattern: 'cmhc' },
  { category: 'Community Behavioral Health',   pattern: 'bh' },
];

const tokenCount = (s: string) => s.trim().split(/\s+/).length;

const PHRASE_BASE = (pattern: string) => tokenCount(pattern) * 100 + pattern.length;
const ACRONYM_SCORE = 50;
const FALLBACK_PENALTY = 1000;

const scorePhrase = (pattern: string, category: BHCategory): number => {
  const base = PHRASE_BASE(pattern);
  // "behavioral health clinic" is itself an explicit CBH phrase — let it
  // win normally. Only the bare "behavioral health" / "bh clinic" fallbacks
  // get penalized.
  if (category === 'Community Behavioral Health') {
    const isExplicit =
      pattern === 'community behavioral health' ||
      pattern === 'behavioral health clinic' ||
      pattern === 'behavioral health center' ||
      pattern === 'community mental health';
    if (!isExplicit) return base - FALLBACK_PENALTY;
  }
  return base;
};

// Cache compiled word-boundary regexes.
const ACRONYM_RE = new Map<string, RegExp>();
const acronymRe = (p: string): RegExp => {
  let re = ACRONYM_RE.get(p);
  if (!re) {
    re = new RegExp(`\\b${p}\\b`, 'i');
    ACRONYM_RE.set(p, re);
  }
  return re;
};

export const autoMapBHCategory = (raw: string | null | undefined): BHCategory | null => {
  if (!raw) return null;
  const lc = raw.toLowerCase().trim();
  if (lc.length === 0) return null;

  // 1. Exact canonical match wins.
  for (const c of BH_CATEGORIES) {
    if (lc === c.toLowerCase()) return c;
  }

  let bestCategory: BHCategory | null = null;
  let bestScore = -Infinity;

  // 2a. Phrase scoring (substring).
  for (const { pattern, category } of PHRASES) {
    if (!lc.includes(pattern)) continue;
    const score = scorePhrase(pattern, category);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // 2b. Acronym scoring (word-boundary). Moderate score — beats nothing
  // longer than "behavioral health" by itself, but never matches inside
  // unrelated words.
  for (const { pattern, category } of ACRONYMS) {
    if (!acronymRe(pattern).test(lc)) continue;
    const score = ACRONYM_SCORE;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
};
