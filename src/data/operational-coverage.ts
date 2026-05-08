/**
 * Operational Coverage Model — FTE-Centered Fixed-Distance Approximation
 *
 * Coverage tiers are determined by a fixed-distance radius from FTE base
 * locations, NOT route-network drive time or county boundaries. Counties are
 * reference overlays only.
 */

export type CoverageType = 'active' | 'scheduled' | 'remote';

/**
  * Active field-coverage fixed-distance radius in km.
  * This value also drives the teal Active field coverage geometry.
 */
export const ACTIVE_COVERAGE_RADIUS_KM = 120;

export const COVERAGE_TYPE_LABELS: Record<CoverageType, string> = {
  active: 'Active Field Coverage',
  scheduled: 'Scheduled Outreach',
  remote: 'Telehealth / Remote Support',
};

export const COVERAGE_TYPE_DESCRIPTIONS: Record<CoverageType, string> = {
  active: 'Within active field coverage from an FTE base — same-day in-person response approximation',
  scheduled: 'Outside active coverage — planned outreach, not immediate response',
  remote: 'Telephonic/virtual coordination available statewide',
};

export const PRIMARY_RESPONSE_LABELS: Record<CoverageType, string> = {
  active: 'Field (Same-day)',
  scheduled: 'Scheduled Field',
  remote: 'Remote Coordination',
};
