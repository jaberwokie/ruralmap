---
name: In-Person vs Remote Language Rule
description: UI must explicitly state In-Person Engagement: Not Available outside FTE field coverage; never imply hybrid/in-person where no field FTE serves
type: feature
---
The map distinguishes in-person engagement from remote coordination based **strictly on FTE field coverage** (any FTE with `hubLocation !== null` serving the county). Use `countyHasFieldCoverage(county)` from `src/utils/fieldCoverageStatus.ts` as the single gate.

Rules outside FTE field coverage:
- Show explicit "In-Person Engagement: Not Available" block (destructive styling).
- Use copy: "This area is outside active field coverage. In-person engagement does not occur in this region."
- Never say "hybrid deployment recommended", "moderate feasibility" (re: physical presence), or "coverage varies" without the explicit field-coverage caveat.
- Remote Coordination remains visible but is a separate, distinct block.

Affected surfaces: County detail panel (NBHRoutingSection, Broadband warning), Member Access panel (above Recommendation block), broadband operational note (`getBroadbandOperationalNote(data, hasFieldCoverage)`).

Constraints: display-only; no scoring, tier, or layer logic changed.
