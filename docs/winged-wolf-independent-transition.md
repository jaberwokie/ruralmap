# Winged Wolf — independent Rural Access Tool transition

Status: implementation specification; not a production deployment.
Working branch: `work/winged-wolf-independent-20261103`.
Source: `jaberwokie/ruralmap`. Existing production on `main` is out of scope.

## Product boundary

Iterum Systems remains the developer and repository owner. Winged Wolf is a prospective implementation partner, not assumed to have title to code, data, or IP. No production credentials, user accounts, or privileged records transfer with this branch.

Keep the provider, clinic, hospital, BH, SDoH, tribal, geography, transport, connectivity, search, filters, spatial analysis and Decision Assistant features. Keep verified public resource pins with their coordinates, classification and provenance **only after checking redistribution rights and source independence**. Never characterize public geography as an SSHP provider network.

Remove or neutralize these source-specific features:
- SSHP payer catchment anchors, referral corridors, potential-partner metadata, labels and overlays (`sshpCatchments`).
- Claims, utilization and Tier 1 claims-derived provider scoring, `provider-utilization`, `providerClaimsMetrics`, `utilizationAggregation`, and any claims files under `public/data/utilization/`.
- SSHP-specific member volumes, engaged-member volumes, engagement gap overlays, and demand/utilization statistics. Do not substitute fabricated denominators or estimates.
- NBH/SSHP field hubs, FTE capacities, caseload and response-strain calculations. Do not imply Winged Wolf has on-site staff, outreach operations, or service capacity without its data.
- NBH/SSHP branding, payer-specific tooltips, partner descriptions, internal documentation and provenance references from the *delivered version*.
- NBH-authored special-source trust rules (including `TRUSTED_BH_SOURCES = ['silversummit']`), internal permissions and existing user accounts.
- Member address lookup and all member/PHI pathways unless separately reviewed and authorized.

## Functional behavior to preserve

1. Resource map renders verified pins by category and county, and search/filter/select continue to work.
2. Distance and location-based routing use verified site coordinates and correctly label approximations; travel-time claims require valid routing inputs.
3. Decision Assistant recommends geographically plausible resources and explains limitations. It cannot claim payer eligibility, network inclusion, confirmed availability, or staff deployment without verified inputs.
4. Provider-access gaps may use public facilities and geographic distances, **not SSHP member encounter counts**.
5. Source registry and verification timestamps remain meaningful; imported public data can be distinguished from operational or private data.
6. Empty/failed database states do not silently reseed SSHP or old operational data through static fallbacks.
7. Public/mobile experience is functional without relying on Public Safe Mode to hide confidential features.

## Source-code dependency checklist (audit completed; changes not yet made)

- `src/data/sshpCatchments.ts`; `src/components/map/MapView.tsx`; `src/components/map/Sidebar.tsx`; `src/components/map/MemberAccessPanel.tsx`; `src/components/map/decision-assist/deriveDecisionAssist.ts`; `src/components/map/decision-assist/decisionAssistTypes.ts`; `src/hooks/useMapLayers.ts`; `src/types/layers.ts`; `src/components/mobile/MobileEntry.tsx`; `src/components/map/layers/MapPaneSetup.ts`.
- `src/data/utilization.ts`, `src/data/provider-utilization.ts`, `src/utils/utilizationAggregation.ts`, `src/utils/providerClaimsMetrics.ts`, `src/components/map/layers/UtilizationOverlayLayer.ts`, `src/hooks/useUtilizationData.ts`, utilization display panels, help/tooltips and layer registry.
- `src/utils/fieldResponseStrain.ts` and connected coverage/decision-assist logic.
- `src/utils/bhSourceTrust.ts` and source registry, database rows, seeders and Supabase migrations.
- `CONTEXT.md` and `.lovable` documentation that describe NBH and SSHP operations.

## Database boundary and migration

Current Lovable project access could not be established through the connector. **Do not execute UPDATE/DELETE against the existing production database.**

Provision a fresh backend with a different project ID and fresh auth and secrets. Verify no old user roles, auth accounts, member lookup data, SSHP datasets, audit logs or sensitive environment variables were copied. Export only independently verifiable and licensable public provider and resource records. Preserve table-level counts, source attribution, coordinate locks, and checksums; compare post-import counts and spot-check pins. Historical migration files should not be assumed safe for new deployment because they may seed operational rows.

## Acceptance gate

- No SSHP or NBH payer/operational overlays, visible metrics, static fallback records, API responses or bundled exports.
- All public pins retained *as eligible for redistribution*; no phantom or duplicate records.
- Independent access gaps and Decision Assistant work on realistic cases (Pahrump vs Tonopah, Reno vs Elko, no nearby resources).
- No falsely asserted staffing, network membership, member engagement or utilization.
- Responsive desktop/mobile operation, functional county search/filter/pin details.
- Fresh admin accounts, isolated Supabase backend, separate domain and no shared write credentials.
- TypeScript build, relevant tests, production smoke tests, and stakeholder verification all pass before publishing.

## Cost-control policy

Prefer repository-based analysis, code changes and tests. Do not spend Lovable AI credits, remix, publish, or provision a database solely because capacity or credits are available. Confirm isolation before importing any data.
