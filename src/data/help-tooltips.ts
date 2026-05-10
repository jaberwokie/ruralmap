/** Contextual help tooltip definitions for sidebar toggles and legend items */

export interface HelpTooltip {
  label: string;
  explanation: string;
  shortExplanation?: string;
}

export const HELP_TOOLTIPS: Record<string, HelpTooltip> = {
  counties: {
    label: 'County Operating Boundaries',
    explanation:
      'Shows Nevada county operating boundaries for geographic reference. Helps orient review by county and frame where operational conditions are occurring.',
  },
  tribalNations: {
    label: 'Tribal Jurisdiction Context',
    explanation:
      "Displays Nevada's federally recognized Tribal Nations as sovereign jurisdiction context. Click an area to review contact information, tribal programs, and tribally operated services. Data sourced from the Nevada Department of Native American Affairs.",
  },
  countiesLegend: {
    label: 'County Operating Boundaries Legend',
    explanation:
      'The thin line sample shows the styling used to mark county operating boundaries. It marks county borders only and is not a route, buffer, or coverage reach.',
  },
  serviceLocations: {
    label: 'Provider Access Infrastructure',
    explanation:
      'Shows verified provider access infrastructure across the rural network — hospitals (red) and clinics (blue). These are clinical access points, not field engagement coverage assignments.',
  },
  serviceLocationsLegend: {
    label: 'Provider Access Infrastructure Legend',
    explanation:
      'Groups both provider types in one row: red marks hospitals, blue marks clinics. Both represent verified clinical access points.',
  },
  services: {
    label: 'Community Service Access Network',
    explanation:
      'Verified community support access points from the service provider directory. Distinct from clinical provider sites and from behavioral health access points.',
    shortExplanation: 'Community support access points (green), separate from clinical and behavioral health access points.',
  },
  servicesLegend: {
    label: 'Community Service Access Network Legend',
    explanation:
      'The green sample marks the styling used for community support access points. Distinct from clinical provider access and behavioral health access points.',
  },
  behavioralHealth: {
    label: 'Behavioral Health Capacity Network',
    explanation:
      'Verified behavioral health access points from the service provider directory. Identified using source categories such as Mental Health and Substance Use, and shown separately from community service access points.',
    shortExplanation: 'Behavioral health access points (purple), separate from community service access points.',
  },
  behavioralHealthLegend: {
    label: 'Behavioral Health Capacity Network Legend',
    explanation:
      'The purple sample marks the styling used for behavioral health access points. Represents behavioral health capacity infrastructure and is intentionally separate from community service access points.',
  },
  operationalCoverage: {
    label: 'Response Capability',
    explanation:
      'Shows where same-day field response, planned field response, and remote-only support are available based on staff deployment and travel-time reach. Reflects operational response reach, not provider site presence.',
  },
  operationalCoverageLegend: {
    label: 'Response Capability Legend',
    explanation:
      'The three sample boxes show the styling for same-day field response, planned field response, and remote-only support. Solid and dashed styles indicate response conditions, not point locations.',
  },
  fteCapacity: {
    label: 'Staffing Capacity & Load',
    explanation:
      'Shows field team positioning and how assigned staffing capacity relates to current operational coverage demand.',
  },
  fteCapacityLegend: {
    label: 'Staffing Capacity & Load Legend',
    explanation:
      'The stepped bar sample shows relative staffing/load intensity from lower to higher capacity pressure. Taller bars indicate higher load relative to capacity.',
  },
  utilizationIntensity: {
    label: 'Service Utilization Intensity',
    explanation:
      'Shades counties based on average visits per member. This helps show where the provider network is being used more intensely and where access may depend on a smaller number of active providers.',
  },
  utilizationIntensityLegend: {
    label: 'Service Utilization Intensity Legend',
    explanation:
      'The color ramp shows county shading from lower to higher average visits per member. Darker tones indicate higher utilization intensity.',
  },
  engagementGap: {
    label: 'Engagement Gap',
    explanation:
      'Highlights where members are not being reached by behavioral health services. This layer compares total Medicaid members to those with at least one behavioral health encounter, showing where large unengaged populations exist. It helps identify counties where outreach and engagement efforts should be prioritized.',
    shortExplanation: 'Shows where members are not being reached relative to available services.',
  },
  engagementGapLegend: {
    label: 'Engagement Gap Legend',
    explanation:
      'The color ramp shows increasing engagement concern across counties. The visual gradient moves from lower concern to higher unmet engagement risk.',
  },
  coverageRadius: {
    label: 'Provider Operational Coverage Reach',
    explanation:
      'Shows the operational coverage reach around mapped provider access points to illustrate approximate access viability. This represents distance-based reach, not confirmed appointment availability or field engagement assignment.',
    shortExplanation: 'Shows the current estimated operational reach around each provider based on the selected radius.',
  },
  coverageRadiusLegend: {
    label: 'Provider Operational Coverage Reach Legend',
    explanation:
      'The outlined circle sample shows the styling for the active provider operational reach around a location. It represents approximate distance-based reach, not a fixed service boundary.',
  },
  coverageGaps: {
    label: 'Operational Access Constraints (Outside Coverage Reach)',
    explanation:
      'Highlights areas outside the configured provider coverage reach. These are operational access constraints derived from provider access infrastructure and the selected coverage reach.',
  },
  coverageGapsLegend: {
    label: 'Operational Access Constraints Legend',
    explanation:
      'The red shaded sample shows the overlay used for areas outside the selected provider coverage reach. It indicates operationally constrained geography based on the current reach setting.',
  },
  cellularCoverage: {
    label: 'Cellular Coverage',
    explanation:
      'Displays LTE and 5G coverage by county using FCC availability data. High: LTE >80% and 5G present with a major population center. Mixed: LTE 50–80% or uneven geographic distribution. Low: LTE <50% or mostly rural coverage gaps. Coverage reflects geographic availability, not signal quality. Large rural counties may appear lower despite strong coverage in populated areas.',
  },
  broadbandAccess: {
    label: 'Broadband Access',
    explanation:
      'Broadband Access is an aggregate county-level grading based on available broadband service distribution. It is not a direct address-level guarantee of connectivity. It is intended to show broad access patterns across the county, not exact household service availability.',
  },
  tier1Legend: {
    label: 'Tier 1',
    explanation:
      'Tier 1 represents telehealth, remote, or non-field-based support resources that may extend access but do not function as in-person geographic coverage in the same way as hospitals or clinics.',
  },
  tier1Providers: {
    label: 'Tier 1 Providers',
    explanation:
      'High-priority network providers used for operational review. Tier 1 indicates network priority — it is not a measure of distance, proximity, or guaranteed availability, and does not imply that a member can access the provider.',
  },
};
