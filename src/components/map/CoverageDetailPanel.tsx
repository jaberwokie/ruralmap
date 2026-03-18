import { CoverageArea, COVERAGE_AREA_LABELS, RURAL_ACCESS_DEPENDENCE, nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { useMemo } from 'react';
import { X } from 'lucide-react';

interface CoverageDetailPanelProps {
  hoveredArea: CoverageArea | null;
  focusedArea?: CoverageArea | null;
  onClearFocus?: () => void;
}

const CoverageDetailPanel = ({ hoveredArea, focusedArea, onClearFocus }: CoverageDetailPanelProps) => {
  // Focused area takes priority over hovered area
  const displayArea = focusedArea ?? hoveredArea;
  const isLocked = !!focusedArea;

  const areaData = useMemo(() => {
    if (!displayArea) return null;
    const volumeMap = new Map(memberVolumeData.map(d => [d.county, d.memberCount]));
    const counties = nevadaCounties.filter(c => c.zone === displayArea);
    const rows = counties.map(c => ({
      name: c.name,
      count: volumeMap.get(c.name) ?? 0,
      secondaryZone: c.secondaryZone,
    }));
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { label: COVERAGE_AREA_LABELS[displayArea], rows, total };
  }, [displayArea]);

  return (
    <div className={`absolute top-3 right-3 z-[1000] w-56 min-h-[120px] rounded-lg border border-border bg-white/90 backdrop-blur-sm shadow-md p-3 select-none transition-opacity duration-150 ${isLocked ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coverage Area Details
        </h3>
        {isLocked && (
          <button
            onClick={onClearFocus}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Clear focus"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isLocked && (
        <div className="mb-2 text-[10px] text-primary font-medium uppercase tracking-wide">
          ● Focused
        </div>
      )}

      {!areaData ? (
        <p className="text-xs text-muted-foreground/70 italic">
          Hover over a coverage area to view details
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground mb-2">{areaData.label}</p>
          <div className="space-y-0.5">
            {areaData.rows.map(r => (
              <div key={r.name}>
                <div className="flex justify-between text-xs text-foreground/80">
                  <span>{r.name}</span>
                  <span className="font-medium tabular-nums">{r.count.toLocaleString()}</span>
                </div>
                {r.secondaryZone && (
                  <div className="text-[10px] text-muted-foreground italic ml-1">
                    Routing: Primary Area {displayArea!.replace('area', '')}, Supported by Area {r.secondaryZone.replace('area', '')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between text-xs font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{areaData.total.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between text-xs text-foreground/80">
            <span>Rural Access Dependence</span>
            <span className="font-semibold">{RURAL_ACCESS_DEPENDENCE[displayArea!]}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default CoverageDetailPanel;
