# Winged Wolf: independent backend deployment gate

**Status: NOT DEPLOYED.** This document describes a minimum release procedure, not authorization to copy the existing database or make changes to production.

## Hard isolation boundary

- The original Rural Medicaid / NBH Supabase instance is prohibited for Winged Wolf; code now rejects its known project ID at runtime.
- The historical checked-in `.env` was removed from this working branch and ignored going forward. Because it exists in old Git commits, **the original public repository history must not be shared as a clean-source package**.
- `supabase/config.toml` has a non-operational placeholder. Replace it only after a NEW Supabase project is created.
- Do not use Lovable preview-session auth brokering for a separately deployed Winged Wolf app.
- The development CI uses a synthetic project ID and fake publishable key. Its passing build is not suitable to deploy as a live app.

## Provision new backend (not yet performed)

1. Create a new project controlled by Iterum Systems, separate from NBH, SSHP and the original Lovable environment. Do **not** fork or clone production DB.
2. Set the new project's ID, HTTPS URL and publishable key in the deployment platform's environment secrets; no `.env` values should be committed. Keep the service-role key server-side only.
3. Review all SQL migrations, seed scripts and edge functions before applying any of them. Historical migrations are not independently certified for safe data import.
4. Set up new authentication identities and verify RLS and least-privilege roles from scratch. No existing staff accounts, sessions, logs, member addresses or imports should transfer.
5. Populate resource tables only from a data provenance manifest: source URL, license/permission, retrieved date, verification date, transformation, coordinates, and a county/record count. Do not import entire facilities or rural_services production tables.
6. Exclude payer claims, member counts, engagement ownership, FTE deployment, provider rankings, SSHP pathways, legacy `operational` metadata and old storage keys. These are not partner-independent public provider attributes.
7. Validate provider counts/coordinates and map workflow in browser. Verify empty database states cannot silently show payer analytics; separate public static fallback records need provenance review.
8. Test both public and authorized admin interfaces, logout/session isolation, row access policies, search/filters, geography and Decision Assistant without invoking the original backend.
9. Package as clean-history independent deployment artifact with necessary legal/license notices. Never distribute the source-history of `jaberwokie/ruralmap` as if it were sanitized.

## Current scope limits

- Automatic frontend validation blocks the known original project ID. It does not prove that every third-party service or server-side edge function is isolated.
- This branch has no newly provisioned backend, no production data copied, and no independent app URL.
- The existing provider pin source files are preserved for engineering continuity; **not yet approved for redistribution**.
- Original tracked `.env` contained a publishable key (not a service-role secret). Its past inclusion still requires a key-exposure/history review; no key rotation was performed here.

## Release gate

A release requires evidence of: new backend ID and owner; credentials isolation; migration review; RLS/auth test; provenance manifest; no proprietary data in current build or Git package; end-to-end browser QA; legal usage rights; Iterum/Winged Wolf roles and license terms. Passing unit tests alone is insufficient.
