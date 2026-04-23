/**
 * Remote Support Pin Placement
 *
 * For counties classified as `remote` (no in-county field response),
 * the Remote Support marker should NOT sit on the county centroid —
 * that misrepresents where support originates. Instead, anchor it
 * just outside the nearest active field FTE's coverage radius, in the
 * bearing direction of the target county centroid.
 *
 * This visually communicates: "support is coming from here, not from
 * inside the county." Edge counties (e.g. Humboldt) will land in the
 * neighboring county where the supporting hub actually operates
 * (e.g. Washoe, just above Carson FTE coverage). That is intentional.
 *
 * Pure geometry helper — does NOT touch FTE placement, coverage radius
 * math, county classification, or strain logic.
 */
import { fteCapacityData } from '@/data/fte-capacity';

const EARTH_RADIUS_KM = 6371;

/** Buffer outside the coverage radius so the pin reads as "just outside". */
const REMOTE_PIN_OFFSET_KM = 12; // ~7.5 miles

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Initial bearing (radians) from point a to point b, both [lat, lng]. */
function bearingRad(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

/** Project from origin by distance (km) along bearing (radians). */
function projectPoint(
  origin: [number, number],
  distanceKm: number,
  bearing: number,
): [number, number] {
  const [lat, lon] = origin;
  const δ = distanceKm / EARTH_RADIUS_KM;
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [toDeg(φ2), toDeg(λ2)];
}

/**
 * Compute the marker location for a Remote Support county.
 *
 * @param countyCenter   County centroid as [lat, lng]
 * @param coverageRadiusKm Active field-coverage radius (same value used by the radius layer)
 * @returns A point just outside the nearest field FTE's coverage radius,
 *          aimed at the target county. Falls back to the centroid if no
 *          field FTE is available (defensive — should not happen).
 */
export function getRemoteSupportMarkerLatLng(
  countyCenter: [number, number],
  coverageRadiusKm: number,
): [number, number] {
  const fieldFtes = fteCapacityData.filter(
    (f) => f.deployment === 'field' && f.hubLocation,
  );
  if (fieldFtes.length === 0) return countyCenter;

  let nearest = fieldFtes[0];
  let nearestDistance = Infinity;
  fieldFtes.forEach((f) => {
    const hub: [number, number] = [f.hubLocation!.lat, f.hubLocation!.lng];
    const d = haversineKm(hub, countyCenter);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = f;
    }
  });

  const hub: [number, number] = [
    nearest.hubLocation!.lat,
    nearest.hubLocation!.lng,
  ];
  const bearing = bearingRad(hub, countyCenter);
  const offsetKm = coverageRadiusKm + REMOTE_PIN_OFFSET_KM;

  // Don't overshoot the centroid — if the county is actually closer than
  // (radius + buffer), just place at the centroid.
  if (nearestDistance <= offsetKm) return countyCenter;

  return projectPoint(hub, offsetKm, bearing);
}
