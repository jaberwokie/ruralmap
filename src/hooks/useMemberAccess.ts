import { useState, useCallback, useMemo } from 'react';
import type { Facility } from '@/data/facilities';
import { defaultFacilities } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { enrichedRuralServices } from '@/data/enriched-rural-services';
import { useRuralServiceData } from '@/hooks/useRuralServiceData';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { getCountyForLocation } from '@/utils/countyLookup';
import { logEvent } from '@/lib/metrics/logEvent';

export interface MemberLocation {
  lat: number;
  lng: number;
  address?: string;
  /** True when only an approximate (city/ZIP centroid) match was resolved
   *  for an address that originally contained a street component. */
  isApproximate?: boolean;
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

const NV_HIGHWAY_ALIASES: Record<string, string> = {
  'schurz hwy': 'US-95',
  'schurz highway': 'US-95',
  'pyramid hwy': 'US-445',
  'pyramid highway': 'US-445',
  'winnemucca ranch rd': 'NV-796',
  'battle mountain hwy': 'NV-305',
};

const KNOWN_PROVIDER_COORDINATES: Array<{
  addressTokens: string[];
  lat: number;
  lng: number;
  label: string;
}> = [
  {
    addressTokens: ['1685', 'schurz', 'fallon', '89406'],
    lat: 39.4600,
    lng: -118.7800,
    label: '1685 Schurz Hwy, Fallon, NV 89406',
  },
  {
    addressTokens: ['mine', 'round', 'mountain'],
    lat: 38.6943,
    lng: -117.1614,
    label: '1 Mine Rd, Round Mountain, NV (matched from provider records)',
  },
];

export const useMemberAccess = (facilities: Facility[]): UseMemberAccessReturn => {
  const [memberLocation, setMemberLocation] = useState<MemberLocation | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [manualPlacementMode, setManualPlacementMode] = useState(false);

  const { ruralServices: allServices } = useRuralServiceData();

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
    // PII-safe: log address_searched with county-only resolution. No raw
    // address, no coordinates tied to a user session.
    const county = getCountyForLocation(loc.lat, loc.lng);
    logEvent('address_searched', { county: county ?? 'unknown' });
  }, []);

  const clearMember = useCallback(() => {
    setMemberLocation(null);
    setGeocodeError(null);
    setManualPlacementMode(false);
  }, []);

  const geocodeAddress = useCallback(async (address: string) => {
    setIsGeocoding(true);
    setGeocodeError(null);
    setMemberLocation(null);
    try {
      // Normalize input — strip suite/unit tokens before geocoding
      const normalized = address
        .replace(/\b(suite|ste\.?|unit|apt\.?|apartment|bldg\.?|building|room|rm\.?|#)\s*[\w-]*/gi, '')
        .replace(/\s+,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const query = normalized.includes('Nevada') || /,\s*NV\b/i.test(normalized)
        ? normalized
        : `${normalized}, Nevada`;

      // Nevada bounding box
      const NV_WEST = -120.0064, NV_EAST = -114.0396, NV_SOUTH = 35.0019, NV_NORTH = 42.0022;

      const isInNevada = (lat: number, lng: number) =>
        lat >= NV_SOUTH && lat <= NV_NORTH && lng >= NV_WEST && lng <= NV_EAST;

      // --- Retry variant chain (conservative, in order) ---
      // 1. original  2. abbreviation-expanded  3. street+city+state+ZIP
      // 4. city+state+ZIP  5. ZIP-only
      const expandAbbrev = (s: string) => s
        .replace(/\bRd\.?\b/gi, 'Road')
        .replace(/\bSt\.?\b/gi, 'Street')
        .replace(/\bAve\.?\b/gi, 'Avenue')
        .replace(/\bHwy\.?\b/gi, 'Highway')
        .replace(/\bBlvd\.?\b/gi, 'Boulevard')
        .replace(/\bDr\.?\b/gi, 'Drive')
        .replace(/\bLn\.?\b/gi, 'Lane')
        .replace(/\bCt\.?\b/gi, 'Court')
        .replace(/\bPkwy\.?\b/gi, 'Parkway');

      const parseAddressParts = (s: string): { street: string | null; city: string | null; zip: string | null } => {
        const zipMatch = s.match(/\b(\d{5})\b/);
        const zip = zipMatch?.[1] ?? null;
        const m1 = s.match(/^(.+?),\s*([^,]+?),\s*(?:NV|Nevada)\b/i);
        if (m1) return { street: m1[1].trim(), city: m1[2].trim(), zip };
        const m2 = s.match(/^([^,]+?),\s*(?:NV|Nevada)\b/i);
        if (m2) return { street: null, city: m2[1].trim(), zip };
        return { street: null, city: null, zip };
      };

      const parts = parseAddressParts(query);
      const originalHadStreet = !!parts.street && /\d/.test(parts.street);

      type VariantLevel = 'street' | 'city' | 'zip';
      const variants: { q: string; level: VariantLevel }[] = [];
      const pushUnique = (q: string, level: VariantLevel) => {
        if (!q.trim()) return;
        if (!variants.some(v => v.q.toLowerCase() === q.toLowerCase())) {
          variants.push({ q, level });
        }
      };

      const baseLevel: VariantLevel = parts.street ? 'street' : parts.city ? 'city' : 'zip';
      pushUnique(query, baseLevel);
      const expanded = expandAbbrev(query);
      if (expanded !== query) pushUnique(expanded, baseLevel);
      if (parts.street && parts.city && parts.zip) {
        pushUnique(`${expandAbbrev(parts.street)}, ${parts.city}, NV ${parts.zip}`, 'street');
      }
      if (parts.city && parts.zip) {
        pushUnique(`${parts.city}, NV ${parts.zip}`, 'city');
      } else if (parts.city) {
        pushUnique(`${parts.city}, NV`, 'city');
      }
      if (parts.zip) {
        pushUnique(`${parts.zip}, NV`, 'zip');
      }

      const tryNominatim = async (q: string, bounded: boolean) => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=us&viewbox=${NV_WEST},${NV_NORTH},${NV_EAST},${NV_SOUTH}${bounded ? '&bounded=1' : ''}`;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();
          const hit = data.find((r: { lat: string; lon: string }) => {
            const lat = parseFloat(r.lat);
            const lng = parseFloat(r.lon);
            return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
          });
          return hit ?? null;
        } catch {
          return null;
        }
      };

      for (const variant of variants) {
        // Try bounded first, then unbounded (still NV-validated) for rural fallback.
        const hit = (await tryNominatim(variant.q, true)) ?? (await tryNominatim(variant.q, false));
        if (hit) {
          const isApproximate = originalHadStreet && variant.level !== 'street';
          placeMember({
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
            address: hit.display_name,
            isApproximate,
          });
          return;
        }
      }


      // Stage 2 — Census Geocoder fallback (via Supabase Edge Function proxy to avoid CORS)
      try {
        const censusProxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/census-geocode`;
        const censusRes = await fetch(censusProxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: query }),
          signal: AbortSignal.timeout(8000),
        });
        if (censusRes.ok) {
          const censusData = await censusRes.json();
          const match = censusData?.result?.addressMatches?.[0];
          if (match) {
            const lat = match.coordinates?.y;
            const lng = match.coordinates?.x;
            if (Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng)) {
              placeMember({ lat, lng, address: match.matchedAddress });
              return;
            }
          }
        }
      } catch {
        // Census proxy unavailable — continue to Stage 3
      }

      // Stage 3 — Nominatim retry without strict bounding (highway/rural fallback)
      const nominatimUnboundedUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=us&viewbox=${NV_WEST},${NV_NORTH},${NV_EAST},${NV_SOUTH}`;
      const nominatimUnboundedRes = await fetch(nominatimUnboundedUrl);
      if (nominatimUnboundedRes.ok) {
        const nominatimUnboundedData = await nominatimUnboundedRes.json();
        const hit = nominatimUnboundedData.find((r: { lat: string; lon: string }) => {
          const lat = parseFloat(r.lat);
          const lng = parseFloat(r.lon);
          return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
        });
        if (hit) {
          placeMember({ lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), address: hit.display_name });
          return;
        }
      }

      // Stage 4 — Highway local-name alias retry
      const lowerQuery = normalized.toLowerCase();
      const aliasEntry = Object.entries(NV_HIGHWAY_ALIASES).find(([alias]) =>
        lowerQuery.includes(alias)
      );
      if (aliasEntry) {
        const [alias, canonical] = aliasEntry;
        const aliasQuery = normalized.replace(new RegExp(alias, 'gi'), canonical);
        const aliasUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(aliasQuery + ', Nevada')}&format=json&limit=5&countrycodes=us&viewbox=${NV_WEST},${NV_NORTH},${NV_EAST},${NV_SOUTH}`;
        const aliasRes = await fetch(aliasUrl);
        if (aliasRes.ok) {
          const aliasData = await aliasRes.json();
          const hit = aliasData.find((r: { lat: string; lon: string }) => {
            const lat = parseFloat(r.lat);
            const lng = parseFloat(r.lon);
            return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
          });
          if (hit) {
            placeMember({ lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), address: hit.display_name });
            return;
          }
        }

        // Stage 4b — alias without house number (highway milepost addresses)
        const noNumberQuery = aliasQuery.replace(/^\d+\s+/, '');
        if (noNumberQuery !== aliasQuery) {
          const noNumUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(noNumberQuery + ', Nevada')}&format=json&limit=5&countrycodes=us&viewbox=${NV_WEST},${NV_NORTH},${NV_EAST},${NV_SOUTH}`;
          const noNumRes = await fetch(noNumUrl);
          if (noNumRes.ok) {
            const noNumData = await noNumRes.json();
            const hit = noNumData.find((r: { lat: string; lon: string }) => {
              const lat = parseFloat(r.lat);
              const lng = parseFloat(r.lon);
              return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
            });
            if (hit) {
              placeMember({ lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), address: hit.display_name });
              return;
            }
          }
        }
      }

      // Stage 5 — Known provider address lookup
      const inputNormalized = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

      const tokenMatch = (addrString: string) => {
        const addrNorm = addrString.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const inputTokens = inputNormalized.split(/\s+/);
        const addrTokens = new Set(addrNorm.split(/\s+/));
        const matchCount = inputTokens.filter(t => t.length > 2 && addrTokens.has(t)).length;
        return matchCount >= 3;
      };

      const facilityMatch = defaultFacilities.find(f =>
        f.lat && f.lng && f.address &&
        tokenMatch(`${f.address} ${f.city} ${f.county}`)
      );

      if (facilityMatch) {
        placeMember({
          lat: facilityMatch.lat,
          lng: facilityMatch.lng,
          address: `${facilityMatch.address}, ${facilityMatch.city}, NV (matched from provider records)`,
        });
        return;
      }

      const serviceMatch = enrichedRuralServices.find(s =>
        s.lat && s.lng && s.address &&
        tokenMatch(`${s.address} ${s.city ?? ''} ${s.county ?? ''}`)
      );

      if (serviceMatch) {
        placeMember({
          lat: serviceMatch.lat,
          lng: serviceMatch.lng,
          address: `${serviceMatch.address}, ${serviceMatch.city ?? 'NV'}, NV (matched from provider records)`,
        });
        return;
      }

      // Stage 5b — Hardcoded known unresolvable provider coordinates
      const inputTokensLower = inputNormalized.split(/\s+/);
      
      const knownMatch = KNOWN_PROVIDER_COORDINATES.find(entry =>
        entry.addressTokens.every(token => inputTokensLower.includes(token))
      );
      if (knownMatch) {
        placeMember({ lat: knownMatch.lat, lng: knownMatch.lng, address: knownMatch.label });
        return;
      }

      // All stages failed
      const isHighwayAddress =
        Object.keys(NV_HIGHWAY_ALIASES).some(alias => normalized.toLowerCase().includes(alias)) ||
        /\b(hwy|highway|us-\d+|nv-\d+|sr-\d+|route\s+\d+)\b/i.test(normalized);

      setGeocodeError(
        isHighwayAddress
          ? 'Highway address could not be precisely located. Use the map to place the member location manually — click the approximate location along the highway.'
          : 'Address not found. Refine the address or click the map to place member location.'
      );
      setManualPlacementMode(true);
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
