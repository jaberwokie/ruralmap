/**
 * Admin > Mapping landing page.
 *
 * Single source of truth for ingestion, mapping maintenance, verification,
 * and audit workflows. Each subsection has its own dedicated route.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database, Brain, MapPin, ListChecks, History, Upload, Tag } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { MappingStatusChip } from '@/components/admin/MappingStatusChip';
import type { MappingPipelineKey } from '@/config/mappingPipelineStatus';
import { getEnrichmentAudit, subscribeToEnrichment, getEnrichmentRecords } from '@/utils/providerEnrichmentStore';
import { getAuditLog } from '@/utils/verificationAuditLog';

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'No recent activity';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No recent activity';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Last activity: just now';
  if (mins < 60) return `Last activity: ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last activity: ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Last activity: Yesterday';
  if (days < 7) return `Last activity: ${days}d ago`;
  const d = new Date(iso);
  return `Last activity: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  pipelineKey: MappingPipelineKey;
  footer?: string;
}

const ToolCard = ({ to, title, description, icon, pipelineKey, footer }: ToolCardProps) => (
  <Link
    to={to}
    className="group relative flex items-start gap-3 rounded border border-border bg-card p-4 pr-24 transition-colors hover:border-[hsl(var(--brand-health)/0.5)]"
  >
    <span className="absolute top-3 right-3">
      <MappingStatusChip pipeline={pipelineKey} compact />
    </span>
    <div className="mt-0.5 text-muted-foreground group-hover:text-[hsl(var(--brand-health))]">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 font-medium text-sm">
        <span>{title}</span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {footer ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">{footer}</p>
      ) : null}
    </div>
  </Link>
);

function useEnrichmentLastActivity(): string | null {
  const [iso, setIso] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const audit = getEnrichmentAudit();
      if (audit.length > 0) {
        setIso(audit[0].timestamp);
        return;
      }
      const records = Object.values(getEnrichmentRecords());
      if (records.length === 0) { setIso(null); return; }
      const latest = records.reduce<string | null>((acc, r) => {
        if (!acc) return r.enrichment_imported_at;
        return r.enrichment_imported_at > acc ? r.enrichment_imported_at : acc;
      }, null);
      setIso(latest);
    };
    compute();
    return subscribeToEnrichment(compute);
  }, []);
  return iso;
}

function useVerificationLastActivity(): string | null {
  const [iso, setIso] = useState<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const log = getAuditLog();
      if (log.length === 0) { setIso(null); return; }
      const latest = log.reduce<string>(
        (acc, r) => (r.applied_date > acc ? r.applied_date : acc),
        log[0].applied_date,
      );
      setIso(latest);
    };
    compute();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nbh_verification_audit_log') compute();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return iso;
}

export default function AdminMapping() {
  const enrichmentActivity = useEnrichmentLastActivity();
  const verificationActivity = useVerificationLastActivity();

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
          pipelineKey="provider_mapping"
        />
        <ToolCard
          to="/admin/mapping/provider-metadata"
          title="Provider Metadata Enrichment"
          description="Attach imported/unverified metadata (phone, NPI, etc.) to existing providers. Never creates pins."
          icon={<Tag className="h-4 w-4" />}
          pipelineKey="provider_metadata"
          footer={formatRelative(enrichmentActivity)}
        />
        <ToolCard
          to="/admin/mapping/services"
          title="Service Mapping"
          description="Community service and resource locations for the Services map layer."
          icon={<Database className="h-4 w-4" />}
          pipelineKey="services"
        />
        <ToolCard
          to="/admin/mapping/behavioral-health"
          title="Behavioral Health Mapping"
          description="BH locations and resources for the Behavioral Health map layer."
          icon={<Brain className="h-4 w-4" />}
          pipelineKey="behavioral_health"
        />
        <ToolCard
          to="/admin/mapping/verification-queue"
          title="Verification Priority Queue"
          description="Outreach workflow, apply verification, and queue triage."
          icon={<ListChecks className="h-4 w-4" />}
          pipelineKey="verification_queue"
          footer={formatRelative(verificationActivity)}
        />
        <ToolCard
          to="/admin/mapping/audit-history"
          title="Verification Audit History"
          description="Full history of verification actions and entity changes."
          icon={<History className="h-4 w-4" />}
          pipelineKey="audit_history"
        />
        <ToolCard
          to="/admin/mapping/import"
          title="Data Import"
          description="Unified ingestion intake — pick a type, see its schema, then upload."
          icon={<Upload className="h-4 w-4" />}
          pipelineKey="data_import"
        />
      </div>
    </AdminMappingLayout>
  );
}
