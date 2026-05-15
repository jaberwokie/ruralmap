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
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
  role: AppRole | null;
  is_active: boolean | null;
  created_at: string | null;
  role_updated_at: string | null;
};

const ROLE_OPTIONS: AppRole[] = ['viewer', 'staff', 'admin'];
const VALID_ROLES = new Set<AppRole>(ROLE_OPTIONS);

type SortKey = 'email' | 'role' | 'status' | 'created';
type SortDir = 'asc' | 'desc';

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
};

// Coerce server row into a safe shape. Users with no user_roles row will
// show as viewer/inactive defaults so the table never breaks.
const normalizeRow = (raw: any): Row => {
  const role = VALID_ROLES.has(raw?.role) ? (raw.role as AppRole) : 'viewer';
  return {
    user_id: String(raw?.user_id ?? ''),
    email: raw?.email ?? null,
    role,
    is_active: typeof raw?.is_active === 'boolean' ? raw.is_active : false,
    created_at: raw?.created_at ?? null,
    role_updated_at: raw?.role_updated_at ?? null,
  };
};

export default function AdminUsers() {
  const perms = usePermissions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'staff' | 'admin'>('viewer');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { error } = await (supabase.rpc as any)('admin_invite_user', {
        _email: inviteEmail.trim().toLowerCase(),
        _role: inviteRole,
      });
      if (error) throw error;
      toast.success(`Invite registered for ${inviteEmail} as ${inviteRole}. They will be assigned this role when they sign up.`);
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to register invite');
    } finally {
      setInviting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)('admin_list_users');
    if (error) {
      console.warn('[admin] admin_list_users failed', error);
      toast.error('Failed to load users');
      setRows([]);
    } else {
      setRows(((data ?? []) as any[]).filter((r) => r?.user_id).map(normalizeRow));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (perms.ready && perms.isAdmin) {
      load();
    }
  }, [perms.ready, perms.isAdmin]);

  const selfId = perms.user?.id ?? null;

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const activeAdmins = rows.filter((r) => r.is_active && r.role === 'admin').length;
    return { total, active, activeAdmins };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = rows.slice();
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: Row, b: Row) => {
      switch (sortKey) {
        case 'email':
          return (a.email ?? '').localeCompare(b.email ?? '') * dir;
        case 'role': {
          const order: Record<AppRole, number> = { admin: 0, staff: 1, viewer: 2 };
          return ((order[a.role ?? 'viewer'] - order[b.role ?? 'viewer']) || 0) * dir;
        }
        case 'status':
          return ((Number(b.is_active) - Number(a.is_active))) * dir;
        case 'created': {
          const av = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bv = b.created_at ? new Date(b.created_at).getTime() : 0;
          return (av - bv) * dir;
        }
      }
    };
    copy.sort(cmp);
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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
    if (row.user_id === selfId) {
      toast.error('You cannot change your own role');
      return;
    }
    // Confirm admin demotion
    if (row.role === 'admin' && nextRole !== 'admin') {
      const ok = window.confirm(
        `Demote ${row.email ?? 'this user'} from admin to ${nextRole}? They will lose admin access immediately.`
      );
      if (!ok) return;
    }
    // Confirm admin promotion
    if (nextRole === 'admin' && row.role !== 'admin') {
      const ok = window.confirm(
        `Promote ${row.email ?? 'this user'} to admin? They will gain full administrative access, including user management.`
      );
      if (!ok) return;
    }
    setPendingId(row.user_id);
    const { error } = await (supabase.rpc as any)('admin_set_user_role', {
      _user_id: row.user_id,
      _role: nextRole,
    });
    setPendingId(null);
    if (error) {
      toast.error(error.message || 'Failed to update role');
      load();
      return;
    }
    toast.success(`Role updated to ${nextRole}`);
    load();
  };

  const updateActive = async (row: Row, nextActive: boolean) => {
    if (nextActive === row.is_active) return;
    if (!perms.isAdmin) return;
    if (row.user_id === selfId) {
      toast.error('You cannot change your own active status');
      return;
    }
    if (!nextActive) {
      const ok = window.confirm(
        `Deactivate ${row.email ?? 'this user'}? They will lose access immediately.`
      );
      if (!ok) return;
    }
    setPendingId(row.user_id);
    const { error } = await (supabase.rpc as any)('admin_set_user_active', {
      _user_id: row.user_id,
      _is_active: nextActive,
    });
    setPendingId(null);
    if (error) {
      toast.error(error.message || 'Failed to update status');
      load();
      return;
    }
    toast.success(nextActive ? 'User activated' : 'User deactivated');
    load();
  };

  const SortHeader = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className={`text-left font-medium px-4 py-2 ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
        >
          {label}
          <Icon className="h-3 w-3 opacity-60" />
        </button>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">User Management</h1>
            <p className="text-xs text-muted-foreground mt-1">Admin only</p>
          </div>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Back to map
          </Link>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1">
            <span className="text-muted-foreground">Total users</span>
            <span className="font-semibold tabular-nums">{summary.total}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1">
            <span className="text-muted-foreground">Active</span>
            <span className="font-semibold tabular-nums">{summary.active}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1">
            <span className="text-muted-foreground">Active admins</span>
            <span className="font-semibold tabular-nums text-primary">{summary.activeAdmins}</span>
          </span>
        </div>

        <div className="border border-border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <SortHeader label="Email" k="email" />
                <SortHeader label="Role" k="role" className="w-40" />
                <SortHeader label="Active" k="status" className="w-28" />
                <SortHeader label="Created" k="created" className="w-48" />
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
                const role = row.role ?? 'viewer';
                const isActive = !!row.is_active;
                return (
                  <tr
                    key={row.user_id}
                    className={`border-t border-border ${isSelf ? 'bg-muted/30' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.email ?? '—'}</span>
                        {isSelf && (
                          <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            You
                          </span>
                        )}
                      </div>
                      {isSelf && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          You cannot change your own admin access.
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className={isSelf ? 'opacity-60 cursor-not-allowed' : undefined} title={isSelf ? 'You cannot change your own role' : undefined}>
                        <Select
                          value={role}
                          onValueChange={(v) => updateRole(row, v as AppRole)}
                          disabled={busy || isSelf}
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
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div
                        className={`flex items-center gap-2 ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={isSelf ? 'You cannot change your own active status' : undefined}
                      >
                        <Switch
                          checked={isActive}
                          onCheckedChange={(v) => updateActive(row, v)}
                          disabled={busy || isSelf}
                        />
                        <span className="text-xs text-muted-foreground">
                          {isActive ? 'Active' : 'Inactive'}
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
          Deactivation takes effect immediately. The last active admin cannot be
          demoted or deactivated.
        </p>
      </div>
    </div>
  );
}
