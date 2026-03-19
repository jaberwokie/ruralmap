/** Contextual help tooltip definitions for sidebar toggles and legend items */

export interface HelpTooltip {
  label: string;
  explanation: string;
}

export const HELP_TOOLTIPS: Record<string, HelpTooltip> = {
  counties: {
    label: 'County Boundaries',
    explanation:
      'Shows Nevada county boundaries for geographic reference. This helps users orient the map by county and understand where operational conditions are occurring.',
  },
  serviceLocations: {
    label: 'Service Locations',
    explanation:
      'Shows mapped hospitals, clinics, and provider locations across the rural network. These pins represent known service access points, not necessarily active field engagement coverage.',
  },
  memberVolume: {
    label: 'Member Volume',
    explanation:
      'Shades counties based on member concentration. Darker shading means a higher share of rural members are associated with that county.',
  },
  ruralServices: {
    label: 'Rural Services (Resource Guide)',
    explanation:
      'Shows community service resources and practical support access points that may help meet non-clinical needs in rural areas.',
  },
  operationalCoverage: {
    label: 'Operational Coverage Model',
    explanation:
      "Displays Nevada Behavioral Health's operational engagement structure by coverage area. This reflects how the team is organized to serve the rural market, not just where providers exist.",
  },
  fteCapacity: {
    label: 'FTE Capacity & Load',
    explanation:
      'Shows field team positioning and how assigned staffing capacity relates to current operational coverage demand.',
  },
  utilizationIntensity: {
    label: 'Utilization Intensity',
    explanation:
      'Shades counties based on average visits per member. This helps show where the provider network is being used more intensely and where access may depend on a smaller number of active providers.',
  },
  engagementGap: {
    label: 'Engagement Gap',
    explanation:
      'Flags counties where clinical utilization is relatively high but no active CCC, CHW, or field engagement support is currently assigned. This highlights places where treatment may be happening without relational infrastructure around it.',
  },
  coverageRadius: {
    label: 'Coverage Radius',
    explanation:
      'Shows a geographic radius around mapped service locations to illustrate nearby physical access coverage. This is a distance-based visual aid, not proof of actual appointment availability or operational engagement.',
  },
  coverageGaps: {
    label: 'Coverage Gaps',
    explanation:
      'Highlights areas outside the configured service radius. These are geographic access gaps based on mapped service locations and radius logic.',
  },
  tier1Legend: {
    label: 'Tier 1',
    explanation:
      'Tier 1 represents telehealth, remote, or non-field-based support resources that may extend access but do not function as in-person geographic coverage in the same way as hospitals or clinics.',
  },
};
