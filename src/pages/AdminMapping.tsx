/**
 * Admin > Mapping landing page.
 *
 * Single source of truth for ingestion, mapping maintenance, verification,
 * and audit workflows. Each subsection has its own dedicated route.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Database, Brain, MapPin, ListChecks, History, Upload, Tag } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';

type CardStatus = 'active' | 'draft' | 'admin_only' | 'not_configured';

const STATUS_LABEL: Record<CardStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  admin_only: 'Admin Only',
  not_configured: 'Not Configured',
};

const STATUS_CLASS: Record<CardStatus, string> = {
  active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
  draft: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  admin_only: 'border-sky-500/50 bg-sky-500/10 text-sky-700',
  not_configured: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
};

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: CardStatus;
}

const ToolCard = ({ to, title, description, icon, status }: ToolCardProps) => (
  <Link
    to={to}
    className="group relative flex items-start gap-3 rounded border border-border bg-card p-4 pr-24 transition-colors hover:border-[hsl(var(--brand-health)/0.5)]"
  >
    {status ? (
      <span
        className={`absolute top-3 right-3 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
    ) : null}
    <div className="mt-0.5 text-muted-foreground group-hover:text-[hsl(var(--brand-health))]">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 font-medium text-sm">
        <span>{title}</span>
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
          status="active"
        />
        <ToolCard
          to="/admin/mapping/provider-metadata"
          title="Provider Metadata Enrichment"
          description="Attach imported/unverified metadata (phone, NPI, etc.) to existing providers. Never creates pins."
          icon={<Tag className="h-4 w-4" />}
        />
        <ToolCard
          to="/admin/mapping/services"
          title="Service Mapping"
          description="Community service and resource locations for the Services map layer."
          icon={<Database className="h-4 w-4" />}
          status="active"
        />
        <ToolCard
          to="/admin/mapping/behavioral-health"
          title="Behavioral Health Mapping"
          description="BH locations and resources for the Behavioral Health map layer."
          icon={<Brain className="h-4 w-4" />}
          status="active"
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
