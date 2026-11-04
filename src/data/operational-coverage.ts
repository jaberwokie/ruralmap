/**
 * Independent edition: no partner staffing, field-response or telehealth
 * capacity has been verified. These labels must NEVER imply availability.
 * Geographic provider access is a separate calculation.
 */
export type CoverageType = 'active' | 'scheduled' | 'remote';
export const ACTIVE_COVERAGE_RADIUS_KM = 120;
export const COVERAGE_TYPE_LABELS: Record<CoverageType, string> = {
  active: 'Field Staffing Unverified',
  scheduled: 'Outreach Schedule Unverified',
  remote: 'Remote Support Unverified',
};
export const COVERAGE_TYPE_DESCRIPTIONS: Record<CoverageType, string> = {
  active: 'No verified organizational field staffing is configured for this edition.',
  scheduled: 'No partner outreach schedule is configured for this edition.',
  remote: 'Remote or telehealth coordination has not been verified. Confirm directly.',
};
export const PRIMARY_RESPONSE_LABELS: Record<CoverageType, string> = {
  active: 'Staffing Unverified',
  scheduled: 'Scheduling Unverified',
  remote: 'Remote Support Unverified',
};
