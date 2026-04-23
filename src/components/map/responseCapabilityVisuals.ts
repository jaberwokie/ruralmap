import type { CountyCoverageBreakdown } from '@/utils/coverageZones';

export type ResponseCapabilityCategory = 'active' | 'scheduled' | 'remote';

export const RESPONSE_CAPABILITY_META: Record<ResponseCapabilityCategory, {
  label: string;
  description: string;
  markerSize: number;
  titleClassName: string;
}> = {
  active: {
    label: 'Same-Day Field Response Available',
    description: 'In-person response is feasible within current FTE drive-time reach.',
    markerSize: 18,
    titleClassName: 'text-foreground/85',
  },
  scheduled: {
    label: 'Field Response Available (Planned)',
    description: 'In-person response may be possible, but requires scheduling, batching, or extended travel.',
    markerSize: 16,
    titleClassName: 'text-foreground/72',
  },
  remote: {
    label: 'Remote Support Only',
    description: 'No realistic in-person response under current FTE positioning and travel thresholds.',
    markerSize: 14,
    titleClassName: 'text-foreground/60',
  },
};

export const getResponseCapabilityCategory = (breakdown: CountyCoverageBreakdown): ResponseCapabilityCategory => {
  // Single source of truth: the geometric breakdown's own classification.
  // Active = same-day field, Scheduled = planned outreach, Remote = no field.
  return breakdown.primaryType;
};

export const getResponseCapabilityMarkerHtml = (
  category: ResponseCapabilityCategory,
  hovered = false,
) => {
  const size = RESPONSE_CAPABILITY_META[category].markerSize + (hovered ? 2 : 0);
  const shadowStrength = hovered ? '0.34' : '0.22';

  if (category === 'active') {
    return `
      <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--response-active));border:2px solid hsl(var(--background));box-shadow:0 0 0 2px hsl(var(--response-active) / 0.22),0 2px 10px hsl(var(--response-active) / ${shadowStrength});">
        <div style="width:${Math.max(size - 10, 5)}px;height:${Math.max(size - 10, 5)}px;border-radius:9999px;background:hsl(var(--background) / 0.18);"></div>
      </div>
    `.trim();
  }

  if (category === 'scheduled') {
    return `
      <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--background));border:2.5px solid hsl(var(--response-scheduled));box-shadow:0 0 0 1px hsl(var(--background)),0 2px 8px hsl(var(--response-scheduled) / ${shadowStrength});">
        <div style="width:${Math.max(size - 10, 5)}px;height:${Math.max(size - 10, 5)}px;border-radius:9999px;background:hsl(var(--response-scheduled) / 0.2);border:1.5px solid hsl(var(--response-scheduled));"></div>
      </div>
    `.trim();
  }

  return `
    <div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:hsl(var(--response-remote) / 0.28);border:2px solid hsl(var(--response-remote));box-shadow:0 0 0 1px hsl(var(--background)),0 1px 6px hsl(var(--response-remote) / ${hovered ? '0.26' : '0.18'});">
      <div style="width:${Math.max(size - 8, 5)}px;height:${Math.max(size - 8, 5)}px;border-radius:9999px;background:hsl(var(--response-remote));opacity:0.72;"></div>
    </div>
  `.trim();
};
