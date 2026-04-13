import { useState, useCallback, useMemo } from 'react';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { enrichedRuralServices } from '@/data/enriched-rural-services';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';

export interface MemberLocation {
  lat: number;
  lng: number;
  address?: string;
}

export type AccessTierKey = 'local' | 'managed' | 'highFriction' | 'nonViable';

export interface AccessTierResult {
  key: AccessTierKey;
  label: string;
  rangeLabel: string;
  facilities: (Facility & { distanceMi: number })[];
  services: (RuralService & { distanceMi: number })[];
}

export interface MemberAccessAnalysis {
  location: MemberLocation;
  tiers: AccessTierResult[];
  recommendation: string;
}

const TIER_DEFS: { key: AccessTierKey; label: string; rangeLabel: string; minMi: number; maxMi: number }[] = [
  { key: 'local', label: 'Local Access', rangeLabel: '0–10 mi', minMi: 0, maxMi: 10 },
  { key: 'managed', label: 'Managed Access', rangeLabel: '10–25 mi', minMi: 10, maxMi: 25 },
  { key: 'highFriction', label: 'High Friction', rangeLabel: '25–40 mi', minMi: 25, maxMi: 40 },
  { key: 'nonViable', label: 'Non-Viable', rangeLabel: '40+ mi', minMi: 40, maxMi: Infinity },
];

// Inclusive upper-bound assignment: 10.0 → local, 10.01 → managed, etc.
const assignTier = (distanceMi: number): AccessTierKey => {
  if (distanceMi <= 10) return 'local';
  if (distanceMi <= 25) return 'managed';
  if (distanceMi <= 40) return 'highFriction';
  return 'nonViable';
};
];

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function getRecommendation(tiers: AccessTierResult[]): string {
  const local = tiers.find(t => t.key === 'local');
  const managed = tiers.find(t => t.key === 'managed');
  if (local && (local.facilities.length > 0 || local.services.length > 0)) {
    return 'Local in-person engagement viable';
  }
  if (managed && (managed.facilities.length > 0 || managed.services.length > 0)) {
    return 'Coordinated access required (transport needed)';
  }
  return 'Remote engagement recommended';
}

export interface UseMemberAccessReturn {
  memberLocation: MemberLocation | null;
  analysis: MemberAccessAnalysis | null;
  placeMember: (loc: MemberLocation) => void;
  clearMember: () => void;
  isGeocoding: boolean;
  geocodeError: string | null;
  geocodeAddress: (address: string) => Promise<void>;
  manualPlacementMode: boolean;
  setManualPlacementMode: (v: boolean) => void;
}

export const useMemberAccess = (facilities: Facility[]): UseMemberAccessReturn => {
  const [memberLocation, setMemberLocation] = useState<MemberLocation | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [manualPlacementMode, setManualPlacementMode] = useState(false);

  const allServices = enrichedRuralServices;

  const analysis = useMemo<MemberAccessAnalysis | null>(() => {
    if (!memberLocation) return null;
    const { lat, lng } = memberLocation;

    const facWithDist = facilities
      .filter(f => f.lat && f.lng && !isNaN(f.lat) && !isNaN(f.lng))
      .map(f => ({ ...f, distanceMi: haversineMi(lat, lng, f.lat, f.lng) }))
      .sort((a, b) => a.distanceMi - b.distanceMi);

    const svcWithDist = allServices
      .filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng))
      .map(s => ({ ...s, distanceMi: haversineMi(lat, lng, s.lat, s.lng) }))
      .sort((a, b) => a.distanceMi - b.distanceMi);

    const tiers: AccessTierResult[] = TIER_DEFS.map(def => ({
      key: def.key,
      label: def.label,
      rangeLabel: def.rangeLabel,
      facilities: facWithDist.filter(f => assignTier(f.distanceMi) === def.key),
      services: svcWithDist.filter(s => assignTier(s.distanceMi) === def.key),
    }));

    return {
      location: memberLocation,
      tiers,
      recommendation: getRecommendation(tiers),
    };
  }, [memberLocation, facilities, allServices]);

  const placeMember = useCallback((loc: MemberLocation) => {
    setMemberLocation(loc);
    setGeocodeError(null);
    setManualPlacementMode(false);
  }, []);

  const clearMember = useCallback(() => {
    setMemberLocation(null);
    setGeocodeError(null);
    setManualPlacementMode(false);
  }, []);

  const geocodeAddress = useCallback(async (address: string) => {
    setIsGeocoding(true);
    setGeocodeError(null);
    try {
      const q = encodeURIComponent(address + ', Nevada');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`);
      const data = await res.json();
      if (data.length === 0) {
        setGeocodeError('Address not found. Refine the address or click the map to place member location.');
        setManualPlacementMode(true);
        return;
      }
      const { lat, lon, display_name } = data[0];
      placeMember({ lat: parseFloat(lat), lng: parseFloat(lon), address: display_name });
    } catch {
      setGeocodeError('Address not found. Refine the address or click the map to place member location.');
      setManualPlacementMode(true);
    } finally {
      setIsGeocoding(false);
    }
  }, [placeMember]);

  return {
    memberLocation,
    analysis,
    placeMember,
    clearMember,
    isGeocoding,
    geocodeError,
    geocodeAddress,
    manualPlacementMode,
    setManualPlacementMode,
  };
};
