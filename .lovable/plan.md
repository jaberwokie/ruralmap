

## Make verified Nye services visible to public/logged-out users

### Root cause

Nye services live in the Cloud `verified_services` and `verified_bh` tables. Their RLS policies (migration `20260421173530…`) only grant SELECT to `authenticated` users:

```sql
CREATE POLICY "auth read verified_services" ON public.verified_services
  FOR SELECT TO authenticated USING (true);
```

When the app runs logged-out (default first load, shared link, or `?public=1`), `useLiveVerifiedRecords` calls `listVerifiedServices()` / `listVerifiedBh()` with the anon key, RLS returns zero rows, and `mergedRuralServices` falls back to just the static `enriched-rural-services.ts` — which doesn't contain the Nye imports. Result: no Nye pins on the map, no Nye entries in the County detail panel's Local Resource Network.

This is not a mobile bug. It reproduces in any logged-out browser. It only "looks like" a mobile issue because desktop is where you stay signed in.

### Change

Open read access on the verified (promoted) tables so the public map renders the same dataset everyone else sees. Staging tables stay locked down — only promoted/active rows become public.

Add a migration that:

1. Adds a `SELECT` policy on `public.verified_services` for the `anon` role, scoped to `active_status = true`.
2. Adds the equivalent `SELECT` policy on `public.verified_bh`, scoped to `active_status = true`.
3. Leaves all admin INSERT/UPDATE/DELETE policies and all `staging_*` policies untouched.

No application code changes required — `useLiveVerifiedRecords` already filters on `active_status` and handles the merge. Once anon SELECT is allowed, Nye records flow through to both the Services pin layer and the County detail panel on every device, signed-in or not.

### Verification after deploy

- Open the app in a private window (logged-out): Nye services appear on the map and inside Nye County → Local Resource Network.
- Open with `?public=1`: same result.
- Admin pages still require auth and still gate writes behind the `admin` role.

