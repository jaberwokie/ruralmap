/**
 * Controlled Services category list + auto-mapper.
 *
 * The 15-value list is the single source of truth for `category_mapped`
 * on staging_services / verified_services. Promotion is gated on a value
 * from this list being present.
 *
 * `category_raw` (the original CSV value) is never mutated; the mapper
 * only ever produces `category_mapped`.
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

/**
 * Substring synonym table. First match wins. Order matters — more specific
 * phrases appear before generic ones (e.g. "domestic violence" before
 * "community"; "mental health" before "health").
 */
const SYNONYMS: Array<{ patterns: string[]; category: ServiceCategory }> = [
  { category: 'Domestic Violence',   patterns: ['domestic violence', 'dv shelter', 'ipv', 'intimate partner'] },
  { category: 'Behavioral Health',   patterns: ['behavioral health', 'mental health', 'counsel', 'therapy', 'psych', 'bh '] },
  { category: 'Substance Use',       patterns: ['substance', 'sud', 'detox', 'mat ', 'medication-assisted', 'recovery', 'addiction', 'opioid'] },
  { category: 'Senior Services',     patterns: ['senior', 'elder', 'aging', 'geriatric'] },
  { category: 'Disability Services', patterns: ['disab', 'idd', 'accessib', 'developmental'] },
  { category: 'Financial Assistance',patterns: ['financ', 'benefit', 'assist', 'snap', 'tanf', 'wic', 'utility help', 'rental assist'] },
  { category: 'Employment',          patterns: ['employ', 'job', 'work', 'vocational', 'career'] },
  { category: 'Legal',               patterns: ['legal', 'attorney', 'lawyer', 'law '] },
  { category: 'Clothing',            patterns: ['cloth', 'apparel', 'wardrobe'] },
  { category: 'Utilities',           patterns: ['utility', 'utilities', 'power', 'water bill', 'energy', 'lihea'] },
  { category: 'Food',                patterns: ['food', 'pantry', 'meal', 'nutrition', 'grocery'] },
  { category: 'Housing',             patterns: ['shelter', 'housing', 'transitional', 'homeless', 'rental'] },
  { category: 'Transportation',      patterns: ['transport', 'transit', 'bus', 'rideshare', 'mobility', 'rides'] },
  { category: 'Medical',             patterns: ['medical', 'clinic', 'primary care', 'health center', 'physician', 'fqhc', 'hospital'] },
  { category: 'Community Support',   patterns: ['community', 'peer', 'outreach', 'support group', 'navigator', 'case management'] },
];

export const autoMapCategory = (raw: string | null | undefined): ServiceCategory | null => {
  if (!raw) return null;
  const lc = raw.toLowerCase();
  if (lc.trim().length === 0) return null;
  // Exact match against canonical first
  for (const c of SERVICE_CATEGORIES) {
    if (lc === c.toLowerCase()) return c;
  }
  for (const { patterns, category } of SYNONYMS) {
    if (patterns.some((p) => lc.includes(p))) return category;
  }
  return null;
};
