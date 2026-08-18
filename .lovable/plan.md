# Fix sysop password reset

Two problems, two fixes. Your two sysop emails are hidden from `/admin/users` by design, so the only path today is the emailed reset link — and that link is not landing on a usable screen.

## Why the reset link fails

`/reset-password` only looks for a `type=recovery` token in the URL **hash**. Current Supabase recovery links deliver either:

- `?code=...` (PKCE), or
- `?token_hash=...&type=recovery`

Neither is handled, so the page waits 400ms, finds no recovery session, and shows "This reset link is invalid or has expired." That matches what you're seeing.

## Fix 1 — make /reset-password accept all link formats

Rewrite the token detection in `src/pages/ResetPassword.tsx` to, in order:

1. `?code=` present → `supabase.auth.exchangeCodeForSession(code)`
2. `?token_hash=` + `type=recovery` → `supabase.auth.verifyOtp({ type: 'recovery', token_hash })`
3. hash `access_token` / `type=recovery` → existing behavior (session set by the SDK)
4. already-authenticated session → allow the password change anyway

Only show the "invalid or expired" state after all four fail. Show the specific error text from the failed exchange instead of a generic message, and strip the token from the URL after a successful exchange so a refresh doesn't re-consume it.

## Fix 2 — immediate password set for your two accounts

So you are not blocked on email at all, I'll set the passwords for `mcloutier@nvbhs.com` and `mcloutier@protonmail.com` directly through the backend admin API using a password you give me, then you sign in normally and can change it from `/reset-password` afterward.

Send me the password you want to use (or say "generate" and I'll create a strong one and give it to you once). This is a one-off backend action, no code involved.

## Also worth checking

Recovery links break if the redirect target isn't allow-listed. `https://ruraltool.iterum.systems/reset-password` needs to be in the auth redirect allowlist with Site URL set to `https://ruraltool.iterum.systems`. That's a Cloud settings screen you have to set manually (Cloud → Users → Auth settings) — I can't write it from here, but Fix 1 + Fix 2 get you in regardless.

## Out of scope

No change to how sysop accounts are hidden from `/admin/users`, no change to roles, RLS, or the invite flow.
