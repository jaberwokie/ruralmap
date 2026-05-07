/**
 * Data-quality helper for records whose display name includes a Nevada place
 * name while the location fields point somewhere else. This protects large
 * rural counties where county-level matching is too coarse.
 */

export interface NevadaPlaceNameMismatchInput {
  name?: string | null;
  city?: string | null;
  street_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface NevadaPlaceNameMismatch {
  namePlace: string;
  locationPlace: string;
  evidence: 'city' | 'address' | 'coordinates';
}

interface NevadaPlaceAnchor {
  name: string;
  aliases?: string[];
  lat: number;
  lng: number;
  radiusMi: number;
}

const NEVADA_PLACE_ANCHORS: NevadaPlaceAnchor[] = [
  { name: 'Tonopah', lat: 38.0692, lng: -117.2306, radiusMi: 12 },
  { name: 'Pahrump', lat: 36.2083, lng: -115.9839, radiusMi: 16 },
  { name: 'Las Vegas', lat: 36.1716, lng: -115.1391, radiusMi: 18 },
  { name: 'North Las Vegas', lat: 36.1989, lng: -115.1175, radiusMi: 10 },
  { name: 'Henderson', lat: 36.0395, lng: -114.9817, radiusMi: 12 },
  { name: 'Reno', lat: 39.5296, lng: -119.8138, radiusMi: 16 },
  { name: 'Sparks', lat: 39.5349, lng: -119.7527, radiusMi: 8 },
  { name: 'Carson City', lat: 39.1638, lng: -119.7674, radiusMi: 10 },
  { name: 'Elko', lat: 40.8324, lng: -115.7631, radiusMi: 12 },
  { name: 'Ely', lat: 39.2474, lng: -114.8886, radiusMi: 10 },
  { name: 'Fallon', lat: 39.4749, lng: -118.7770, radiusMi: 10 },
  { name: 'Fernley', lat: 39.6080, lng: -119.2518, radiusMi: 10 },
  { name: 'Winnemucca', lat: 40.9730, lng: -117.7357, radiusMi: 12 },
  { name: 'Lovelock', lat: 40.1794, lng: -118.4735, radiusMi: 8 },
  { name: 'Hawthorne', lat: 38.5246, lng: -118.6246, radiusMi: 8 },
  { name: 'Yerington', lat: 38.9858, lng: -119.1629, radiusMi: 8 },
  { name: 'Gardnerville', lat: 38.9413, lng: -119.7496, radiusMi: 8 },
  { name: 'Minden', lat: 38.9541, lng: -119.7657, radiusMi: 8 },
  { name: 'Mesquite', lat: 36.8055, lng: -114.0672, radiusMi: 10 },
  { name: 'Boulder City', lat: 35.9786, lng: -114.8325, radiusMi: 8 },
  { name: 'Laughlin', lat: 35.1678, lng: -114.5730, radiusMi: 8 },
  { name: 'Beatty', lat: 36.9086, lng: -116.7592, radiusMi: 8 },
  { name: 'Goldfield', lat: 37.7085, lng: -117.2356, radiusMi: 8 },
  { name: 'Silver Springs', lat: 39.4155, lng: -119.2246, radiusMi: 8 },
  { name: 'Dayton', lat: 39.2371, lng: -119.5929, radiusMi: 8 },
  { name: 'Eureka', lat: 39.5127, lng: -115.9606, radiusMi: 8 },
  { name: 'Austin', lat: 39.4938, lng: -117.0673, radiusMi: 8 },
  { name: 'Battle Mountain', lat: 40.6421, lng: -116.9343, radiusMi: 8 },
  { name: 'Wells', lat: 41.1116, lng: -114.9645, radiusMi: 8 },
  { name: 'West Wendover', aliases: ['Wendover'], lat: 40.7391, lng: -114.0733, radiusMi: 8 },
  { name: 'Pioche', lat: 37.9297, lng: -114.4513, radiusMi: 8 },
  { name: 'Caliente', lat: 37.6141, lng: -114.5119, radiusMi: 8 },
  { name: 'Panaca', lat: 37.7900, lng: -114.3891, radiusMi: 8 },
  { name: 'Overton', lat: 36.5430, lng: -114.4469, radiusMi: 8 },
  { name: 'Moapa', lat: 36.6758, lng: -114.6181, radiusMi: 8 },
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const textMentionsPlace = (text: string | null | undefined, place: NevadaPlaceAnchor): boolean => {
  if (!text) return false;
  const values = [place.name, ...(place.aliases ?? [])];
  return values.some((value) => new RegExp(`(^|\\W)${escapeRegExp(value)}($|\\W)`, 'i').test(text));
};

const placeFromText = (text: string | null | undefined): NevadaPlaceAnchor | null => {
  if (!text) return null;
  return NEVADA_PLACE_ANCHORS.find((place) => textMentionsPlace(text, place)) ?? null;
};

const placeFromCoordinates = (lat: number | null | undefined, lng: number | null | undefined): NevadaPlaceAnchor | null => {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  let nearest: { place: NevadaPlaceAnchor; distanceMi: number } | null = null;
  NEVADA_PLACE_ANCHORS.forEach((place) => {
    const distanceMi = haversineMi(lat, lng, place.lat, place.lng);
    if (distanceMi <= place.radiusMi && (!nearest || distanceMi < nearest.distanceMi)) {
      nearest = { place, distanceMi };
    }
  });
  return nearest?.place ?? null;
};

export const isNearNevadaPlace = (
  lat: unknown,
  lng: unknown,
  placeName: string,
): boolean => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  const place = NEVADA_PLACE_ANCHORS.find((candidate) => candidate.name.toLowerCase() === placeName.toLowerCase());
  if (!place) return false;
  return haversineMi(lat, lng, place.lat, place.lng) <= place.radiusMi;
};

export const detectNevadaPlaceNameMismatch = (
  input: NevadaPlaceNameMismatchInput,
): NevadaPlaceNameMismatch | null => {
  const namePlace = placeFromText(input.name);
  if (!namePlace) return null;

  const cityPlace = placeFromText(input.city);
  if (cityPlace && cityPlace.name !== namePlace.name) {
    return { namePlace: namePlace.name, locationPlace: cityPlace.name, evidence: 'city' };
  }

  const addressPlace = placeFromText(input.street_address);
  if (addressPlace && addressPlace.name !== namePlace.name) {
    return { namePlace: namePlace.name, locationPlace: addressPlace.name, evidence: 'address' };
  }

  const coordinatePlace = placeFromCoordinates(input.latitude, input.longitude);
  if (coordinatePlace && coordinatePlace.name !== namePlace.name) {
    return { namePlace: namePlace.name, locationPlace: coordinatePlace.name, evidence: 'coordinates' };
  }

  return null;
};