/** No organization-specific response staffing is included in the independent edition. */
import type { MemberPointContext } from '@/utils/engagementOwnership';

interface EngagementOwnershipBlockProps {
  county: string | null | undefined;
  /** Compact rendering for tight panels (e.g. member panel). */
  compact?: boolean;
  /** Optional member point — when set, in-person availability is derived
   *  from the same active FTE fixed-distance polygon rendered by the teal
   *  coverage layer instead of the county rollup. */
  memberPoint?: MemberPointContext | null;
}

/**
 * Staffing coverage is unconfigured for a new implementation.
 * Never display an assigned CHW or guaranteed telehealth/in-person availability.
 */
const EngagementOwnershipBlock = ({ county, compact = false }: EngagementOwnershipBlockProps) => {
  if (!county) return null;
  return (
    <div className={`rounded-md border border-border bg-secondary/30 px-2 py-1.5 ${compact ? '' : 'mb-2'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground">Staffing availability unverified</p>
      <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
        No organization-specific field or remote staffing data is configured. Confirm response capacity directly before arranging services.
      </p>
    </div>
  );
};

export default EngagementOwnershipBlock;
