/**
 * Centralized auth + role state.
 *
 * Defaults to a read-only "viewer" experience whenever:
 *  - the user is not signed in,
 *  - the session is unresolved / loading,
 *  - the role lookup fails or returns nothing,
 *  - any error is thrown along the way.
 *
 * Permissions are derived from the highest active role on `public.user_roles`
 * via the `current_user_role()` security-definer function. UI gating uses
 * these flags, but every write handler is also expected to re-check them
 * before mutating state.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'viewer' | 'staff' | 'admin';

export interface Permissions {
  /** True only after auth state has been resolved at least once. */
  ready: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  /** Convenience flags used by UI gating + handler guards. */
  canImportData: boolean;
  canApplyVerification: boolean;
  canEditMapData: boolean;
  signOut: () => Promise<void>;
}

const DEFAULT_PERMISSIONS: Permissions = {
  ready: false,
  session: null,
  user: null,
  role: 'viewer',
  isAuthenticated: false,
  isAdmin: false,
  isStaff: false,
  canImportData: false,
  canApplyVerification: false,
  canEditMapData: false,
  signOut: async () => {},
};

const AuthContext = createContext<Permissions>(DEFAULT_PERMISSIONS);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>('viewer');
  const [ready, setReady] = useState(false);

  // Fetch role for a signed-in user. Defaults to viewer on any failure.
  const refreshRole = async (uid: string | null | undefined) => {
    if (!uid) {
      setRole('viewer');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('current_user_role');
      if (error) {
        console.warn('[auth] current_user_role failed; defaulting to viewer', error);
        setRole('viewer');
        return;
      }
      const value = (data as AppRole | null) ?? 'viewer';
      setRole(value === 'admin' || value === 'staff' ? value : 'viewer');
    } catch (e) {
      console.warn('[auth] role lookup threw; defaulting to viewer', e);
      setRole('viewer');
    }
  };

  useEffect(() => {
    // Set up listener BEFORE getSession to avoid missing the first event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      // Defer role fetch so we don't block the auth callback.
      if (nextSession?.user) {
        setTimeout(() => { refreshRole(nextSession.user.id); }, 0);
      } else {
        setRole('viewer');
      }
      setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        refreshRole(existing.user.id);
      }
      setReady(true);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<Permissions>(() => {
    const isAdmin = role === 'admin';
    const isStaff = role === 'staff';
    return {
      ready,
      session,
      user: session?.user ?? null,
      role,
      isAuthenticated: !!session?.user,
      isAdmin,
      isStaff,
      // Currently only admins get write access. Staff can be granted later.
      canImportData: isAdmin,
      canApplyVerification: isAdmin,
      canEditMapData: isAdmin,
      signOut: async () => { await supabase.auth.signOut(); },
    };
  }, [ready, session, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Read the current permission set. Safe to call anywhere inside `<AuthProvider>`.
 * Defaults to read-only when used outside the provider.
 */
export const usePermissions = (): Permissions => useContext(AuthContext);
