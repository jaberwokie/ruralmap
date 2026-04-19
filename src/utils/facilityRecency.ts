/**
 * Display-layer "Last touched" recency summary for a provider.
 *
 * Combines existing verification dates from operational metadata with
 * enrichment_imported_at from the local enrichment store. Does not invent
 * verification logic; only summarizes what already exists.
 */

import type { Facility } from '@/data/facilities';
import { getOperationalTagIndex } from '@/data/operational-metadata';
import { getEnrichmentForProvider } from '@/utils/providerEnrichmentStore';

export type RecencyStatus =
  | 'recently_verified'
  | 'recently_enriched'
  | 'verified_aging'
  | 'imported_only'
  | 'no_recent_activity';

export interface RecencySummary {
  status: RecencyStatus;
  label: string;
  verifiedDate?: string; // ISO yyyy-mm-dd or descriptive
  enrichedDate?: string; // ISO
}

const RECENT_DAYS = 90;
const AGING_DAYS = 365;

const STATUS_LABEL: Record<RecencyStatus, string> = {
  recently_verified: 'Recently verified',
  recently_enriched: 'Recently enriched',
  verified_aging: 'Verified, but aging',
  imported_only: 'Imported only',
  no_recent_activity: 'No recent activity',
};

const tryParse = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const daysSince = (d: Date): number =>
  Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));

export const deriveRecency = (facility: Facility): RecencySummary | null => {
  const tag = getOperationalTagIndex().get(facility.id);
  const enrichment = getEnrichmentForProvider(facility.id);

  const verifiedDateRaw = tag?.verificationDate;
  const verifiedDate = tryParse(verifiedDateRaw);
  const enrichedDate = tryParse(enrichment?.enrichment_imported_at);

  if (!verifiedDate && !enrichedDate) return null;

  // Imported only: no verification date present at all
  if (!verifiedDate && enrichedDate) {
    return {
      status: 'imported_only',
      label: STATUS_LABEL.imported_only,
      enrichedDate: enrichment?.enrichment_imported_at,
    };
  }

  // Verified-only branch
  if (verifiedDate && !enrichedDate) {
    const days = daysSince(verifiedDate);
    if (days <= RECENT_DAYS) {
      return { status: 'recently_verified', label: STATUS_LABEL.recently_verified, verifiedDate: verifiedDateRaw };
    }
    if (days <= AGING_DAYS) {
      return { status: 'recently_verified', label: STATUS_LABEL.recently_verified, verifiedDate: verifiedDateRaw };
    }
    return { status: 'verified_aging', label: STATUS_LABEL.verified_aging, verifiedDate: verifiedDateRaw };
  }

  // Both present — pick the freshest signal
  const enrichedDays = enrichedDate ? daysSince(enrichedDate) : Infinity;
  const verifiedDays = verifiedDate ? daysSince(verifiedDate) : Infinity;

  if (enrichedDays <= RECENT_DAYS && enrichedDays <= verifiedDays) {
    return {
      status: 'recently_enriched',
      label: STATUS_LABEL.recently_enriched,
      verifiedDate: verifiedDateRaw,
      enrichedDate: enrichment?.enrichment_imported_at,
    };
  }

  if (verifiedDays <= AGING_DAYS) {
    return {
      status: 'recently_verified',
      label: STATUS_LABEL.recently_verified,
      verifiedDate: verifiedDateRaw,
      enrichedDate: enrichment?.enrichment_imported_at,
    };
  }

  return {
    status: 'verified_aging',
    label: STATUS_LABEL.verified_aging,
    verifiedDate: verifiedDateRaw,
    enrichedDate: enrichment?.enrichment_imported_at,
  };
};
