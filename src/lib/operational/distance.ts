/**
 * Distance / drive helpers — stable re-export surface.
 * Formulas and constants remain in src/utils/coverageZones.ts.
 */
export {
  kmToMiles,
  kmToDriveMinutes,
  driveMinutesToKm,
} from '@/utils/coverageZones';

export { kmToMi, haversineKm } from './memberAccess';
