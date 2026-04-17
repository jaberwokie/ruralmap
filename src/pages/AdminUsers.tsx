/**
 * Admin-only User Management page (/admin/users).
 *
 * Lists all auth users with their effective role and active status, and lets
 * an admin change role or toggle active state. All mutations are guarded both
 * client-side (UI) and server-side (security-definer RPCs that re-check
 * `has_role(auth.uid(), 'admin')` and enforce last-admin protection).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions, type AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type Row = {
  user_id: string;
  email: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string | null;
  role_updated_at: string | null;
};

const ROLE_OPTIONS: AppRole[] = ['viewer', 'staff', 'admin'];

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function AdminUsers() {
  const perms = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_list_users');
    if (error) {
      console.warn('[admin] admin_list_users failed', error);
      toast.error('Failed to load users');
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (perms.ready && perms.isAdmin) {
      load();
    }
  }, [perms.ready, perms.isAdmin]);

  // Gating: wait for auth resolution; redirect non-admins.
  if (!perms.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!perms.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const updateRole = async (row: Row, nextRole: AppRole) => {
    if (nextRole === row.role) return;
    if (!perms.isAdmin) return;
    setPendingId(row.user_id);
    const { error } = await (supabase.rpc as any)('admin_set_user_role', {
      _user_id: row.user_id,
      _role: nextRole,
    });
    setPendingId(null);
    if (error) {
      toast.error(error.message || 'Failed to update role');
      return;
    }
    toast.success(`Role updated to ${nextRole}`);
    load();
  };

  const updateActive = async (row: Row, nextActive: boolean) => {
    if (nextActive === row.is_active) return;
    if (!perms.isAdmin) return;
    setPendingId(row.user_id);
    const { error } = await (supabase.rpc as any)('admin_set_user_active', {
      _user_id: row.user_id,
      _is_active: nextActive,
    });
    setPendingId(null);
    if (error) {
      toast.error(error.message || 'Failed to update status');
      return;
    }
    toast.success(nextActive ? 'User activated' : 'User deactivated');
    load();
  };

  const sortedRows = useMemo(() => rows.slice(), [rows]);
  const selfId = perms.user?.id ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">User Management</h1>
            <p className="text-xs text-muted-foreground mt-1">Admin only</p>
          </div>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Back to map
          </Link>
        </div>

        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Email</th>
                <th className="text-left font-medium px-4 py-2 w-40">Role</th>
                <th className="text-left font-medium px-4 py-2 w-28">Active</th>
                <th className="text-left font-medium px-4 py-2 w-48">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              )}
              {!loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {!loading && sortedRows.map((row) => {
                const isSelf = row.user_id === selfId;
                const busy = pendingId === row.user_id;
                return (
                  <tr key={row.user_id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{row.email ?? '—'}</div>
                      {isSelf && (
                        <div className="text-[11px] text-muted-foreground">you</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={row.role}
                        onValueChange={(v) => updateRole(row, v as AppRole)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(v) => updateActive(row, v)}
                          disabled={busy || isSelf}
                        />
                        <span className="text-xs text-muted-foreground">
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          Inactive users lose elevated access on next sign-in. Self-lockout
          protections prevent removing the last active admin.
        </p>
      </div>
    </div>
  );
}
