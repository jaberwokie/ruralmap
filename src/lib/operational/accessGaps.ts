/**
 * Access gaps — county-level "no hospital/clinic within ~50 km of center" set.
 * Extracted as-is from the GAP_COUNTIES IIFE in CoverageDetailPanel.
 * Same 7 county centers, same 50 km threshold, same haversine math.
 */
import { defaultFacilities } from '@/data/facilities';
import { ACCESS_GAP_RADIUS_KM } from './constants';
import { haversineKm } from './memberAccess';

const COUNTY_CENTERS: Record<string, [number, number]> = {
  Esmeralda: [37.78, -117.63],
  Mineral: [38.54, -118.43],
  Lincoln: [37.64, -114.87],
  Eureka: [39.98, -116.00],
  Storey: [39.44, -119.53],
  Pershing: [40.56, -118.40],
  Lander: [40.07, -117.04],
};

export const GAP_COUNTIES: ReadonlySet<string> = (() => {
  const coverageFacilities = defaultFacilities.filter(f => f.type === 'hospital' || f.type === 'clinic');
  const gaps = new Set<string>();
  for (const [name, [lat, lng]] of Object.entries(COUNTY_CENTERS)) {
    const nearest = Math.min(...coverageFacilities.map(f => haversineKm(lat, lng, f.lat, f.lng)));
    if (nearest > ACCESS_GAP_RADIUS_KM) gaps.add(name);
  }
  return gaps;
})();

export const isAccessGapCounty = (county: string): boolean => GAP_COUNTIES.has(county);
