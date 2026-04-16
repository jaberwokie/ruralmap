/**
 * Local Transit Providers — additive sidebar utility list.
 *
 * STRICTLY ADDITIVE. These are NOT facilities, providers (NPI), services,
 * verification entities, scoring inputs, or queue inputs. They reference the
 * additive Local Transit Zones overlay so staff can quickly locate and review
 * an operator's local operating footprint.
 */

import { localTransitZones, type LocalTransitZone } from './local-transit-zones';

export type LocalTransitServiceType =
  | 'fixed_route'
  | 'demand_response'
  | 'mixed'
  | 'fixed_route_and_paratransit';

export const LOCAL_TRANSIT_SERVICE_TYPE_LABELS: Record<LocalTransitServiceType, string> = {
  fixed_route: 'Fixed route',
  demand_response: 'Demand response',
  mixed: 'Mixed (fixed route + demand response)',
  fixed_route_and_paratransit: 'Fixed route + paratransit',
};

export interface LocalTransitProvider {
  id: string;
  name: string;
  type: 'local_transit_provider';
  /** IDs from `localTransitZones`. */
  zoneIds: string[];
  serviceType: LocalTransitServiceType;
  phone?: string;
  website?: string;
  /** Short operational note (one short sentence). */
  note: string;
  /** Optional fare / rider note. */
  fareNote?: string;
}

export const localTransitProviders: LocalTransitProvider[] = [
  {
    id: 'ltp-silver-rider',
    name: 'Silver Rider',
    type: 'local_transit_provider',
    zoneIds: [
      'ltz-silverrider-mesquite',
      'ltz-silverrider-boulder-city',
      'ltz-silverrider-pahrump',
    ],
    serviceType: 'mixed',
    phone: '702-228-4800',
    website: 'https://www.snvrtc.com/',
    note: 'Supports local access in select Southern Nevada communities.',
    fareNote: 'Low-cost local fares; reduced fares available for seniors and riders with disabilities.',
  },
  {
    id: 'ltp-jac',
    name: 'Jump Around Carson',
    type: 'local_transit_provider',
    zoneIds: ['ltz-jac-carson'],
    serviceType: 'fixed_route_and_paratransit',
    phone: '775-841-7433',
    website: 'https://www.carson.org/government/departments-g-z/transportation/jump-around-carson-jac',
    note: 'Supports local access within Carson City.',
    fareNote: 'Standard local bus fare; paratransit available with eligibility.',
  },
  {
    id: 'ltp-get-my-ride',
    name: 'GET My Ride',
    type: 'local_transit_provider',
    zoneIds: ['ltz-getmyride-elko'],
    serviceType: 'mixed',
    phone: '775-738-4647',
    website: 'https://www.elkocountynv.net/departments/get_my_ride/index.php',
    note: 'Supports local transportation within Elko and surrounding communities.',
    fareNote: 'Local fares; reduced fares available for seniors and riders with disabilities.',
  },
  {
    id: 'ltp-ely-bus',
    name: 'Ely Bus',
    type: 'local_transit_provider',
    zoneIds: ['ltz-elybus-ely'],
    serviceType: 'demand_response',
    phone: '775-289-2877',
    note: 'Demand-response service in and around Ely (White Pine County).',
  },
  {
    id: 'ltp-lincoln-county-transportation',
    name: 'Lincoln County Transportation',
    type: 'local_transit_provider',
    zoneIds: ['ltz-linctrans-corridor'],
    serviceType: 'demand_response',
    phone: '775-728-4477',
    note: 'Demand-response service across Pioche, Panaca, and Caliente.',
  },
  {
    id: 'ltp-cart',
    name: 'Churchill Area Regional Transportation (CART)',
    type: 'local_transit_provider',
    zoneIds: ['ltz-cart-fallon'],
    serviceType: 'mixed',
    phone: '775-423-4356',
    website: 'https://www.churchillcountynv.gov/192/CART-Bus',
    note: 'Fixed-route and demand-response service in Fallon and Churchill County.',
    fareNote: 'Low-cost local fares; reduced fares available for seniors and riders with disabilities.',
  },
];

if (import.meta.env.DEV) {
  const totalZoneRefs = localTransitProviders.reduce((sum, p) => sum + p.zoneIds.length, 0);
  console.info('[LocalTransit] providers loaded', {
    providers: localTransitProviders.length,
    zoneReferences: totalZoneRefs,
  });
}

/** Return the resolved zone records for a provider (filters out unknown ids). */
export function getProviderZones(provider: LocalTransitProvider): LocalTransitZone[] {
  const lookup = new Map(localTransitZones.map((z) => [z.id, z]));
  return provider.zoneIds.map((id) => lookup.get(id)).filter((z): z is LocalTransitZone => !!z);
}

/**
 * Combined bounding box across all of a provider's zone polygons.
 * Returns null if the provider has no resolvable zones.
 */
export function getProviderBounds(
  provider: LocalTransitProvider,
): [[number, number], [number, number]] | null {
  const zones = getProviderZones(provider);
  if (zones.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const z of zones) {
    for (const [lat, lng] of z.geometry) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  if (!isFinite(minLat) || !isFinite(minLng)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
