import { CoverageArea, COVERAGE_AREA_LABELS, nevadaCounties } from '@/data/nevada-counties';
import { memberVolumeData } from '@/data/member-volume';
import { useMemo } from 'react';

interface CoverageDetailPanelProps {
  hoveredArea: CoverageArea | null;
}

const CoverageDetailPanel = ({ hoveredArea }: CoverageDetailPanelProps) => {
  const areaData = useMemo(() => {
    if (!hoveredArea) return null;
    const volumeMap = new Map(memberVolumeData.map(d => [d.county, d.memberCount]));
    const counties = nevadaCounties.filter(c => c.zone === hoveredArea);
    const rows = counties.map(c => ({
      name: c.name,
      count: volumeMap.get(c.name) ?? 0,
    }));
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { label: COVERAGE_AREA_LABELS[hoveredArea], rows, total };
  }, [hoveredArea]);

  return (
    <div className="absolute top-3 right-3 z-[1000] w-56 min-h-[120px] rounded-lg border border-border bg-white/90 backdrop-blur-sm shadow-md p-3 pointer-events-none select-none transition-opacity duration-150">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Coverage Area Details
      </h3>

      {!areaData ? (
        <p className="text-xs text-muted-foreground/70 italic">
          Hover over a coverage area to view details
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground mb-2">{areaData.label}</p>
          <div className="space-y-0.5">
            {areaData.rows.map(r => (
              <div key={r.name} className="flex justify-between text-xs text-foreground/80">
                <span>{r.name}</span>
                <span className="font-medium tabular-nums">{r.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between text-xs font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{areaData.total.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default CoverageDetailPanel;
