/**
 * Controlled Services category list + auto-mapper.
 *
 * The 15-value list is the single source of truth for `category_mapped`
 * on staging_services / verified_services. Promotion is gated on a value
 * from this list being present.
 *
 * `category_raw` (the original CSV value) is never mutated; the mapper
 * only ever produces `category_mapped`.
 *
 * Matching strategy (scored, not first-match):
 *   1. Exact canonical category match wins outright.
 *   2. Otherwise every pattern that hits the lowercased raw string
 *      contributes a score = (pattern token count) * 10 + pattern length.
 *      Multi-word phrases ("community health center") therefore beat
 *      generic single tokens ("community").
 *   3. Community Support is a low-priority fallback: its hits are scored
 *      with a heavy penalty so any other matched category wins.
 *   4. No matches → null (row stages, promotion blocked).
 *
 * Expected mappings (sanity examples):
 *   "Food"                       → Food
 *   "Housing"                    → Housing
 *   "community health center"    → Medical
 *   "primary care clinic"        → Medical
 *   "mental health counseling"   → Behavioral Health
 *   "housing assistance"         → Housing
 *   "community housing outreach" → Housing
 *   "utility assistance"         → Utilities
 *   "rental assistance"          → Housing
 *   "food assistance"            → Food
 *   "community navigator"        → Community Support
 *   "frobnicator"                → null
 */

export const SERVICE_CATEGORIES = [
  'Food',
  'Housing',
  'Transportation',
  'Medical',
  'Behavioral Health',
  'Substance Use',
  'Senior Services',
  'Disability Services',
  'Financial Assistance',
  'Employment',
  'Legal',
  'Domestic Violence',
  'Clothing',
  'Utilities',
  'Community Support',
] as const;

export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const isServiceCategory = (v: unknown): v is ServiceCategory =>
  typeof v === 'string' && (SERVICE_CATEGORIES as readonly string[]).includes(v);

const PATTERNS: Array<{ pattern: string; category: ServiceCategory }> = [
  // Domestic Violence
  { category: 'Domestic Violence',    pattern: 'domestic violence' },
  { category: 'Domestic Violence',    pattern: 'dv shelter' },
  { category: 'Domestic Violence',    pattern: 'intimate partner' },
  { category: 'Domestic Violence',    pattern: 'ipv' },

  // Behavioral Health
  { category: 'Behavioral Health',    pattern: 'behavioral health' },
  { category: 'Behavioral Health',    pattern: 'mental health' },
  { category: 'Behavioral Health',    pattern: 'counseling' },
  { category: 'Behavioral Health',    pattern: 'counsel' },
  { category: 'Behavioral Health',    pattern: 'therapy' },
  { category: 'Behavioral Health',    pattern: 'psych' },

  // Substance Use
  { category: 'Substance Use',        pattern: 'substance use' },
  { category: 'Substance Use',        pattern: 'medication-assisted' },
  { category: 'Substance Use',        pattern: 'substance' },
  { category: 'Substance Use',        pattern: 'detox' },
  { category: 'Substance Use',        pattern: 'recovery' },
  { category: 'Substance Use',        pattern: 'addiction' },
  { category: 'Substance Use',        pattern: 'opioid' },
  { category: 'Substance Use',        pattern: 'sud' },

  // Senior Services
  { category: 'Senior Services',      pattern: 'senior' },
  { category: 'Senior Services',      pattern: 'elder' },
  { category: 'Senior Services',      pattern: 'aging' },
  { category: 'Senior Services',      pattern: 'geriatric' },

  // Disability Services
  { category: 'Disability Services',  pattern: 'disability' },
  { category: 'Disability Services',  pattern: 'developmental' },
  { category: 'Disability Services',  pattern: 'accessibility' },
  { category: 'Disability Services',  pattern: 'idd' },

  // Employment
  { category: 'Employment',           pattern: 'employment' },
  { category: 'Employment',           pattern: 'vocational' },
  { category: 'Employment',           pattern: 'workforce' },
  { category: 'Employment',           pattern: 'career' },
  { category: 'Employment',           pattern: 'job' },

  // Legal
  { category: 'Legal',                pattern: 'legal aid' },
  { category: 'Legal',                pattern: 'legal' },
  { category: 'Legal',                pattern: 'attorney' },
  { category: 'Legal',                pattern: 'lawyer' },

  // Clothing
  { category: 'Clothing',             pattern: 'clothing' },
  { category: 'Clothing',             pattern: 'apparel' },
  { category: 'Clothing',             pattern: 'wardrobe' },

  // Medical (specific phrases score high so they beat "community" / "health")
  { category: 'Medical',              pattern: 'community health center' },
  { category: 'Medical',              pattern: 'federally qualified health center' },
  { category: 'Medical',              pattern: 'primary care clinic' },
  { category: 'Medical',              pattern: 'primary care' },
  { category: 'Medical',              pattern: 'health center' },
  { category: 'Medical',              pattern: 'health clinic' },
  { category: 'Medical',              pattern: 'medical clinic' },
  { category: 'Medical',              pattern: 'medical' },
  { category: 'Medical',              pattern: 'clinic' },
  { category: 'Medical',              pattern: 'physician' },
  { category: 'Medical',              pattern: 'fqhc' },
  { category: 'Medical',              pattern: 'hospital' },

  // Food (specific phrases first; "food assistance" must win over Financial Assistance)
  { category: 'Food',                 pattern: 'food assistance' },
  { category: 'Food',                 pattern: 'food bank' },
  { category: 'Food',                 pattern: 'food pantry' },
  { category: 'Food',                 pattern: 'meal delivery' },
  { category: 'Food',                 pattern: 'pantry' },
  { category: 'Food',                 pattern: 'nutrition' },
  { category: 'Food',                 pattern: 'grocery' },
  { category: 'Food',                 pattern: 'food' },
  { category: 'Food',                 pattern: 'meal' },

  // Housing (specific phrases first; "rental assistance" / "housing assistance" beat Financial Assistance)
  { category: 'Housing',              pattern: 'transitional housing' },
  { category: 'Housing',              pattern: 'housing assistance' },
  { category: 'Housing',              pattern: 'rental assistance' },
  { category: 'Housing',              pattern: 'emergency shelter' },
  { category: 'Housing',              pattern: 'homeless' },
  { category: 'Housing',              pattern: 'housing' },
  { category: 'Housing',              pattern: 'shelter' },
  { category: 'Housing',              pattern: 'rental' },

  // Utilities (specific "utility assistance" must beat Financial Assistance)
  { category: 'Utilities',            pattern: 'utility assistance' },
  { category: 'Utilities',            pattern: 'energy assistance' },
  { category: 'Utilities',            pattern: 'water bill' },
  { category: 'Utilities',            pattern: 'liheap' },
  { category: 'Utilities',            pattern: 'utilities' },
  { category: 'Utilities',            pattern: 'utility' },

  // Transportation
  { category: 'Transportation',       pattern: 'medical transportation' },
  { category: 'Transportation',       pattern: 'non-emergency transport' },
  { category: 'Transportation',       pattern: 'transportation' },
  { category: 'Transportation',       pattern: 'transit' },
  { category: 'Transportation',       pattern: 'rideshare' },
  { category: 'Transportation',       pattern: 'mobility' },
  { category: 'Transportation',       pattern: 'bus' },

  // Financial Assistance (generic last; specific assistance categories above already won)
  { category: 'Financial Assistance', pattern: 'financial assistance' },
  { category: 'Financial Assistance', pattern: 'cash assistance' },
  { category: 'Financial Assistance', pattern: 'snap' },
  { category: 'Financial Assistance', pattern: 'tanf' },
  { category: 'Financial Assistance', pattern: 'wic' },
  { category: 'Financial Assistance', pattern: 'benefits' },
  { category: 'Financial Assistance', pattern: 'financial' },

  // Community Support — fallback only (heavily penalized below)
  { category: 'Community Support',    pattern: 'case management' },
  { category: 'Community Support',    pattern: 'support group' },
  { category: 'Community Support',    pattern: 'navigator' },
  { category: 'Community Support',    pattern: 'peer support' },
  { category: 'Community Support',    pattern: 'outreach' },
  { category: 'Community Support',    pattern: 'community' },
  { category: 'Community Support',    pattern: 'peer' },
];

const tokenCount = (s: string) => s.trim().split(/\s+/).length;

const scoreFor = (pattern: string, category: ServiceCategory): number => {
  const base = tokenCount(pattern) * 10 + pattern.length;
  // Community Support is a fallback: any non-CS hit must outrank it.
  if (category === 'Community Support') return base - 1000;
  return base;
};

export const autoMapCategory = (raw: string | null | undefined): ServiceCategory | null => {
  if (!raw) return null;
  const lc = raw.toLowerCase().trim();
  if (lc.length === 0) return null;

  // 1. Exact canonical match wins outright.
  for (const c of SERVICE_CATEGORIES) {
    if (lc === c.toLowerCase()) return c;
  }

  // 2. Scored substring match — highest score wins.
  let bestCategory: ServiceCategory | null = null;
  let bestScore = -Infinity;

  for (const { pattern, category } of PATTERNS) {
    if (!lc.includes(pattern)) continue;
    const score = scoreFor(pattern, category);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
};
