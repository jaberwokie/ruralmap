/**
 * Backup Options: 2–3 nearest practical alternatives to the currently
 * selected provider. BH-aware: if the current provider offers behavioral
 * health, prefer alternatives that also offer BH.
 *
 * Strictly read-only utility. Does not change map state, filters, or scoring.
 */

import type { Facility } from '@/data/facilities';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';

export interface BackupOption {
  facility: Facility;
  distanceMi: number;
  source: 'member' | 'provider';
  isBH: boolean;
  tierLabel: 'Local Access' | 'Managed Access' | 'High Friction' | 'Non-Viable';
}

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tierOf = (mi: number): BackupOption['tierLabel'] => {
  if (mi <= 10) return 'Local Access';
  if (mi <= 25) return 'Managed Access';
  if (mi <= 40) return 'High Friction';
  return 'Non-Viable';
};

export const findBackupOptions = (
  current: Facility,
  allFacilities: Facility[],
  memberLocation: { lat: number; lng: number } | null,
  limit = 3,
): BackupOption[] => {
  const currentIsBH = facilityOffersBehavioralHealth(current);
  const sameType = allFacilities.filter(
    (f) => f.id !== current.id && f.type === current.type && Number.isFinite(f.lat) && Number.isFinite(f.lng),
  );

  const origin = memberLocation ?? { lat: current.lat, lng: current.lng };
  const source: BackupOption['source'] = memberLocation ? 'member' : 'provider';

  const scored: BackupOption[] = sameType.map((f) => {
    const mi = haversineMi(origin.lat, origin.lng, f.lat, f.lng);
    return {
      facility: f,
      distanceMi: Math.round(mi * 10) / 10,
      source,
      isBH: facilityOffersBehavioralHealth(f),
      tierLabel: tierOf(mi),
    };
  });

  // BH-aware ordering: if the current provider offers BH, BH alternatives float first.
  scored.sort((a, b) => {
    if (currentIsBH && a.isBH !== b.isBH) return a.isBH ? -1 : 1;
    return a.distanceMi - b.distanceMi;
  });

  return scored.slice(0, limit);
};
