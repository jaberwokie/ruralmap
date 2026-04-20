---
name: Engagement Ownership Model
description: Two-state CHW ownership display (Primary vs Remote) — never use "No CHW Coverage"; gated by countyHasFieldCoverage
type: feature
---
The Rural Operations Map uses a strict two-state Engagement Ownership model. There is no "No CHW Coverage" state — every county is owned by either a Primary or Remote CHW.

States (gated by `countyHasFieldCoverage(county)` from `src/utils/fieldCoverageStatus.ts`):
- **Primary CHW Coverage** — county has at least one field FTE (`hubLocation !== null`). In-Person Engagement: Available. Telehealth Engagement: Available (Primary).
- **Remote CHW Coverage** — county has no field FTE. In-Person Engagement: Not Available. Telehealth Engagement: Available (Remote CHW).

Required remote support note (verbatim):
"Telehealth engagement is handled by the assigned CHW for this region. Remote CHWs may support but do not replace assigned coverage."

Implementation: shared component `src/components/map/EngagementOwnershipBlock.tsx`. Rendered in:
- County detail panel — top of `NBHRoutingSection`.
- Member Access panel — above the Recommendation block (replaces prior standalone "In-Person: Not Available" notice).

Constraints: display-only. Does not change FTE/CHW assignments, scoring, layers, filters, routing tiers, or access calculations.
