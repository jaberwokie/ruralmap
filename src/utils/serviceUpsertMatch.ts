/**
 * Controlled upsert matching for the Nye ingestion pipeline (v5).
 *
 * Given an incoming partial staging row + the existing staging+verified
 * service universe, returns a match decision:
 *   - `new`     → insert as a new row
 *   - `merge`   → exactly one existing match; controlled append into it
 *   - `conflict`→ multiple plausible matches; insert as new with
 *                 `match_conflict = true`
 *
 * Match precedence:
 *   1. name + city + county
 *   2. name + phone
 *   3. name + address
 *
 * All matching is performed against normalized comparison keys; raw fields
 * on candidates are never mutated by this helper.
 */

import type { StagingServiceRow, VerifiedServiceRow } from '@/types/mappingPipeline';
import {
  normalizeName, normalizePhone, normalizeAddress,
} from './serviceNormalize';

export type UpsertCandidate = StagingServiceRow | VerifiedServiceRow;

export type MatchDecision =
  | { kind: 'new' }
  | { kind: 'merge'; candidate: UpsertCandidate; tier: 1 | 2 | 3 }
  | { kind: 'conflict'; candidates: UpsertCandidate[]; tier: 1 | 2 | 3 };

interface CompareKey {
  name: string;
  city: string;
  county: string;
  phone: string;
  address: string;
}

const buildKey = (r: Partial<StagingServiceRow>): CompareKey => ({
  name: normalizeName(r.name),
  city: (r.city ?? '').toLowerCase().trim(),
  county: (r.county ?? '').toLowerCase().trim(),
  phone: normalizePhone(r.phone),
  address: normalizeAddress(r.street_address),
});

const matchesAt = (
  incoming: CompareKey,
  candidate: CompareKey,
  tier: 1 | 2 | 3,
): boolean => {
  if (!incoming.name || !candidate.name || incoming.name !== candidate.name) return false;
  if (tier === 1) {
    return !!incoming.city && !!incoming.county
      && incoming.city === candidate.city
      && incoming.county === candidate.county;
  }
  if (tier === 2) {
    return !!incoming.phone && incoming.phone === candidate.phone;
  }
  // tier 3
  return !!incoming.address && incoming.address === candidate.address;
};

export const decideUpsert = (
  incoming: Partial<StagingServiceRow>,
  universe: UpsertCandidate[],
): MatchDecision => {
  const inKey = buildKey(incoming);
  if (!inKey.name) return { kind: 'new' };

  const candidateKeys = universe.map((c) => ({ row: c, key: buildKey(c) }));

  for (const tier of [1, 2, 3] as const) {
    const hits = candidateKeys.filter(({ key }) => matchesAt(inKey, key, tier));
    if (hits.length === 0) continue;
    if (hits.length === 1) {
      return { kind: 'merge', candidate: hits[0].row, tier };
    }
    return { kind: 'conflict', candidates: hits.map((h) => h.row), tier };
  }

  return { kind: 'new' };
};
