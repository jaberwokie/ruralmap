/**
 * Shared layout shell for all /ops pages.
 *
 * Provides:
 *  - Consistent header (breadcrumb back to /ops, Back to Map button)
 *  - Admin + Ops gating (redirects others to /)
 *
 * Modeled after AdminMappingLayout.tsx but for the Field Ops surface.
 */

import { Link, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface OpsLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function OpsLayout({ title, description, children }: OpsLayoutProps) {
  const perms = usePermissions();

  if (perms.ready && !perms.isAdmin && !perms.isOps) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Map</Link>
              </Button>
              <span className="text-muted-foreground text-sm">/</span>
              <Link
                to="/ops"
                className="text-sm font-semibold tracking-tight"
                style={{ color: '#064f88' }}
              >
                Field Ops
              </Link>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Back to Map</Link>
            </Button>
          </div>
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
