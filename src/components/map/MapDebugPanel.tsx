import { cn } from '@/lib/utils';
import type { DebugIsolationGroup, LayerDebugRecord, SourceWarning } from '@/components/map/mapDiagnostics';
import type { FacilityValidationSummary } from '@/utils/facilityValidation';

interface MapDebugPanelProps {
  open: boolean;
  layers: LayerDebugRecord[];
  warnings: SourceWarning[];
  isolatedLayerId: string | null;
  isolatedGroup: DebugIsolationGroup | null;
  facilityValidationEnabled: boolean;
  facilityValidationSummary: FacilityValidationSummary;
  onToggleLayer: (layerId: string) => void;
  onIsolateLayer: (layerId: string) => void;
  onIsolateGroup: (group: DebugIsolationGroup) => void;
  onClearIsolation: () => void;
  onToggleFacilityValidation: () => void;
}

const GROUPS: Array<{ key: DebugIsolationGroup; label: string }> = [
  { key: 'counties', label: 'Counties' },
  { key: 'operational', label: 'Operational / Service' },
  { key: 'drive', label: 'Drive Radius' },
  { key: 'engagement', label: 'Engagement / Gap' },
  { key: 'markers', label: 'Markers / Pins' },
];

const badgeClassName = 'rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] uppercase';

const MapDebugPanel = ({
  open,
  layers,
  warnings,
  isolatedLayerId,
  isolatedGroup,
  facilityValidationEnabled,
  facilityValidationSummary,
  onToggleLayer,
  onIsolateLayer,
  onIsolateGroup,
  onClearIsolation,
  onToggleFacilityValidation,
}: MapDebugPanelProps) => {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[1000] flex w-full justify-end overflow-hidden">
      <aside
        aria-hidden={!open}
        className={cn(
          'pointer-events-auto h-full w-full max-w-[28rem] border-l border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Map Diagnostics</p>
                <h2 className="mt-1 text-base font-semibold text-balance">Rural Nevada layer debugger</h2>
              </div>
              <button
                type="button"
                onClick={onClearIsolation}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-[0.98]"
              >
                Reset isolation
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Facility validation mode</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Dev-only pin audit view for verified vs approximate facility locations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleFacilityValidation}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]',
                    facilityValidationEnabled
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {facilityValidationEnabled ? 'Validation on' : 'Validation off'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-muted-foreground">Reviewed</div>
                  <div className="mt-1 font-semibold text-foreground">{facilityValidationSummary.totalFacilitiesReviewed}</div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-muted-foreground">Verified</div>
                  <div className="mt-1 font-semibold text-foreground">{facilityValidationSummary.verifiedCount}</div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-muted-foreground">Approximate</div>
                  <div className="mt-1 font-semibold text-foreground">{facilityValidationSummary.approximateCount}</div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-muted-foreground">Corrected</div>
                  <div className="mt-1 font-semibold text-foreground">{facilityValidationSummary.correctedCount}</div>
                </div>
                <div className="col-span-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <div className="text-muted-foreground">Manual review</div>
                  <div className="mt-1 font-semibold text-foreground">{facilityValidationSummary.manualReviewCount}</div>
                </div>
              </div>

              <p className="text-xs font-medium text-foreground">Group isolation</p>
              <div className="flex flex-wrap gap-2">
                {GROUPS.map((group) => {
                  const active = isolatedGroup === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => onIsolateGroup(group.key)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98]',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {group.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-foreground">Geometry warnings</p>
              <span className={cn(badgeClassName, warnings.length > 0 ? 'border-destructive/30 text-destructive' : 'border-border text-muted-foreground')}>
                {warnings.length} issues
              </span>
            </div>
            <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
              {warnings.length > 0 ? (
                warnings.map((warning, index) => (
                  <div key={`${warning.source}-${index}`} className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-card-foreground">
                    <div className="font-medium text-destructive">{warning.source}</div>
                    <div className="mt-1 leading-relaxed text-muted-foreground">{warning.message}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  No invalid GeoJSON, overlap conflicts, or out-of-bounds geometry detected in active sources.
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-foreground">Render order — top to bottom</p>
              <span className={cn(badgeClassName, 'border-border text-muted-foreground')}>{layers.length} layers</span>
            </div>

            <div className="space-y-3 pb-6">
              {layers.map((layer, index) => {
                const isolated = isolatedLayerId === layer.id;
                const rowAlert = layer.geometryConflict || layer.duplicateFilter || layer.duplicateSource;

                return (
                  <div
                    key={layer.id}
                    className={cn(
                      'rounded-xl border px-4 py-3',
                      rowAlert ? 'border-destructive/25 bg-destructive/5' : 'border-border bg-secondary/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">#{index + 1}</span>
                          <h3 className="truncate text-sm font-semibold">{layer.name}</h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{layer.source}</p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleLayer(layer.id)}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors active:scale-[0.98]',
                            layer.visible
                              ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                              : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          {layer.visible ? 'Visible' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onIsolateLayer(layer.id)}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors active:scale-[0.98]',
                            isolated
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          Isolate
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Visibility:</span> {String(layer.visible)}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Rendered:</span> {String(layer.rendered)}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-foreground">Toggle:</span> {layer.controllingToggle}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {layer.duplicateSource && (
                        <span className={cn(badgeClassName, 'border-amber-500/30 bg-amber-500/10 text-amber-700')}>Duplicate source</span>
                      )}
                      {layer.duplicateFilter && (
                        <span className={cn(badgeClassName, 'border-amber-500/30 bg-amber-500/10 text-amber-700')}>Duplicate filter</span>
                      )}
                      {layer.geometryConflict && (
                        <span className={cn(badgeClassName, 'border-destructive/30 bg-destructive/10 text-destructive')}>Geometry overlap risk</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MapDebugPanel;