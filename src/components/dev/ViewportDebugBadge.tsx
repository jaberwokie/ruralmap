/**
 * ViewportDebugBadge — preview/dev-only responsive breakpoint indicator.
 *
 * Renders a small fixed badge (bottom-right) showing:
 *  - live window.innerWidth × innerHeight
 *  - derived responsive mode (mobile / tablet-laptop / desktop)
 *  - current useIsMobile() value
 *  - whether MobileEntry is mounted (passed in by Index)
 *
 * Gated off on the published production hostnames so it never ships to users.
 */

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsTablet } from '@/hooks/use-tablet';

const PRODUCTION_HOSTS = new Set([
  'ruralmap.lovable.app',
  'ruralmap.opsframe.io',
]);

function isPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname;
  if (PRODUCTION_HOSTS.has(host)) return false;
  // Allow Lovable preview/sandbox hostnames and localhost.
  return (
    host === 'localhost' ||
    host.endsWith('.lovable.app') ||
    host.endsWith('.lovable.dev')
  );
}

interface Props {
  mobileEntryMounted: boolean;
}

const ViewportDebugBadge = ({ mobileEntryMounted }: Props) => {
  const enabled = isPreviewEnvironment();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [size, setSize] = useState(() =>
    typeof window === 'undefined'
      ? { w: 0, h: 0 }
      : { w: window.innerWidth, h: window.innerHeight },
  );

  useEffect(() => {
    if (!enabled) return;
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  if (!enabled) return null;

  const mode =
    size.w < 768 ? 'mobile' : size.w < 1024 ? 'tablet' : 'laptop/desktop';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 9999,
        background: 'rgba(15,23,42,0.85)',
        color: '#e2e8f0',
        font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: '6px 8px',
        borderRadius: 6,
        lineHeight: 1.35,
        pointerEvents: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}
      aria-hidden="true"
    >
      <div>{size.w}×{size.h} · {mode}</div>
      <div>useIsMobile: {String(isMobile)}</div>
      <div>useIsTablet: {String(isTablet)}</div>
      <div>MobileEntry: {mobileEntryMounted ? 'yes' : 'no'}</div>
    </div>
  );
};

export default ViewportDebugBadge;
