import type { CoverageArea } from '@/data/nevada-counties';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import type { TribalNation } from '@/data/tribal-nations';

export type MapEntity =
  | { type: 'coverageArea'; area: CoverageArea }
  | { type: 'county'; county: string }
  | { type: 'facility'; facility: Facility }
  | { type: 'coverageGap'; radiusKm: number }
  | { type: 'memberVolume'; county: string; memberCount: number }
  | { type: 'ruralServiceGroup'; county: string; services: RuralService[] }
  | { type: 'ruralService'; service: RuralService }
  | { type: 'fteDetail'; fteId: string }
  | { type: 'tribalNation'; tribe: TribalNation };
