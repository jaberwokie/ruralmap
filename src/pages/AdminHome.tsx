/**
 * Admin home (/admin) — directory of admin tools.
 *
 * The Mapping workspace is the canonical location for all data-writing,
 * ingestion, mapping maintenance, verification, and audit workflows.
 */

import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Layers, ListChecks, Users } from 'lucide-react';
import { usePermissions } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ToolCard = ({ to, title, description, icon }: ToolCardProps) => (
  <Link
    to={to}
    className="group flex items-start gap-3 rounded border border-border bg-card p-4 transition-colors hover:border-foreground/30"
  >
    <div className="mt-0.5 text-muted-foreground group-hover:text-foreground">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 font-medium">
        {title}
        <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  </Link>
);

export default function AdminHome() {
  const perms = usePermissions();

  if (perms.ready && !perms.isAdmin && !perms.isStaff) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: '#064f88' }}>Admin</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to Map</Link>
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ToolCard
            to="/admin/mapping"
            title="Mapping"
            description="Provider, service, and BH ingestion · verification queue · audit history · data import."
            icon={<Layers className="h-4 w-4" />}
          />
          <ToolCard
            to="/admin/users"
            title="User Management"
            description="View and manage user roles, activation status, and access."
            icon={<Users className="h-4 w-4" />}
          />
          <ToolCard
            to="/admin/unmapped-providers"
            title="Unmapped Top Utilized Providers"
            description="Review high-utilization billing providers not currently mapped."
            icon={<ListChecks className="h-4 w-4" />}
          />
          <ToolCard
            to="/admin/training"
            title="Staff Training"
            description="Rural Map + Decision Assist training packet. Review on screen and download as .docx or PDF."
            icon={<BookOpen className="h-4 w-4" />}
          />
        </div>
      </div>
    </div>
  );
}
