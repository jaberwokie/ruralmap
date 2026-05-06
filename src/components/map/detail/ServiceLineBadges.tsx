import {
  resolvePsychiatryBadge, resolveInpatientBadge,
  hasPsychiatricData, hasInpatientData,
  PSYCHIATRY_BADGE_COLORS, INPATIENT_BADGE_COLORS,
} from '@/types/service-lines';

export const PsychiatryBadge = ({ fields }: { fields?: Partial<import('@/types/service-lines').PsychiatricServiceFields> | null }) => {
  if (!hasPsychiatricData(fields)) return null;
  const badge = resolvePsychiatryBadge(fields);
  const colors = PSYCHIATRY_BADGE_COLORS[badge];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${colors.bg} ${colors.text}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {badge}
    </span>
  );
};

export const InpatientBadge = ({ fields }: { fields?: Partial<import('@/types/service-lines').InpatientServiceFields> | null }) => {
  if (!hasInpatientData(fields)) return null;
  const badge = resolveInpatientBadge(fields);
  const colors = INPATIENT_BADGE_COLORS[badge];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${colors.bg} ${colors.text}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {badge}
    </span>
  );
};
