---
name: Mobility Managers
description: NDOT Mobility Manager contextual layer — county and member panels only, never map pins or transit providers
type: feature
---
NDOT Mobility Managers are surfaced as a contextual "Transportation Coordination" section in:
1. County detail panel (CountyContent in CoverageDetailPanel)
2. Member Access panel (after Local Transit context), labeled "Transportation Coordination Available"

Source data: src/data/mobility-managers.ts (seed: Jackie Gonzalez NW counties; Marlaina Porter Clark/Esmeralda/Lincoln/Nye). Source URL: https://www.dot.nv.gov/mobility/transit.

Strict rules:
- NEVER render as map pins, transit operators, providers, services, or BH resources.
- NEVER include in counts, access scoring, routing tiers, verification queue, utilization, or routing.
- County match by exact county name only. Multiple managers per county supported.
- Humboldt and Lander flagged via COUNTIES_WITH_MULTIPLE_MOBILITY_MANAGERS — UI shows a "served by multiple mobility managers" disclosure even though seed has one record.
- Required caution copy: "Coordination support only. Not a direct transportation provider."
- Source line: "Source: NDOT" with link to NDOT page.

Member-county lookup uses src/utils/countyLookup.ts (point-in-polygon over nevadaCounties).
