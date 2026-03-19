/**
 * Operational Coverage Model — FTE-Centered (75–90 Minute Drive-Time)
 *
 * Coverage tiers are determined by drive-time radius from FTE base locations,
 * NOT county boundaries. Counties are reference overlays only.
 */

export type CoverageType = 'active' | 'scheduled' | 'remote';

/**
 * Drive-time radius in km.
 * ~75–90 min at ~80 km/h average rural Nevada speed ≈ 120 km.
 */
export const ACTIVE_COVERAGE_RADIUS_KM = 120;

export const COVERAGE_TYPE_LABELS: Record<CoverageType, string> = {
  active: 'Active Field Coverage',
  scheduled: 'Scheduled Outreach',
  remote: 'Telehealth / Remote Support',
};

export const COVERAGE_TYPE_DESCRIPTIONS: Record<CoverageType, string> = {
  active: 'Within 75–90 min drive (~60–85 mi) from FTE base — same-day in-person response',
  scheduled: 'Outside active coverage — planned outreach, not immediate response',
  remote: 'Telephonic/virtual coordination available statewide',
};

export const PRIMARY_RESPONSE_LABELS: Record<CoverageType, string> = {
  active: 'Field (Same-day)',
  scheduled: 'Scheduled Field',
  remote: 'Remote Coordination',
};
