/**
 * Distance / drive helpers — stable re-export surface.
 * Formulas and constants remain in src/utils/coverageZones.ts.
 * (haversineKm and kmToMi live in ./memberAccess to avoid duplicate exports.)
 */
export {
  kmToMiles,
  kmToDriveMinutes,
  driveMinutesToKm,
} from '@/utils/coverageZones';
