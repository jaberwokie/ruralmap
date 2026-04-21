/**
 * Admin-only build/version label.
 *
 * Renders nothing for non-admin users (returns null — not in DOM).
 * Reads version from `__APP_VERSION__` (set via Vite `define` from
 * `VITE_APP_VERSION`) and falls back to `__APP_BUILD_TIME__`.
 */
import { usePermissions } from '@/contexts/AuthContext';

interface AdminVersionBadgeProps {
  className?: string;
}

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
};

export const AdminVersionBadge = ({ className = '' }: AdminVersionBadgeProps) => {
  const { isAdmin } = usePermissions();
  if (!isAdmin) return null;

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  const buildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';
  const dateStr = buildTime ? formatDate(buildTime) : '';

  const label = version
    ? `v${version}${dateStr ? ` • ${dateStr}` : ''}`
    : dateStr
      ? `build ${dateStr}`
      : 'build dev';

  return (
    <span className={`text-[10px] text-muted-foreground tabular-nums leading-none ${className}`}>
      {label}
    </span>
  );
};

export default AdminVersionBadge;
