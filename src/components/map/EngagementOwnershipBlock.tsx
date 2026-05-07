/**
 * EngagementOwnershipBlock
 *
 * Display-only ownership summary derived from FTE field coverage.
 * Two states (no third "No CHW Coverage" state):
 *   - Primary CHW Coverage  → county has at least one field FTE (hubLocation !== null)
 *   - Remote CHW Coverage   → county has no field FTE; remote CHW owns telehealth
 *
 * Does NOT change scoring, layers, filters, or assignment logic.
 */

import { CheckCircle2, AlertTriangle, Headphones } from 'lucide-react';
import { getEngagementOwnership } from '@/utils/engagementOwnership';

interface EngagementOwnershipBlockProps {
  county: string | null | undefined;
  /** Compact rendering for tight panels (e.g. member panel). */
  compact?: boolean;
}

const REMOTE_NOTE =
  'Telehealth engagement is handled by the assigned CHW for this region. Remote CHWs may support but do not replace assigned coverage.';

const Row = ({
  label,
  value,
  positive,
  negative,
  icon: Icon,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  icon?: typeof CheckCircle2;
}) => (
  <div className="flex items-center justify-between gap-2 text-[11px]">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={`inline-flex items-center gap-1 font-semibold ${
        positive
          ? 'text-staffing-high'
          : negative
          ? 'text-destructive'
          : 'text-foreground'
      }`}
    >
      {Icon ? <Icon className="w-3 h-3 flex-shrink-0" /> : null}
      {value}
    </span>
  </div>
);

const EngagementOwnershipBlock = ({ county, compact = false }: EngagementOwnershipBlockProps) => {
  if (!county) return null;
  const isPrimary = countyHasFieldCoverage(county);

  const headerLabel = isPrimary ? 'Primary CHW Coverage' : 'Remote CHW Coverage';

  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        isPrimary
          ? 'border-staffing-high/30 bg-staffing-high/5'
          : 'border-border bg-secondary/50'
      } ${compact ? '' : 'mb-2'}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {isPrimary ? (
          <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-staffing-high" />
        ) : (
          <Headphones className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">
          Engagement Ownership
        </span>
        <span
          className={`ml-auto text-[10px] font-semibold ${
            isPrimary ? 'text-staffing-high' : 'text-foreground'
          }`}
        >
          {headerLabel}
        </span>
      </div>

      <div className="space-y-0.5">
        <Row
          label="In-Person Engagement"
          value={isPrimary ? 'Available' : 'Not Available'}
          positive={isPrimary}
          negative={!isPrimary}
          icon={isPrimary ? CheckCircle2 : AlertTriangle}
        />
        <Row
          label="Telehealth Engagement"
          value={isPrimary ? 'Available (Primary)' : 'Available (Remote CHW)'}
          positive
        />
      </div>

      {!isPrimary && (
        <p className="mt-1 text-[10px] text-muted-foreground italic leading-snug">
          {REMOTE_NOTE}
        </p>
      )}
    </div>
  );
};

export default EngagementOwnershipBlock;
