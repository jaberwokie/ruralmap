/** Contextual help tooltip definitions for sidebar toggles and legend items */

export interface HelpTooltip {
  label: string;
  explanation: string;
  shortExplanation?: string;
}

export const HELP_TOOLTIPS: Record<string, HelpTooltip> = {
  counties: {
    label: 'County Boundaries',
    explanation:
      'Shows Nevada county boundaries for geographic reference. This helps users orient the map by county and understand where operational conditions are occurring.',
  },
  countiesLegend: {
    label: 'County Boundaries Legend',
    explanation:
      'The thin line sample shows the county outline styling used on the map. It marks county borders only and is not a route, boundary buffer, or coverage area.',
  },
  serviceLocations: {
    label: 'Provider Locations',
    explanation:
      'Shows mapped provider locations across the rural network. Includes hospitals (red) and clinics (blue). These points show where clinical provider sites are located on the map, not where field engagement coverage is assigned.',
  },
  serviceLocationsLegend: {
    label: 'Provider Locations Legend',
    explanation:
      'The Provider Locations legend groups both provider types in one row: red pins represent hospitals and blue pins represent clinics. Both symbols mark clinical provider sites at their mapped positions.',
  },
  services: {
    label: 'Service',
    explanation:
      'Represents general community support locations from the service provider database. These green points are separate from clinical provider sites and separate from behavioral health locations.',
    shortExplanation: 'Shows general community support locations as separate green points.',
  },
  servicesLegend: {
    label: 'Service Legend',
    explanation:
      'The green marker sample shows the symbol used for general community support locations. It is distinct from both clinical provider locations and behavioral health locations.',
  },
  behavioralHealth: {
    label: 'Behavioral Health',
    explanation:
      'Shows behavioral health-related locations from the service provider database. These purple points are identified using source categories such as Mental Health and Substance Use, and are shown separately from general community support locations.',
    shortExplanation: 'Shows behavioral health-related locations as separate purple points.',
  },
  behavioralHealthLegend: {
    label: 'Behavioral Health Legend',
    explanation:
      'The purple marker sample shows the symbol used for behavioral health locations. It marks behavioral health-related infrastructure from the service provider database and is intentionally separate from general service locations.',
  },
  operationalCoverage: {
    label: 'Response Capability',
    explanation:
      "Shows where same-day field response, planned field response, and remote-only support are available based on staff deployment and travel-time coverage. This visual explains operational response reach, not provider site presence.",
  },
  operationalCoverageLegend: {
    label: 'Response Capability Legend',
    explanation:
      'The three sample boxes show the map treatment for same-day field response, planned field response, and remote-only support. Solid and dashed styles indicate different response conditions, not point locations.',
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
    label: 'Provider Coverage Radius',
    explanation:
      'Shows a geographic radius around mapped provider locations to illustrate approximate access reach. This visual represents distance-based coverage, not confirmed appointment availability or operational engagement assignment.',
    shortExplanation: 'Shows the current estimated reach around each provider based on the selected radius.',
  },
  coverageRadiusLegend: {
    label: 'Provider Coverage Radius Legend',
    explanation:
      'The outlined circle sample shows the map treatment for the active provider reach radius around a location. It represents approximate distance coverage, not a fixed service boundary.',
  },
  coverageGaps: {
    label: 'Access Gaps (Outside Coverage Radius)',
    explanation:
      'Highlights areas outside the configured provider coverage radius. These are geographic access gaps based on mapped provider locations and radius logic.',
  },
  coverageGapsLegend: {
    label: 'Access Gaps Legend',
    explanation:
      'The red shaded sample shows the overlay used for areas outside the selected provider coverage radius. It indicates uncovered geography based on the current radius setting.',
  },
  cellularCoverage: {
    label: 'Cellular Coverage',
    explanation:
      'Displays LTE and 5G coverage by county using FCC availability data. Indicates where cellular service is present, not carrier-specific networks or signal strength. Used to assess feasibility for mobile engagement and coordination.',
  },
  tier1Legend: {
    label: 'Tier 1',
    explanation:
      'Tier 1 represents telehealth, remote, or non-field-based support resources that may extend access but do not function as in-person geographic coverage in the same way as hospitals or clinics.',
  },
};
