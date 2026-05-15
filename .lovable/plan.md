# Fix: Admin pages redirect to home right after login

## Root cause

In `src/contexts/AuthContext.tsx`, `setReady(true)` fires before the user's role is fetched.

- `getSession()` resolves → `setReady(true)` runs immediately, while `refreshRole()` is still in-flight (lines 140–144).
- `onAuthStateChange` does the same — calls `setReady(true)` synchronously while `refreshRole()` is queued in a `setTimeout` (lines 117–123).

Result: there's a window where `ready === true`, `session.user` exists, but `role === 'viewer'`. During that window, every admin page guard runs:

```ts
if (perms.ready && !perms.isAdmin && !perms.isStaff) {
  return <Navigate to="/" replace />;
}
```

…and kicks the user back to `/`. This affects `AdminHome`, `AdminMappingLayout`, `AdminUsers`, `AdminUnmappedProviders`, `AdminTraining` — anything gated on role.

## Fix (one file)

`src/contexts/AuthContext.tsx` — make `ready` mean "session AND role are resolved" when a user is signed in.

1. In the `getSession()` branch: when `existing?.user` exists, `await refreshRole(existing.user.id)` before calling `setReady(true)`. When no user, set ready immediately as today.
2. In the `onAuthStateChange` callback: when `safeSession?.user` exists, do not call `setReady(true)` synchronously. Instead, run `refreshRole(...)` (still deferred via `setTimeout` to avoid the documented Supabase deadlock) and call `setReady(true)` from inside the deferred callback after the role resolves. When no user, set ready immediately.
3. Keep the existing public-mode early return and expired-token paths unchanged — they already set ready correctly.

No other files change. Guard logic in admin pages stays as-is; once `ready` correctly reflects role resolution, the bounce disappears.

## Verification

- Sign out, sign back in as staff/admin, click "Manage Operational Data" → page loads and stays.
- Hard refresh on `/admin/mapping` while signed in → no flash redirect to `/`.
- Signed-out user visiting `/admin` → still redirected to `/` (unchanged).
- Public mode (`/public`) → unchanged.
- TypeScript clean.
