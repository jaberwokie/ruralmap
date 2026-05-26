/**
 * Lightweight client-side metrics logger.
 *
 * Inserts a row into public.user_events for the currently authenticated user.
 * Silently no-ops when:
 *  - no user is signed in
 *  - the insert fails (network, RLS, schema)
 *
 * Role is held in a module-level cache populated by MetricsTracker
 * (mounted in App.tsx). This avoids any per-call role lookup.
 */

import { supabase } from '@/integrations/supabase/client';

type Role = 'viewer' | 'staff' | 'admin';

let currentRole: Role = 'viewer';
let currentUserId: string | null = null;

export const setMetricsIdentity = (userId: string | null, role: Role) => {
  currentUserId = userId;
  currentRole = role;
};

export type UserEventType =
  | 'session_start'
  | 'county_selected'
  | 'address_searched'
  | 'pill_mode_changed'
  | 'detail_section_expanded'
  | 'provider_viewed'
  | 'directory_searched'
  | 'chw_note_added'
  | 'attempted_contact_marked'
  | 'backup_option_clicked'
  | 'overlay_toggled';

export const logEvent = (
  event_type: UserEventType,
  event_detail: Record<string, unknown> = {},
): void => {
  if (!currentUserId) return;
  // Fire-and-forget; never block UI.
  void supabase
    .from('user_events')
    .insert({
      user_id: currentUserId,
      user_role: currentRole,
      event_type,
      event_detail,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[metrics] insert failed', event_type, error);
      }
    });
};
