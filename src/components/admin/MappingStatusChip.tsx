/**
 * MappingStatusChip — single source of visual truth for pipeline status
 * chips across Admin → Mapping. Always reads from
 * src/config/mappingPipelineStatus.ts via a pipeline key.
 *
 * Variants:
 *   - default: standard chip
 *   - compact: tighter padding for tight headers / tabs
 *   - withNote: chip + inline note text (when space allows)
 *
 * Tooltip is always wired via native `title` so the note is recoverable
 * even in compact mode.
 */

import { cn } from '@/lib/utils';
import {
  getMappingPipelineStatus,
  type MappingPipelineKey,
  type MappingPipelineStatus,
} from '@/config/mappingPipelineStatus';

const STATUS_CLASS: Record<MappingPipelineStatus, string> = {
  active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
  active_limited: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
  draft: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  pending: 'border-amber-500/50 bg-amber-500/10 text-amber-700',
  disabled: 'border-muted-foreground/40 bg-muted/40 text-muted-foreground',
};

interface MappingStatusChipProps {
  pipeline: MappingPipelineKey;
  /** Tighter padding for headers/tabs. */
  compact?: boolean;
  /** Show inline note text next to the chip when present. */
  showNote?: boolean;
  className?: string;
}

export const MappingStatusChip = ({
  pipeline,
  compact = false,
  showNote = false,
  className,
}: MappingStatusChipProps) => {
  const entry = getMappingPipelineStatus(pipeline);
  const tooltip = entry.tooltip ?? entry.note;

  const chip = (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center rounded border font-medium uppercase tracking-wider',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10px]',
        STATUS_CLASS[entry.status],
      )}
    >
      {entry.label}
    </span>
  );

  if (!showNote || !entry.note) return <span className={className}>{chip}</span>;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {chip}
      <span className="text-[11px] text-muted-foreground" title={tooltip}>
        {entry.note}
      </span>
    </span>
  );
};

export default MappingStatusChip;
