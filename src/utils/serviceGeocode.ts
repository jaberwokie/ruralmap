/**
 * Resource geocoding — CLIENT CONTRACT ONLY (Phase 2D).
 *
 * All provider/network behavior has been removed from the browser. This module
 * no longer contacts Nominatim, the Census geocoder, Google, or any other
 * external service. Resource addresses are resolved exclusively by the
 * authenticated `geocode-bulk` / `geocode-address` Edge Functions, which use
 * the internal `resource_address` authority and the U.S. Census Geocoder as the
 * single approved external provider.
 *
 * What remains here:
 *  - status / summary types shared by the Admin mapping UI
 *  - `summarizeGeocodeRun` for normalizing server results
 *  - re-exported `[geocode:...]` tag helpers (see `@/utils/geocodeTags`)
 *
 * Retired (do not reintroduce in the browser):
 *  - fetchNominatim / reverseGeocode / spotCheckCoordinate
 *  - fetchCensusGeocode (browser proxy)
 *  - geocodeOne / geocodeMany provider loops
 */
import type { StagingServiceRow, VerifiedServiceRow } from '@/types/mappingPipeline';

export {
  GEOCODE_TAG_PREFIX,
  stampGeocodeTag,
  stripGeocodeTag,
  parseGeocodeTag,
  isGeocodeFailed,
} from '@/utils/geocodeTags';
export type { GeocodeStrategy, GeocodeConfidence } from '@/utils/geocodeTags';

import type { GeocodeStrategy, GeocodeConfidence } from '@/utils/geocodeTags';

export interface GeocodeOutcome {
  id: string;
  status: 'geocoded' | 'failed' | 'skipped';
  strategy?: GeocodeStrategy;
  confidence?: GeocodeConfidence;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

export interface GeocodeRunSummary {
  total: number;
  geocoded: number;
  failed: number;
  skipped: number;
  highConf: number;
  mediumConf: number;
  lowConf: number;
  outcomes: GeocodeOutcome[];
}

export type GeocodeCandidate = Pick<
  StagingServiceRow & VerifiedServiceRow,
  'id' | 'mappable' | 'latitude' | 'longitude' | 'street_address' | 'city' | 'state' | 'zip' | 'county' | 'access_notes'
>;

export const summarizeGeocodeRun = (outcomes: GeocodeOutcome[]): GeocodeRunSummary => {
  let geocoded = 0, failed = 0, skipped = 0, high = 0, med = 0, low = 0;
  for (const o of outcomes) {
    if (o.status === 'geocoded') {
      geocoded += 1;
      if (o.confidence === 'high') high += 1;
      else if (o.confidence === 'medium') med += 1;
      else if (o.confidence === 'low') low += 1;
    } else if (o.status === 'failed') failed += 1;
    else skipped += 1;
  }
  return {
    total: outcomes.length,
    geocoded,
    failed,
    skipped,
    highConf: high,
    mediumConf: med,
    lowConf: low,
    outcomes,
  };
};

export const emptyGeocodeRunSummary = (): GeocodeRunSummary => summarizeGeocodeRun([]);
