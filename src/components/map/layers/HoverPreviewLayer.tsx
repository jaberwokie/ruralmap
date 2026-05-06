import { useState } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BroadbandStatus, OperationalBroadbandReadiness } from '@/data/broadband-coverage';
import type { OperationalCellularReadiness } from '@/data/cellular-coverage';


/**
 * Anchored hover-preview overlay extracted from MapView. Pure display:
 * receives the current county/marker preview state plus layer-visibility
 * flags and public-safe mode, and renders the top-left preview card.
 *
 * Behavior, copy, classNames, breakpoints, and z-index are preserved
 * verbatim from the prior inline implementation.
 */

export interface CountyHoverMetrics {
  county: string;
  totalMembers?: number;
  unengagedMembers?: number;
  providerCount?: number;
  serviceCount?: number;
  coverageGapPercent?: number;
  broadbandStatus?: BroadbandStatus;
  pct_100_20_plus?: number;
  pct_25_3_to_100_20?: number;
  pct_below_25_3?: number;
  broadbandReadiness?: OperationalBroadbandReadiness;
  broadbandSatelliteShare?: number;
  broadbandUneven?: boolean;
  cellularReadiness?: OperationalCellularReadiness;
  cellularLtePct?: number;
  cellularFiveGPct?: number;
}

export interface CountyHoverPreview extends CountyHoverMetrics {}

export interface MarkerHoverPreview {
  name: string;
  subtitle?: string;
  address?: string;
  detail?: string;
  extraHtml?: string;
  memberDistanceMi?: number;
  memberTierLabel?: string;
  /** Drive distance + time line for Field Response county markers. */
  driveEstimate?: string;
}

export type CoverageGapSeverity = 'High' | 'Moderate' | 'Low';

const numberFormatter = new Intl.NumberFormat();

const getCountyDisplayName = (county: string) =>
  county === 'Carson City' ? county : `${county} County`;

const CountyHoverMetricRow = ({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-[10px] leading-4">
    <span className="truncate text-muted-foreground">{label}</span>
    <span className={`text-right font-medium tabular-nums ${emphasize ? 'text-foreground' : 'text-foreground/85'}`}>{value}</span>
  </div>
);

export const getCoverageGapSeverity = (coverageGapPercent: number): CoverageGapSeverity => {
  if (coverageGapPercent > 60) return 'High';
  if (coverageGapPercent >= 30) return 'Moderate';
  return 'Low';
};

const COVERAGE_GAP_SEVERITY_DOT: Record<CoverageGapSeverity, string> = {
  High: 'bg-destructive',
  Moderate: 'bg-amber-500',
  Low: 'bg-primary',
};

const CoverageGapInfoButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          aria-label="Explain coverage gap"
        >
          <Info className="h-2.5 w-2.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={8} className="max-w-52 text-[10px] leading-4">
        Percent of county area outside provider coverage radius based on current radius setting.
      </TooltipContent>
    </Tooltip>
  );
};

interface HoverPreviewLayerProps {
  countyHoverPreview: CountyHoverPreview | null;
  markerHoverPreview: MarkerHoverPreview | null;
  layers: { broadbandAccess: boolean; cellularCoverage: boolean };
  isPublicSafe: boolean;
}

export const HoverPreviewLayer = ({
  countyHoverPreview,
  markerHoverPreview,
  layers,
  isPublicSafe,
}: HoverPreviewLayerProps) => {
  return (
    <TooltipProvider delayDuration={120}>
      {(countyHoverPreview || markerHoverPreview) && (
        <div
          data-tutorial="hover-tooltip"
          /*
           * Mobile fix: this anchored hover preview is desktop-only.
           * On mobile, "hover" is triggered by tap and the card lingers
           * top-left over the map, reading as a stuck/sticky overlay
           * while users pan. Taps on mobile already open the full
           * CoverageDetailPanel, so the preview is redundant. Hide
           * below the md breakpoint (<768px) to keep the map clean.
           * Desktop/tablet anchored behavior is preserved unchanged.
           */
          className="pointer-events-none absolute top-2 left-2 z-[810] hidden md:block w-52 rounded-lg border border-border bg-card/95 px-2.5 py-2 text-card-foreground shadow-md backdrop-blur-sm"
        >
          {markerHoverPreview && (
            <div>
              <p className="text-[13px] font-semibold leading-4 text-foreground">{markerHoverPreview.name}</p>
              {markerHoverPreview.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{markerHoverPreview.subtitle}</p>}
              {markerHoverPreview.address && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{markerHoverPreview.address}</p>}
              {markerHoverPreview.detail && <p className="text-[10px] text-muted-foreground mt-0.5">{markerHoverPreview.detail}</p>}
              {markerHoverPreview.driveEstimate && (
                <p className="text-[10px] font-medium text-foreground mt-1">{markerHoverPreview.driveEstimate}</p>
              )}
              {typeof markerHoverPreview.memberDistanceMi === 'number' && markerHoverPreview.memberTierLabel && (
                <div className="border-t border-border/70 mt-1 pt-1 flex items-center gap-1.5 text-[10px]">
                  <span className="font-medium text-foreground">{markerHoverPreview.memberDistanceMi.toFixed(1)} mi</span>
                  <span className="text-muted-foreground">·</span>
                  <span className={`font-medium ${markerHoverPreview.memberTierLabel === 'Local Access' ? 'text-green-600' : markerHoverPreview.memberTierLabel === 'Managed Access' ? 'text-amber-600' : markerHoverPreview.memberTierLabel === 'High Friction' ? 'text-red-500' : 'text-muted-foreground'}`}>{markerHoverPreview.memberTierLabel}</span>
                </div>
              )}
              {markerHoverPreview.extraHtml && (
                <div className="border-t border-border/70 mt-1.5 pt-1 space-y-0.5">
                  {markerHoverPreview.extraHtml.split('\n').map((line, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground/80">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {countyHoverPreview && !markerHoverPreview && (
            <>
              <p className="text-[13px] font-semibold leading-4 text-foreground">{getCountyDisplayName(countyHoverPreview.county)}</p>
              <div className="mt-1.5 space-y-1">
                {typeof countyHoverPreview.unengagedMembers === 'number' && !isPublicSafe && (
                  <CountyHoverMetricRow label="Unengaged members" value={numberFormatter.format(countyHoverPreview.unengagedMembers)} emphasize />
                )}
                {typeof countyHoverPreview.providerCount === 'number' && (
                  <CountyHoverMetricRow label="Providers" value={numberFormatter.format(countyHoverPreview.providerCount)} />
                )}
                {typeof countyHoverPreview.serviceCount === 'number' && (
                  <CountyHoverMetricRow label="Services" value={numberFormatter.format(countyHoverPreview.serviceCount)} />
                )}
                {typeof countyHoverPreview.coverageGapPercent === 'number' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-[10px] leading-4">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        Coverage gap
                        <CoverageGapInfoButton />
                      </span>
                      <span className="text-right font-medium tabular-nums text-foreground/85">{countyHoverPreview.coverageGapPercent}%</span>
                    </div>
                    <div className="border-t border-border/70 pt-1 text-[10px] leading-4 text-muted-foreground flex items-center gap-1">
                      Status: <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${COVERAGE_GAP_SEVERITY_DOT[getCoverageGapSeverity(countyHoverPreview.coverageGapPercent)]}`} />{getCoverageGapSeverity(countyHoverPreview.coverageGapPercent)} coverage gap
                    </div>
                  </div>
                )}
                {layers.broadbandAccess && countyHoverPreview.broadbandStatus && (
                  <div className="border-t border-border/70 pt-1 space-y-0.5">
                    <CountyHoverMetricRow label="Readiness" value={countyHoverPreview.broadbandReadiness ?? countyHoverPreview.broadbandStatus} />
                    {typeof countyHoverPreview.pct_100_20_plus === 'number' && (
                      <CountyHoverMetricRow label="≥100/20" value={`${countyHoverPreview.pct_100_20_plus}%`} />
                    )}
                    {typeof countyHoverPreview.pct_below_25_3 === 'number' && countyHoverPreview.pct_below_25_3 > 0 && (
                      <CountyHoverMetricRow label="<25/3" value={`${countyHoverPreview.pct_below_25_3}%`} />
                    )}
                    {typeof countyHoverPreview.broadbandSatelliteShare === 'number' && countyHoverPreview.broadbandSatelliteShare >= 30 && (
                      <CountyHoverMetricRow label="Satellite" value={`${countyHoverPreview.broadbandSatelliteShare}%`} />
                    )}
                    {countyHoverPreview.broadbandUneven && (
                      <div className="text-[9px] text-engagement-watch mt-0.5">⚠ Uneven coverage</div>
                    )}
                  </div>
                )}
                {layers.cellularCoverage && countyHoverPreview.cellularReadiness && (
                  <div className="border-t border-border/70 pt-1 space-y-0.5">
                    <CountyHoverMetricRow label="Cellular" value={countyHoverPreview.cellularReadiness} />
                    {typeof countyHoverPreview.cellularLtePct === 'number' && (
                      <CountyHoverMetricRow label="LTE" value={`${countyHoverPreview.cellularLtePct}%`} />
                    )}
                    {typeof countyHoverPreview.cellularFiveGPct === 'number' && (
                      <CountyHoverMetricRow label="5G" value={`${countyHoverPreview.cellularFiveGPct}%`} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </TooltipProvider>
  );
};
