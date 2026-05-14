/**
 * Shared layout shell for all Admin > Mapping pages.
 *
 * Provides:
 *  - Consistent header (breadcrumb back to /admin/mapping, page title)
 *  - Subnav with the canonical Mapping module list
 *  - Admin-only gating (redirects non-admins to /)
 *  - Same NovumHealth visual language across desktop/tablet/mobile
 */

import { Link, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MappingNavItem {
  to: string;
  label: string;
}

export const MAPPING_NAV: MappingNavItem[] = [
  { to: '/admin/mapping', label: 'Overview' },
  { to: '/admin/mapping/providers', label: 'Provider Mapping' },
  { to: '/admin/mapping/provider-metadata', label: 'Provider Metadata' },
  { to: '/admin/mapping/services', label: 'Service Mapping' },
  { to: '/admin/mapping/behavioral-health', label: 'Behavioral Health' },
  { to: '/admin/mapping/verification-queue', label: 'Verification Queue' },
  { to: '/admin/mapping/audit-history', label: 'Audit History' },
  { to: '/admin/mapping/pipeline-audit', label: 'Pipeline Audit' },
  { to: '/admin/mapping/import', label: 'Data Import' },
  { to: '/admin/mapping/facilities', label: 'Facilities' },
  { to: '/admin/mapping/rural-services', label: 'Rural Services' },
];

interface AdminMappingLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AdminMappingLayout({ title, description, children }: AdminMappingLayoutProps) {
  const perms = usePermissions();
  const location = useLocation();

  if (perms.ready && !perms.isAdmin && !perms.isStaff) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Link>
              </Button>
              <span className="text-muted-foreground text-sm">/</span>
              <Link
                to="/admin/mapping"
                className="text-sm font-semibold tracking-tight"
                style={{ color: '#064f88' }}
              >
                Mapping
              </Link>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Back to Map</Link>
            </Button>
          </div>

          {/* Subnav — horizontal scroll on small screens */}
          <nav className="mt-3 -mx-1 flex gap-1 overflow-x-auto pb-1">
            {MAPPING_NAV.map((item) => {
              const active =
                item.to === '/admin/mapping'
                  ? location.pathname === '/admin/mapping'
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-[hsl(var(--brand-health))] bg-[hsl(var(--brand-health)/0.08)] text-[hsl(var(--brand-health))]'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}
