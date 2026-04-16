/**
 * Amtrak / passenger rail support data — northern Nevada California Zephyr corridor.
 *
 * STRICTLY ADDITIVE. This data is NOT a provider, service, verification entity,
 * scoring input, or queue input. It is a transport infrastructure overlay only.
 *
 * Coordinates are simplified waypoints tracking the real east-west route through
 * northern Nevada (CA border → Reno/Sparks → Winnemucca → Battle Mountain → Elko → UT border).
 */

export interface RailCorridor {
  id: string;
  name: string;
  active: boolean;
  frequencyNote: string;
  geometryType: 'polyline';
  /** Ordered waypoints [lat, lng] across northern Nevada */
  coordinates: [number, number][];
}

export interface RailStationSchedule {
  /** Direction of travel along the California Zephyr */
  direction: 'Eastbound' | 'Westbound';
  /** Destination headsign for operational context */
  headsign: string;
  /** Published timetable time at this station, local time */
  scheduledTime: string;
  /** Published timetable stop type */
  stopType: 'Departure' | 'Arrival';
}

export interface RailStation {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  active: boolean;
  /** Amtrak 3-letter station code for station page URL */
  stationCode?: string;
  /** Physical street address of the station/platform */
  address?: string;
  /** Route this station serves */
  routeName?: string;
  /** Published California Zephyr timetable entries at this station */
  schedule?: RailStationSchedule[];
}

export const RAIL_NEAR_STATION_MI = 10;
export const RAIL_NEAR_CORRIDOR_MI = 15;
export const RAIL_LONG_DISTANCE_MIN_MI = 120;
/** Northern Nevada relevance band — rail context only surfaces above this latitude. */
export const RAIL_NORTHERN_LAT_MIN = 39.3;

export const railCorridors: RailCorridor[] = [
  {
    id: 'rail-cz-nv',
    name: 'California Zephyr',
    active: true,
    frequencyNote: '1 train daily in each direction',
    geometryType: 'polyline',
    coordinates: [
      [39.5296, -119.9133], // CA/NV border west of Reno
      [39.5349, -119.8138], // Reno
      [39.5349, -119.7474], // Sparks
      [39.6500, -119.4500], // Fernley vicinity
      [40.1786, -118.6094], // Lovelock
      [40.9730, -117.7357], // Winnemucca
      [40.6427, -116.9343], // Battle Mountain
      [40.7141, -116.0572], // Carlin
      [40.8324, -115.7631], // Elko
      [41.1117, -114.9656], // Wells
      [40.7392, -114.0397], // West Wendover (UT border)
    ],
  },
];

export const railStations: RailStation[] = [
  { id: 'rail-reno',       name: 'Reno Station',       city: 'Reno',       lat: 39.5294, lng: -119.8137, active: true },
  { id: 'rail-sparks',     name: 'Sparks Station',     city: 'Sparks',     lat: 39.5349, lng: -119.7474, active: true },
  { id: 'rail-winnemucca', name: 'Winnemucca Station', city: 'Winnemucca', lat: 40.9730, lng: -117.7357, active: true },
  { id: 'rail-elko',       name: 'Elko Station',       city: 'Elko',       lat: 40.8324, lng: -115.7631, active: true },
];
