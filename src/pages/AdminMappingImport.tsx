/**
 * Admin > Mapping > Data Import (unified intake).
 *
 * Hard gate: user must pick an ingestion type before any upload UI shows.
 * Each option deep-links into its module so we never render a generic
 * one-size-fits-all upload zone.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Database, Brain } from 'lucide-react';
import AdminMappingLayout from '@/components/admin/AdminMappingLayout';
import { MappingStatusChip } from '@/components/admin/MappingStatusChip';
import type { MappingPipelineKey } from '@/config/mappingPipelineStatus';

interface PickerCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  pipelineKey: MappingPipelineKey;
}

const PickerCard = ({ to, title, description, icon, pipelineKey }: PickerCardProps) => (
  <Link
    to={to}
    className="group flex flex-col gap-2 rounded border border-border bg-card p-4 transition-colors hover:border-[hsl(var(--brand-health)/0.5)]"
  >
    <div className="flex items-center gap-2 text-muted-foreground group-hover:text-[hsl(var(--brand-health))]">
      {icon}
      <span className="font-medium text-sm text-foreground">{title}</span>
      <MappingStatusChip pipeline={pipelineKey} compact />
      <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
    </div>
    <p className="text-xs text-muted-foreground">{description}</p>
  </Link>
);

export default function AdminMappingImport() {
  return (
    <AdminMappingLayout
      title="Data Import"
      description="Pick an ingestion type. Each module shows its required schema, accepted aliases, validation rules, and a sample before any file is accepted."
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <PickerCard
          to="/admin/mapping/providers"
          title="Provider Locations"
          description="Verified provider/facility service locations using verified_* schema."
          icon={<MapPin className="h-4 w-4" />}
          pipelineKey="provider_mapping"
        />
        <PickerCard
          to="/admin/mapping/services"
          title="Services"
          description="Community services and resources for the Services map layer."
          icon={<Database className="h-4 w-4" />}
          pipelineKey="services"
        />
        <PickerCard
          to="/admin/mapping/behavioral-health"
          title="Behavioral Health"
          description="BH facilities and resources for the Behavioral Health map layer."
          icon={<Brain className="h-4 w-4" />}
          pipelineKey="behavioral_health"
        />
      </div>

      <div className="mt-4 rounded border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Why type-first
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Each ingestion type has its own schema and validation rules.</li>
          <li>A generic "name, lat, lng" upload zone causes ambiguity and dirty data.</li>
          <li>Choosing a type first guarantees the file routes into the correct pipeline.</li>
        </ul>
      </div>
    </AdminMappingLayout>
  );
}
