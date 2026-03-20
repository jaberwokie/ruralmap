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
  serviceLocations: {
    label: 'Provider Locations',
    explanation:
      'Shows mapped hospitals, clinics, and provider sites across the rural network. These points show where providers are located on the map, not where field engagement coverage is assigned.',
  },
  services: {
    label: 'Service Network',
    explanation:
      'Shows the broader community service network across Nevada so users can compare service presence against member volume, utilization, and engagement gaps. Use the detail panel for county-level service context and supporting resource detail.',
    shortExplanation: 'Shows where provider and service presence is distributed across the map.',
  },
  operationalCoverage: {
    label: 'Response Capability',
    explanation:
      "Shows where same-day field response, planned field response, and remote-only support are available based on staff deployment and travel-time coverage. This visual explains operational response reach, not provider site presence.",
  },
  fteCapacity: {
    label: 'Staffing Capacity & Load',
    explanation:
      'Shows field team positioning and how assigned staffing capacity relates to current operational coverage demand.',
  },
  utilizationIntensity: {
    label: 'Service Utilization Intensity',
    explanation:
      'Shades counties based on average visits per member. This helps show where the provider network is being used more intensely and where access may depend on a smaller number of active providers.',
  },
  engagementGap: {
    label: 'Engagement Gap',
    explanation:
      'Highlights where members are not being reached by behavioral health services. This layer compares total Medicaid members to those with at least one behavioral health encounter, showing where large unengaged populations exist. It helps identify counties where outreach and engagement efforts should be prioritized.',
    shortExplanation: 'Shows where members are not being reached relative to available services.',
  },
  coverageRadius: {
    label: 'Provider Coverage Radius',
    explanation:
      'Shows a geographic radius around mapped provider locations to illustrate approximate access reach. This visual represents distance-based coverage, not confirmed appointment availability or operational engagement assignment.',
    shortExplanation: 'Shows the current estimated reach around each provider based on the selected radius.',
  },
  coverageGaps: {
    label: 'Access Gaps (Outside Coverage Radius)',
    explanation:
      'Highlights areas outside the configured provider coverage radius. These are geographic access gaps based on mapped provider locations and radius logic.',
  },
  tier1Legend: {
    label: 'Tier 1',
    explanation:
      'Tier 1 represents telehealth, remote, or non-field-based support resources that may extend access but do not function as in-person geographic coverage in the same way as hospitals or clinics.',
  },
};
