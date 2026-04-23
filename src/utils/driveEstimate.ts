/**
 * Drive distance + time estimate for the Field Response hover card.
 *
 * Display-only. Reuses the SAME nearest field FTE that classification and
 * remote-pin placement already pick — does NOT recompute classification, and
 * does NOT alter active/planned/remote categorization.
 *
 * Distance model:
 *   - Haversine miles between FTE hub and county centroid
 *   - Multiplied by ROAD_FACTOR (1.3) to approximate road distance
 *   - Time = miles / AVG_RURAL_SPEED_MPH (60), in minutes
 *
 * Suppression:
 *   - Remote category with no viable corridor → no estimate (avoid bad data)
 */
import { fteCapacityData } from '@/data/fte-capacity';
import {
  hasViableScheduledCorridor,
  distanceMi,
} from '@/utils/scheduledCorridorViability';
import { nevadaHighwayCorridors, HIGHWAY_BUFFER_MI } from '@/data/highway-corridors';

const AVG_RURAL_SPEED_MPH = 60;
const ROAD_FACTOR = 1.3;

export type DriveCategory = 'active' | 'scheduled' | 'remote';

const ANCHOR_CORRIDOR_WHITELIST: Record<string, string[]> = {
  'Carson City FTE': ['I-80', 'US-50', 'US-395', 'US-95'],
  'Pahrump FTE': ['NV-160', 'US-95', 'I-15'],
};

const minDistToCorridorPathMi = (lat: number, lng: number, path: [number, number][]): number => {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLat, aLng] = path[i];
    const [bLat, bLng] = path[i + 1];
    // approximate point-to-segment via two endpoints (cheap, dataset is sparse)
    const dA = distanceMi(lat, lng, aLat, aLng);
    const dB = distanceMi(lat, lng, bLat, bLng);
    const d = Math.min(dA, dB);
    if (d < best) best = d;
  }
  return best;
};

/** Return the corridor label shared by the anchor and county, if any. */
function findSharedCorridorLabel(
  fteLabel: string,
  fteLat: number, fteLng: number,
  countyLat: number, countyLng: number,
): string | null {
  const allowed = ANCHOR_CORRIDOR_WHITELIST[fteLabel];
  if (!allowed) return null;
  for (const corridor of nevadaHighwayCorridors) {
    if (!allowed.includes(corridor.id)) continue;
    if (minDistToCorridorPathMi(fteLat, fteLng, corridor.path) > HIGHWAY_BUFFER_MI) continue;
    if (minDistToCorridorPathMi(countyLat, countyLng, corridor.path) <= 25) {
      return corridor.label;
    }
  }
  return null;
}

function pickNearestFieldFte(countyLat: number, countyLng: number) {
  const fieldFtes = fteCapacityData.filter(f => f.hubLocation);
  let nearest: typeof fieldFtes[number] | null = null;
  let nearestMi = Infinity;
  for (const f of fieldFtes) {
    const d = distanceMi(countyLat, countyLng, f.hubLocation!.lat, f.hubLocation!.lng);
    if (d < nearestMi) { nearestMi = d; nearest = f; }
  }
  return nearest ? { fte: nearest, straightMi: nearestMi } : null;
}

function formatMinutes(mins: number): string {
  const rounded = Math.max(5, Math.round(mins / 5) * 5);
  if (rounded < 120) return `${rounded} min`;
  const hr = Math.floor(rounded / 60);
  const rem = rounded - hr * 60;
  return rem === 0 ? `${hr} hr` : `${hr} hr ${rem} min`;
}

export interface DriveEstimateResult {
  /** Single line for the hover card, e.g. "~72 mi · ~75 min drive (via US-50)". */
  line: string;
  miles: number;
  minutes: number;
  fteLabel: string;
  corridorLabel?: string;
}

/**
 * Compute a drive estimate for the county's classification.
 * Returns `null` when no useful estimate should be shown (remote w/o corridor,
 * or no field FTE available).
 */
export function getDriveEstimate(
  countyCenter: [number, number],
  category: DriveCategory,
): DriveEstimateResult | null {
  const picked = pickNearestFieldFte(countyCenter[0], countyCenter[1]);
  if (!picked) return null;

  const { fte, straightMi } = picked;
  const corridorLabel = findSharedCorridorLabel(
    fte.label,
    fte.hubLocation!.lat, fte.hubLocation!.lng,
    countyCenter[0], countyCenter[1],
  );

  // Suppress for remote with no viable corridor — bad data is worse than none.
  if (category === 'remote' && !corridorLabel) return null;

  const miles = Math.round(straightMi * ROAD_FACTOR);
  const minutes = (miles / AVG_RURAL_SPEED_MPH) * 60;
  const timeStr = formatMinutes(minutes);

  let line: string;
  if (category === 'active') {
    line = `~${miles} mi · ~${timeStr} drive`;
  } else if (category === 'scheduled') {
    line = corridorLabel
      ? `~${miles} mi · ~${timeStr} drive (via ${corridorLabel} corridor)`
      : `~${miles} mi · ~${timeStr} drive`;
  } else {
    // remote with corridor — show as long-haul context
    line = `~${miles} mi · ~${timeStr} drive (via ${corridorLabel})`;
  }

  return {
    line,
    miles,
    minutes: Math.round(minutes),
    fteLabel: fte.label,
    corridorLabel: corridorLabel ?? undefined,
  };
}
