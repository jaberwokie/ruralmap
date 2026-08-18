# Admin user management: password resets, resend invite, remove user

Adds password-reset and account actions to the existing `/admin/users` page so you can manage users without touching the backend directly.

## What you get on /admin/users

Each user row gets an actions menu:

- **Send password reset** — emails a reset link that lands on `/reset-password` on the live domain. No password is ever shown to you.
- **Set temporary password** — generates (or accepts) a temp password, shown once in a copy-to-clipboard dialog, for cases where email is not reaching the user. Fallback action, visually secondary.
- **Resend invite** — re-sends the invite email for users who were registered but never signed up.
- **Remove user** — deletes the auth user and their role row. Requires typing the user's email to confirm. Restricted to sysop.

Rules kept from today's page:
- You cannot run any of these actions on your own row (except password reset for yourself, which is allowed).
- Sysop accounts stay hidden from the list and cannot be targeted.
- The last active admin cannot be removed.
- Every action produces a success/error toast and reloads the list.

## Technical notes

New edge function `admin-user-actions` (service-role, verifies caller JWT and requires `admin` or `sysop` in `user_roles` with `is_active`), with an `action` field:

| action | implementation |
| --- | --- |
| `send_reset` | `auth.admin.generateLink({ type: 'recovery' })` or `resetPasswordForEmail` with `redirectTo` = live origin + `/reset-password` |
| `set_temp_password` | `auth.admin.updateUserById(id, { password })`, returns the password once in the response body; also sets a `must_change_password` flag in user metadata |
| `resend_invite` | re-upsert `pending_admin_emails`, then `auth.admin.inviteUserByEmail` (same logic as `invite-user`) |
| `delete_user` | sysop-only; `auth.admin.deleteUser(id)` after last-active-admin check; role row cascades |

Server-side guards: reject self-delete, reject targeting any user whose role is `sysop`, reject `delete_user` unless caller role is `sysop`, reject temp passwords under 12 chars.

Frontend: `src/pages/AdminUsers.tsx` gains an actions column using the existing `DropdownMenu`, `AlertDialog`, and `Dialog` primitives plus `sonner` toasts. No new dependencies. No role/active logic changes.

`must_change_password` handling: on login, if the flag is set, `ResetPassword.tsx` is reused to force a password change before the map loads. This is the only touch outside admin surfaces.

Docs: CONTEXT.md Section 12 (Admin System) gets the new admin user actions and the sysop-only delete restriction; Section 17 gets a line that account deletion is the one hard delete in the system and is sysop-only.
