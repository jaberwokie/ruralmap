import type { LayerState } from '@/types/layers';

interface EmptyStateOverlayProps {
  layers: LayerState;
  visibleFacilityCount: number;
  visibleBehavioralHealthCount: number;
  visibleServiceCount: number;
  isLoading: boolean;
}

/**
 * Lightweight, non-modal hint shown when the map is operationally empty
 * because every pin/overlay layer is off or filtered out. Reuses already-
 * derived layer + facility visibility — no extra recalculation. County
 * boundaries alone still count as empty (per spec).
 */
const EmptyStateOverlay = ({
  layers,
  visibleFacilityCount,
  visibleBehavioralHealthCount,
  visibleServiceCount,
  isLoading,
}: EmptyStateOverlayProps) => {
  if (isLoading) return null;

  const providerVisible = layers.serviceLocations && visibleFacilityCount > 0;
  const behavioralHealthVisible =
    layers.behavioralHealth && visibleBehavioralHealthCount > 0;
  const servicesVisible = layers.services && visibleServiceCount > 0;
  const otherPinsVisible = behavioralHealthVisible || servicesVisible;
  const operationalOverlays =
    layers.operationalCoverage ||
    layers.fteCapacity ||
    layers.utilizationIntensity ||
    layers.engagementGap ||
    layers.broadbandAccess ||
    layers.cellularCoverage ||
    layers.tribalNations ||
    layers.tier1Highlight ||
    layers.railCorridor ||
    layers.localTransitZones ||
    layers.memberDemandZip ||
    layers.countyUtilization ||
    layers.providerUtilizationReach ||
    layers.tribalUtilization;

  if (providerVisible || otherPinsVisible || operationalOverlays) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[650] flex items-center justify-center">
      <div className="pointer-events-none mx-6 max-w-xs rounded-md border border-border bg-card/85 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold text-foreground">No visible operational data</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Current overlay and filter selections are hiding operational results.
        </p>
        <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
          <li>• Turn on Provider Access Infrastructure</li>
          <li>• Clear county filters</li>
          <li>• Activate operational overlays</li>
        </ul>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground/80">
          Search only affects the results list, not operational visibility.
        </p>
      </div>
    </div>
  );
};

export default EmptyStateOverlay;
