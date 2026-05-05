/**
 * Behavioral Health access tags.
 *
 * Additive layer on top of BH ingestion. Captures supplemental access
 * signals that are NOT BH categories:
 *   - telehealth                   (list-only unless lat/lng also present)
 *   - fqhc                         (Federally Qualified Health Center)
 *   - rural_health_clinic          (RHC)
 *   - critical_access_hospital     (also covers "Rural Access Hospital")
 *
 * Stored as a comma-separated string in `service_tags` on staging_bh /
 * verified_bh — same shape Services already uses, so no new column type.
 */

export const BH_ACCESS_TAGS = [
  'telehealth',
  'fqhc',
  'rural_health_clinic',
  'critical_access_hospital',
  'ccbhc',
] as const;

export type BhAccessTag = (typeof BH_ACCESS_TAGS)[number];

export const BH_ACCESS_TAG_LABELS: Record<BhAccessTag, string> = {
  telehealth: 'Telehealth',
  fqhc: 'FQHC',
  rural_health_clinic: 'Rural Health Clinic',
  critical_access_hospital: 'Critical Access Hospital',
};

const VARIANT_MAP: Array<{ test: RegExp; tag: BhAccessTag }> = [
  // telehealth
  { test: /\b(bh\s+)?tele[-\s]?health(\s+provider)?\b/i, tag: 'telehealth' },
  { test: /\bvirtual\s+(care|visit)s?\b/i, tag: 'telehealth' },
  { test: /\btelemedicine\b/i, tag: 'telehealth' },
  // fqhc
  { test: /\bfqhc\b/i, tag: 'fqhc' },
  { test: /\bfederally\s+qualified\s+health\s+center\b/i, tag: 'fqhc' },
  // rural health clinic
  { test: /\brhc\b/i, tag: 'rural_health_clinic' },
  { test: /\brural\s+health\s+clinic\b/i, tag: 'rural_health_clinic' },
  // critical access hospital
  { test: /\bcah\b/i, tag: 'critical_access_hospital' },
  { test: /\bcritical\s+access\s+hospital\b/i, tag: 'critical_access_hospital' },
  { test: /\brural\s+access\s+hospital\b/i, tag: 'critical_access_hospital' },
];

const isCanonical = (s: string): s is BhAccessTag =>
  (BH_ACCESS_TAGS as readonly string[]).includes(s);

const normalizeOne = (token: string): BhAccessTag | null => {
  const t = token.trim();
  if (!t) return null;
  const lc = t.toLowerCase().replace(/[\s-]+/g, '_');
  if (isCanonical(lc)) return lc;
  for (const { test, tag } of VARIANT_MAP) {
    if (test.test(t)) return tag;
  }
  return null;
};

/**
 * Parse a free-form tag input (comma/semicolon/pipe separated) and return
 * a normalized comma-separated string of canonical BH access tags. Returns
 * null when nothing recognized.
 */
export const normalizeBhAccessTags = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) return null;
  const parts = String(raw).split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  const out = new Set<BhAccessTag>();
  for (const p of parts) {
    const tag = normalizeOne(p);
    if (tag) out.add(tag);
  }
  if (out.size === 0) return null;
  // preserve canonical order
  return BH_ACCESS_TAGS.filter((t) => out.has(t)).join(',');
};

/** Parse a stored service_tags string back into a tag array. */
export const parseBhAccessTags = (
  raw: string | null | undefined,
): BhAccessTag[] => {
  if (!raw) return [];
  const parts = String(raw).split(/[,;|]/).map((p) => p.trim().toLowerCase());
  const out: BhAccessTag[] = [];
  for (const p of parts) {
    if (isCanonical(p) && !out.includes(p)) out.push(p);
  }
  return out;
};

export const hasTelehealthTag = (raw: string | null | undefined): boolean =>
  parseBhAccessTags(raw).includes('telehealth');
