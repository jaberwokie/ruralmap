/**
 * Vitest-side re-export of the Phase 2B geocode resolver internals.
 *
 * The implementation lives under `supabase/functions/` (Deno). This shim keeps
 * a single source of truth for normalization, keying, and resolution order
 * while letting the browser-side test runner exercise it.
 */
export {
  canonicalizeAddress,
  computeLookupKey,
  isInNevada,
  resolveNevadaCounty,
  NEVADA_COUNTY_FIPS,
  NV_BOUNDS,
  type CanonicalAddress,
  type GeocodeFailureCode,
  type GeocodeSource,
  type LocationClass,
} from '../../../supabase/functions/_shared/geocodeNormalize.ts';

export {
  resolveAddress,
  type CachedResolution,
  type ExternalHit,
  type GeocoderPort,
  type ResolverPorts,
  type ResolveResult,
} from '../../../supabase/functions/resolve-address/resolver.ts';
