/**
 * No-Local-Transit Counties — additive contextual flag.
 *
 * STRICTLY ADDITIVE. These are NOT facilities, providers, services,
 * verification entities, scoring inputs, or queue inputs. They are a
 * presentation hint used to surface "no local transit identified" messaging
 * when relevant to access context.
 *
 * Source of truth: Nevada Department of Transportation (NDOT) Public Transit
 * page — counties listed as having no local transit provider.
 *
 * Do NOT create transit zones for these counties. Do NOT use this list for
 * scoring, queue, or verification logic.
 */

export interface NoTransitCountyEntry {
  county: string;
  noLocalTransitIdentified: true;
  source: 'NDOT';
}

export const NO_TRANSIT_COUNTIES: NoTransitCountyEntry[] = [
  { county: 'Esmeralda', noLocalTransitIdentified: true, source: 'NDOT' },
  { county: 'Eureka', noLocalTransitIdentified: true, source: 'NDOT' },
  { county: 'Lander', noLocalTransitIdentified: true, source: 'NDOT' },
  { county: 'Mineral', noLocalTransitIdentified: true, source: 'NDOT' },
  { county: 'Storey', noLocalTransitIdentified: true, source: 'NDOT' },
];

const NO_TRANSIT_SET = new Set(NO_TRANSIT_COUNTIES.map((c) => c.county.toLowerCase()));

export function hasNoLocalTransit(county: string | undefined | null): boolean {
  if (!county) return false;
  return NO_TRANSIT_SET.has(county.toLowerCase());
}

if (import.meta.env.DEV) {
  console.info('[LocalTransit] no-transit counties (NDOT)', {
    count: NO_TRANSIT_COUNTIES.length,
    counties: NO_TRANSIT_COUNTIES.map((c) => c.county),
  });
}
