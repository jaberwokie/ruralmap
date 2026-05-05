/**
 * Derived site-density signal for Behavioral Health staging rows.
 *
 * Groups by (organization_name, city, county) — case-insensitive, trimmed —
 * to estimate how many provider entries roll up to the same physical site.
 * Pure function. NOT persisted.
 */

import type { StagingBhRow } from '@/types/mappingPipeline';

export type SiteDensityTier = 'single' | 'multi' | 'hub';

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

const keyOf = (r: Pick<StagingBhRow, 'organization_name' | 'city' | 'county'>) =>
  `${norm(r.organization_name)}|${norm(r.city)}|${norm(r.county)}`;

/**
 * Returns a map of staging row id → group size. Rows with no
 * organization_name AND no city AND no county get density 1
 * (cannot be grouped meaningfully).
 */
export const computeBhSiteDensity = (rows: StagingBhRow[]): Map<string, number> => {
  const groups = new Map<string, string[]>(); // key → ids
  for (const r of rows) {
    const k = keyOf(r);
    if (k === '||') continue; // ungroupable
    const ids = groups.get(k) ?? [];
    ids.push(r.id);
    groups.set(k, ids);
  }
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k === '||') { out.set(r.id, 1); continue; }
    out.set(r.id, groups.get(k)?.length ?? 1);
  }
  return out;
};

export const siteDensityTier = (count: number): SiteDensityTier =>
  count >= 4 ? 'hub' : count >= 2 ? 'multi' : 'single';
