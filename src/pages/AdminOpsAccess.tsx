/**
 * Ops Access (/admin/ops-access)
 *
 * Read-only operational underlying-data surface available to:
 *   - Admin: full access
 *   - Ops:   read-only access (operational underlying data only)
 *
 * Explicitly blocked:
 *   - Staff, Viewer:  not authorized (redirected to "/")
 *   - Public-safe:    not authorized (public-safe collapses role to viewer)
 *
 * Ops does NOT automatically receive any of:
 *   - user management
 *   - role assignment
 *   - system configuration
 *   - destructive actions
 *   - data deletion
 *   - pipeline promotion / edit controls
 *   - verified records modification
 *   - credential / security settings
 *
 * TODO: Ops data-capture permissions are TBD. When a scoped Ops write
 * capability is approved, add the gated control here behind
 * `perms.isAdmin || perms.isOps` and the appropriate new permission flag
 * (e.g. `canCaptureOpsData`). Admin-only write/data-capture controls remain
 * Admin-only for now.
 */

import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function AdminOpsAccess() {
  const perms = usePermissions();

  if (!perms.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Admin or Ops only. Staff, Viewer, and public-safe (which collapses to
  // viewer) are not authorized.
  if (!perms.canAccessOps) {
    return <Navigate to="/" replace />;
  }

  const readOnly = !perms.isAdmin && perms.isOps;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Admin
              </Link>
            </Button>
            <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>
              Ops Access
            </h1>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {perms.isAdmin ? 'Admin · full access' : 'Ops · read-only'}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Operational underlying data available to Admin and Ops roles. Staff
          and Viewer cannot access this page. Public-safe mode is blocked.
        </p>

        <section className="rounded border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Operational data (read-only)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This surface will expose operational underlying data Ops users need
            to coordinate field work without granting Admin-only controls.
          </p>

          {/* TODO: Mount Ops-allowed read-only operational panels here
              (e.g. pipeline status snapshots, geocode confidence summaries,
              verification queue counts). Anything destructive, mutating, or
              tied to user/role/system configuration must stay Admin-gated. */}

          {readOnly && (
            <p className="mt-3 text-xs text-muted-foreground">
              You are signed in as <strong>Ops</strong>. Write controls,
              pipeline promotion, verified record edits, user management, and
              system configuration remain Admin-only.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
