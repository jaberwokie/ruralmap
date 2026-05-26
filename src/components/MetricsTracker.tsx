/**
 * Bridges AuthContext → metrics module.
 *
 * - Pushes (userId, role) into the metrics identity cache so logEvent() can
 *   stamp every row without an extra RPC.
 * - Emits a single `session_start` event the first time we see an
 *   authenticated user in this browser tab.
 *
 * Renders nothing. Mount once near the AuthProvider in App.tsx.
 */

import { useEffect, useRef } from 'react';
import { usePermissions } from '@/contexts/AuthContext';
import { logEvent, setMetricsIdentity } from '@/lib/metrics/logEvent';

const MetricsTracker = () => {
  const { ready, user, role } = usePermissions();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const uid = user?.id ?? null;
    setMetricsIdentity(uid, role);
    if (uid && lastUserIdRef.current !== uid) {
      lastUserIdRef.current = uid;
      logEvent('session_start', { role });
    }
    if (!uid) lastUserIdRef.current = null;
  }, [ready, user?.id, role]);

  return null;
};

export default MetricsTracker;
