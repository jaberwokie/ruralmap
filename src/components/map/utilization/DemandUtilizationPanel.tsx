/**
 * Demand & Utilization sidebar section.
 * - 4 independent toggles, all default OFF.
 * - When "Member Demand (ZIP)" is on AND no ZIP polygons are loaded on the map,
 *   shows a fallback list grouped by county. List rows follow the SAME interaction
 *   model as the existing Transit Providers list.
 * - ZIP detail is rendered inline (popover) inside this section. ZIP click is
 *   isolated and never enters the MapEntity selection pipeline.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Activity, BarChart3, Layers3, Landmark, type LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { LayerState } from '@/types/layers';
import { useUtilizationData } from '@/hooks/useUtilizationData';

interface Props {
  layers: LayerState;
  onToggleLayer: (key: keyof LayerState) => void;
}

const ROW_CLASS =
  'group flex min-h-8 items-center gap-2.5 rounded-md border border-transparent px-2 py-1 transition-colors duration-150 hover:border-border/70 hover:bg-secondary/70';

const ToggleRow = ({
  label,
  checked,
  onCheckedChange,
  icon: Icon,
  iconClass,
  subtitle,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  icon: LucideIcon;
  iconClass: string;
  subtitle?: string;
}) => (
  <div className={ROW_CLASS}>
    <Icon className={`h-3.5 w-3.5 stroke-[1.75] flex-shrink-0 ${iconClass}`} />
    <div className="flex-1 min-w-0">
      <div className="text-[12px] leading-tight text-foreground">{label}</div>
      {subtitle && (
        <div className="text-[9px] leading-tight text-muted-foreground/80">{subtitle}</div>
      )}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const SECTION_HEADER_CLASSNAME =
  'flex w-full items-center gap-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground';

const DemandUtilizationPanel = ({ layers, onToggleLayer }: Props) => {
  const [open, setOpen] = useState(false);
  const anyOn =
    layers.memberDemandZip ||
    layers.countyUtilization ||
    layers.providerUtilizationReach ||
    layers.tribalUtilization;

  const { data, loading } = useUtilizationData(anyOn);

  // Fallback list (no ZIP polygons in repo): group by county for quick scanning.
  // Same interaction pattern as existing sidebar lists (button rows).
  const [expandedCounty, setExpandedCounty] = useState<string | null>(null);
  const [openZip, setOpenZip] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ county: string; rows: typeof data.zipDemand; total: number }>;
    const out: Array<{ county: string; rows: typeof data.zipDemand; total: number }> = [];
    for (const [county, rows] of data.indices.zipDemandByCounty) {
      out.push({ county, rows, total: rows.reduce((a, b) => a + b.memberCount, 0) });
    }
    out.sort((a, b) => b.total - a.total);
    return out;
  }, [data]);

  return (
    <div data-tutorial="section-demand-utilization">
      <button type="button" onClick={() => setOpen((v) => !v)} className={SECTION_HEADER_CLASSNAME}>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        DEMAND &amp; UTILIZATION
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          <ToggleRow
            label="Member Demand (ZIP)"
            checked={layers.memberDemandZip}
            onCheckedChange={() => onToggleLayer('memberDemandZip')}
            icon={Layers3}
            iconClass="text-muted-foreground"
            subtitle="ZIP-level member counts"
          />
          {layers.memberDemandZip && (
            <div className="ml-2 mr-1 rounded-md border border-border bg-secondary/30 px-2 py-1.5">
              {loading && (
                <div className="text-[10px] text-muted-foreground">Loading demand data…</div>
              )}
              {data && grouped.length === 0 && (
                <div className="text-[10px] text-muted-foreground">No ZIP demand data available.</div>
              )}
              {data && grouped.length > 0 && (
                <>
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                    By County
                  </div>
                  <ul className="space-y-0.5">
                    {grouped.map((g) => {
                      const isOpen = expandedCounty === g.county;
                      return (
                        <li key={g.county}>
                          <button
                            type="button"
                            onClick={() => setExpandedCounty(isOpen ? null : g.county)}
                            className="w-full rounded-sm px-1.5 py-1 text-left text-[11px] leading-tight text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center gap-1.5"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate flex-1">{g.county}</span>
                            <span className="flex-shrink-0 rounded bg-secondary text-foreground/80 px-1 py-px text-[8px] font-medium uppercase tracking-wide tabular-nums">
                              {Math.round(g.total).toLocaleString()}
                            </span>
                          </button>
                          {isOpen && (
                            <ul className="ml-4 mt-0.5 space-y-0.5">
                              {g.rows.map((r) => {
                                const detailOpen = openZip === r.zip;
                                const rollup = data.indices.zipRollupByZip.get(r.zip) ?? [];
                                const top3 = rollup.slice(0, 3);
                                const tribalActive = data.indices.zipsWithTribalActivity.has(r.zip);
                                return (
                                  <li key={r.zip}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenZip(detailOpen ? null : r.zip)}
                                      className="w-full rounded-sm px-1.5 py-0.5 text-left text-[10px] leading-tight text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center gap-1.5"
                                    >
                                      <span className="truncate flex-1 tabular-nums">{r.zip}</span>
                                      <span className="flex-shrink-0 text-muted-foreground tabular-nums">
                                        {Math.round(r.memberCount)}
                                      </span>
                                    </button>
                                    {detailOpen && (
                                      <div className="mt-0.5 ml-2 rounded-sm border border-border/70 bg-background/70 px-1.5 py-1">
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                                          <span className="text-muted-foreground">ZIP</span>
                                          <span className="text-right tabular-nums">{r.zip}</span>
                                          <span className="text-muted-foreground">County</span>
                                          <span className="text-right">{r.county}</span>
                                          <span className="text-muted-foreground">Members</span>
                                          <span className="text-right tabular-nums">{Math.round(r.memberCount)}</span>
                                          <span className="text-muted-foreground">Tribal Provider Activity</span>
                                          <span className="text-right">{tribalActive ? 'Yes' : 'No'}</span>
                                        </div>
                                        {top3.length > 0 && (
                                          <div className="mt-1 border-t border-border/60 pt-1">
                                            <div className="mb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/80">
                                              Top Providers
                                            </div>
                                            <ul className="space-y-0.5">
                                              {top3.map((p, i) => (
                                                <li
                                                  key={`${p.providerKey}-${i}`}
                                                  className="flex items-baseline justify-between gap-2"
                                                >
                                                  <span className="truncate text-[10px] text-foreground">
                                                    {p.providerName}
                                                  </span>
                                                  <span className="flex-shrink-0 text-[9px] text-muted-foreground tabular-nums">
                                                    {Math.round(p.totalClaims).toLocaleString()}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1.5 px-1 text-[9px] leading-snug text-muted-foreground/80">
                    ZIP boundaries are not available yet. Showing ZIP member counts grouped by county.
                  </p>
                </>
              )}
            </div>
          )}

          <ToggleRow
            label="County Utilization Metrics"
            checked={layers.countyUtilization}
            onCheckedChange={() => onToggleLayer('countyUtilization')}
            icon={BarChart3}
            iconClass="text-muted-foreground"
            subtitle="Adds metrics block to county detail panel"
          />
          <ToggleRow
            label="Provider Utilization Reach"
            checked={layers.providerUtilizationReach}
            onCheckedChange={() => onToggleLayer('providerUtilizationReach')}
            icon={Activity}
            iconClass="text-muted-foreground"
            subtitle="Adds reach block to provider detail panel"
          />
          <ToggleRow
            label="Tribal Utilization"
            checked={layers.tribalUtilization}
            onCheckedChange={() => onToggleLayer('tribalUtilization')}
            icon={Landmark}
            iconClass="text-tribal-nation"
            subtitle="Requires Tribal Nations layer"
          />
        </div>
      )}
    </div>
  );
};

export default DemandUtilizationPanel;
