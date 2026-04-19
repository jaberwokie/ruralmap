/**
 * Admin > Mapping landing page.
 *
 * Single source of truth for ingestion, mapping maintenance, verification,
 * and audit workflows. Each subsection has its own dedicated route.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Database, Brain, MapPin, ListChecks, History, Upload } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: 'active' | 'pending';
}

const ToolCard = ({ to, title, description, icon, status = 'active' }: ToolCardProps) => (
  <Link
    to={to}
    className="group flex items-start gap-3 rounded border border-border bg-card p-4 transition-colors hover:border-[hsl(var(--brand-health)/0.5)]"
  >
    <div className="mt-0.5 text-muted-foreground group-hover:text-[hsl(var(--brand-health))]">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 font-medium text-sm">
        <span>{title}</span>
        {status === 'pending' ? (
          <span className="rounded border border-[hsl(var(--brand-health)/0.4)] bg-[hsl(var(--brand-health)/0.06)] px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--brand-health))]">
            Pipeline pending
          </span>
        ) : null}
        <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  </Link>
);

export default function AdminMapping() {
  return (
    <AdminMappingLayout
      title="Mapping"
      description="All ingestion, mapping maintenance, verification, and audit workflows live here. The main map sidebar is read-only — every write action runs from this workspace."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <ToolCard
          to="/admin/mapping/providers"
          title="Provider Mapping"
          description="Upload verified provider/facility locations using the verified_* schema."
          icon={<MapPin className="h-4 w-4" />}
        />
        <ToolCard
          to="/admin/mapping/services"
          title="Service Mapping"
          description="Community service and resource locations for the Services map layer."
          icon={<Database className="h-4 w-4" />}
          status="pending"
        />
        <ToolCard
          to="/admin/mapping/behavioral-health"
          title="Behavioral Health Mapping"
          description="BH locations and resources for the Behavioral Health map layer."
          icon={<Brain className="h-4 w-4" />}
          status="pending"
        />
        <ToolCard
          to="/admin/mapping/verification-queue"
          title="Verification Priority Queue"
          description="Outreach workflow, apply verification, and queue triage."
          icon={<ListChecks className="h-4 w-4" />}
        />
        <ToolCard
          to="/admin/mapping/audit-history"
          title="Verification Audit History"
          description="Full history of verification actions and entity changes."
          icon={<History className="h-4 w-4" />}
        />
        <ToolCard
          to="/admin/mapping/import"
          title="Data Import"
          description="Unified ingestion intake — pick a type, see its schema, then upload."
          icon={<Upload className="h-4 w-4" />}
        />
      </div>
    </AdminMappingLayout>
  );
}
