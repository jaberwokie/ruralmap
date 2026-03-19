import { useState, useRef, useMemo } from 'react';
import { Search, Upload, ChevronDown, ChevronRight, Filter, X, Activity, Headphones, HelpCircle } from 'lucide-react';
import { HELP_TOOLTIPS } from '@/data/help-tooltips';
import { Facility, FacilityType } from '@/data/facilities';
import { toast } from 'sonner';
import { Filters } from '@/pages/Index';
import { RURAL_SERVICE_CATEGORIES } from '@/data/rural-services';
import { fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { kmToMiles, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { nevadaCounties } from '@/data/nevada-counties';
import { getEngagementGapResults } from '@/utils/utilizationAggregation';

interface LayerState {
  counties: boolean;
  serviceLocations: boolean;
  operationalCoverage: boolean;
  fteCapacity: boolean;
  utilizationIntensity: boolean;
  engagementGap: boolean;
}

interface SidebarProps {
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
  allFacilities: Facility[];
  facilities: Facility[];
  onAddFacilities: (facilities: Facility[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFacilityClick: (facility: Facility) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  coverageRadius: boolean;
  coverageGaps: boolean;
  onCoverageRadiusChange: (checked: boolean) => void;
  onCoverageGapsChange: (checked: boolean) => void;
  selectedFteId?: string | null;
  onFteCardClick?: (fteId: string) => void;
  coverageRadiusKm?: number;
  onCoverageRadiusKmChange?: (km: number) => void;
  topProvidersOnly: boolean;
  onTopProvidersOnlyChange: (checked: boolean) => void;
  onHelpEnter?: (key: string) => void;
  onHelpLeave?: () => void;
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', color: 'bg-muted-foreground' },
  { key: 'serviceLocations' as const, label: 'Service Locations', color: 'bg-foreground' },
  { key: 'operationalCoverage' as const, label: 'Response Capability', color: 'bg-teal-600' },
  { key: 'fteCapacity' as const, label: 'FTE Capacity & Load', color: 'bg-amber-500' },
  { key: 'utilizationIntensity' as const, label: 'Utilization Intensity', color: 'bg-purple-500' },
  { key: 'engagementGap' as const, label: 'Engagement Gap', color: 'bg-orange-500' },
];

const Sidebar = ({
  layers,
  onToggleLayer,
  allFacilities,
  facilities,
  onAddFacilities,
  searchQuery,
  onSearchChange,
  onFacilityClick,
  filters,
  onFiltersChange,
  radiusKm,
  onRadiusChange,
  coverageRadius,
  coverageGaps,
  onCoverageRadiusChange,
  onCoverageGapsChange,
  selectedFteId,
  onFteCardClick,
  coverageRadiusKm = 120,
  onCoverageRadiusKmChange,
  topProvidersOnly,
  onTopProvidersOnlyChange,
  onHelpEnter,
  onHelpLeave,
}: SidebarProps) => {
  const usePersistToggle = (key: string, defaultOpen = false) => {
    const [open, setOpen] = useState(() => {
      try { const v = localStorage.getItem(key); return v === null ? defaultOpen : v === 'true'; } catch { return defaultOpen; }
    });
    const toggle = () => setOpen(prev => { const next = !prev; try { localStorage.setItem(key, String(next)); } catch {} return next; });
    return [open, toggle] as const;
  };

  const [facilitiesOpen, toggleFacilities] = usePersistToggle('sidebar_facilities');
  const [csvOpen, setCsvOpen] = useState(false);
  const [filtersOpen, toggleFilters] = usePersistToggle('sidebar_filters');
  const [coreMapOpen, toggleCoreMap] = usePersistToggle('sidebar_layer_core');
  const [operationsOpen, toggleOperations] = usePersistToggle('sidebar_layer_ops');
  const [utilizationOpen, toggleUtilization] = usePersistToggle('sidebar_layer_util');
  const [accessOpen, toggleAccess] = usePersistToggle('sidebar_layer_access');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Counts from filtered set
  const hospitalCount = facilities.filter(f => f.type === 'hospital').length;
  const clinicCount = facilities.filter(f => f.type === 'clinic').length;
  const totalCount = facilities.length;

  // Unique counties from all facilities
  const allCounties = useMemo(() => {
    const set = new Set(allFacilities.map(f => f.county).filter(Boolean));
    return Array.from(set).sort();
  }, [allFacilities]);

  const activeFilterCount = filters.types.size + filters.counties.size + filters.serviceCategories.size;

  const toggleTypeFilter = (type: string) => {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type); else next.add(type);
    onFiltersChange({ ...filters, types: next });
  };

  const toggleCountyFilter = (county: string) => {
    const next = new Set(filters.counties);
    if (next.has(county)) next.delete(county); else next.add(county);
    onFiltersChange({ ...filters, counties: next });
  };

  const toggleServiceCategoryFilter = (cat: string) => {
    const next = new Set(filters.serviceCategories);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    onFiltersChange({ ...filters, serviceCategories: next });
  };

  const clearFilters = () => {
    onFiltersChange({ types: new Set(), counties: new Set(), serviceCategories: new Set() });
  };

  const normalizeHeader = (h: string) =>
    String(h).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const stripLineQuotes = (line: string): string => {
    const trimmed = line.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (!text) { toast.error('Failed to read file.'); return; }

      // Strip BOM
      if (text.startsWith('\uFEFF')) text = text.substring(1);

      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV file has no data rows.'); return; }

      const headers = parseCSVLine(stripLineQuotes(lines[0]));
      const norm = headers.map(normalizeHeader);

      const find = (key: string) => {
        let idx = norm.indexOf(key);
        if (idx === -1) idx = norm.findIndex(h => h.startsWith(key));
        if (idx === -1) idx = norm.findIndex(h => h.includes(key));
        return idx;
      };

      const nameIdx = find('name');
      const latIdx = find('lat');
      const lngIdx = find('lon') !== -1 ? find('lon') : find('lng');
      const typeIdx = find('type');
      const cityIdx = find('city');
      const countyIdx = find('county');
      const notesIdx = find('note');
      const tierIdx = find('tier');

      if (nameIdx === -1 || latIdx === -1 || lngIdx === -1) {
        toast.error('Missing required columns: name, latitude, longitude.');
        return;
      }

      const newFacilities: Facility[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(stripLineQuotes(lines[i]));
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) continue;

        const rawType = (typeIdx !== -1 ? cols[typeIdx] || '' : '').toLowerCase();
        const type: FacilityType = rawType.includes('hospital') ? 'hospital' : 'clinic';

        newFacilities.push({
          id: `csv-${Date.now()}-${i}`,
          name: cols[nameIdx] || `Facility ${i}`,
          type,
          city: cityIdx !== -1 ? cols[cityIdx] || '' : '',
          county: countyIdx !== -1 ? cols[countyIdx] || '' : '',
          lat,
          lng,
          notes: notesIdx !== -1 ? cols[notesIdx] : undefined,
          tier: tierIdx !== -1 ? (cols[tierIdx] as any) : undefined,
        });
      }

      if (newFacilities.length > 0) {
        onAddFacilities(newFacilities);
        toast.success(`Imported ${newFacilities.length} facilities.`);
      } else {
        toast.error('No valid facilities found in the CSV.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const displayFacilities = searchQuery
    ? facilities.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.county.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : facilities;

  return (
    <div className="w-full md:w-80 h-full bg-card flex flex-col overflow-y-auto" style={{ boxShadow: 'var(--shadow-panel)' }}>
      {/* Header */}
      <div className="p-4 pb-3">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">Rural Operations Map</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Nevada Behavioral Health</p>
      </div>

      {/* Stats Bar */}
      <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{totalCount}</span> Total
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-hospital inline-block" />
          <span className="font-mono font-medium text-foreground">{hospitalCount}</span> Hospitals
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-clinic inline-block" />
          <span className="font-mono font-medium text-foreground">{clinicCount}</span> Clinics
        </span>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search facilities, cities..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-secondary rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Filter Panel */}
      <div className="px-4 pb-3">
        <button
          onClick={toggleFilters}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors w-full"
        >
          {filtersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Filter className="w-3 h-3" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <span className="bg-primary text-primary-foreground text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                className="p-0.5 hover:bg-secondary rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </button>
        {filtersOpen && (
          <div className="space-y-3">
            {/* Type Filter */}
            <div>
              <div className="text-[10px] text-muted-foreground font-medium mb-1.5 px-1">Type</div>
              <div className="flex gap-1.5">
                {[
                  { value: 'hospital', label: 'Hospital', color: 'bg-hospital' },
                  { value: 'clinic', label: 'Clinic', color: 'bg-clinic' },
                ].map(({ value, label, color }) => {
                  const active = filters.types.has(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleTypeFilter(value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-all duration-150 ${
                        active
                          ? 'bg-foreground text-background font-medium'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${color} ${!active ? 'opacity-50' : 'opacity-100'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* County Filter */}
            <div>
              <div className="text-[10px] text-muted-foreground font-medium mb-1.5 px-1">County</div>
              <div className="flex flex-wrap gap-1">
                {allCounties.map(county => {
                  const active = filters.counties.has(county);
                  return (
                    <button
                      key={county}
                      onClick={() => toggleCountyFilter(county)}
                      className={`px-2 py-0.5 rounded text-[11px] transition-all duration-150 ${
                        active
                          ? 'bg-foreground text-background font-medium'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {county}
                    </button>
                  );
                })}
            </div>

            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border mx-4" />


      {/* Layer Manager */}
      <div className="px-4 py-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Layers
        </div>

        {/* ── CORE MAP ── */}
        <div className="mb-1">
          <button onClick={toggleCoreMap} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            {coreMapOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Core Map</span>
          </button>
          {coreMapOpen && (
            <div className="space-y-1 mt-0.5">
              {LAYER_CONFIG.filter(l => l.key === 'counties' || l.key === 'serviceLocations').map(({ key, label, color }) => (
                <div key={key} className="flex items-center">
                  <button onClick={() => onToggleLayer(key)} className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary">
                    <div className={`w-2.5 h-2.5 rounded-sm ${color} ${!layers[key] ? 'opacity-20' : ''} transition-opacity duration-200`} />
                    <span className={`flex-1 text-left ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                    <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${layers[key] ? 'bg-primary' : 'bg-input'} relative`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${layers[key] ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <span className="p-1 cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors" onMouseEnter={() => onHelpEnter?.(key)} onMouseLeave={() => onHelpLeave?.()} onTouchStart={() => onHelpEnter?.(key)}>
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── OPERATIONS ── */}
        <div className="mb-1">
          <button onClick={toggleOperations} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            {operationsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Operations</span>
          </button>
          {operationsOpen && (
            <div className="space-y-1 mt-0.5">
              {LAYER_CONFIG.filter(l => l.key === 'operationalCoverage' || l.key === 'fteCapacity' || l.key === 'engagementGap').map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex items-center">
                    <button onClick={() => onToggleLayer(key)} className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary">
                      <div className={`w-2.5 h-2.5 rounded-sm ${color} ${!layers[key] ? 'opacity-20' : ''} transition-opacity duration-200`} />
                      <span className={`flex-1 text-left ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                      <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${layers[key] ? 'bg-primary' : 'bg-input'} relative`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${layers[key] ? 'left-3.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                    <span className="p-1 cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors" onMouseEnter={() => onHelpEnter?.(key)} onMouseLeave={() => onHelpLeave?.()} onTouchStart={() => onHelpEnter?.(key)}>
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </div>
                  {key === 'operationalCoverage' && layers.operationalCoverage && (() => {
                    const radius = coverageRadiusKm ?? 120;
                    // Dynamic county counts
                    const counts = { active: 0, scheduled: 0, remote: 0 };
                    nevadaCounties.forEach(c => {
                      const bd = getCountyCoverageBreakdown(c.name, radius);
                      if (bd.activePercent >= 50) counts.active++;
                      else if (bd.activePercent > 0 || bd.anchoringFtes.length > 0) counts.scheduled++;
                      else counts.remote++;
                    });

                    return (
                      <div className="px-2 pb-2 pt-1.5 space-y-2.5">
                        {/* Summary strip */}
                        <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80 mb-1">Field Coverage Status</div>
                          <div className="space-y-0.5 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'hsl(174, 50%, 40%)' }} />
                              <span><span className="font-semibold text-foreground">{counts.active}</span> counties with same-day field response</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'hsl(190, 55%, 50%)' }} />
                              <span><span className="font-semibold text-foreground">{counts.scheduled}</span> counties with scheduled outreach only</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'hsl(220, 10%, 70%)' }} />
                              <span><span className="font-semibold text-foreground">{counts.remote}</span> counties with remote-only support</span>
                            </div>
                          </div>
                        </div>

                        {/* Field Response Radius slider */}
                        <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Field Response Radius</span>
                            <span className="text-[11px] font-bold text-foreground tabular-nums">
                              ~{Math.round((radius / 80) * 60)} min (~{kmToMiles(radius)} mi)
                            </span>
                          </div>
                          <input type="range" min={40} max={200} step={10} value={radius} onChange={e => onCoverageRadiusKmChange?.(Number(e.target.value))} className="w-full h-1.5 accent-teal-600 cursor-pointer" />
                          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                            <span>~30 min (~25 mi)</span>
                            <span>~150 min (~124 mi)</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground/70 mt-1 leading-relaxed">Defines the maximum same-day response range from field staff base.</p>
                        </div>

                        {/* Response Capability tiers */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Response Capability</div>
                          {[
                            { label: 'Same-Day Field Response Available', desc: 'In-person response within ~75–90 minutes of FTE base.', color: 'hsl(174, 50%, 40%)', opacity: 0.85, style: 'solid' as const },
                            { label: 'Field Response Available (Planned)', desc: 'In-person visits require scheduling. Not same-day.', color: 'hsl(190, 55%, 50%)', opacity: 0.55, style: 'dashed' as const },
                            { label: 'Remote Support Only', desc: 'No in-person response. Telephonic and virtual coordination only.', color: 'hsl(220, 10%, 64%)', opacity: 0.35, style: 'dashed' as const },
                          ].map(({ label: lbl, desc, color: clr, opacity, style }) => (
                            <div key={lbl} className="flex gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: clr, opacity, border: style === 'dashed' ? `1.5px dashed ${clr}` : 'none' }} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-medium text-foreground leading-tight" style={{ opacity }}>{lbl}</div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="text-[9px] text-muted-foreground/60 italic leading-relaxed">Coverage is based on real travel time, not straight-line distance.</p>
                      </div>
                    );
                  })()}
                  {key === 'fteCapacity' && layers.fteCapacity && (
                    <div className="px-2 pb-2 pt-1.5 space-y-2">
                      {fteCapacityData.filter(fte => fte.hubLocation !== null).map(fte => {
                        const role = FTE_ROLE_COLORS[fte.id];
                        const isSelected = selectedFteId === fte.id;
                        const isDimmed = selectedFteId != null && !isSelected;
                        const coverageLabel = fte.hubLocation ? 'Active Field Coverage' : 'Remote Only';
                        return (
                          <button key={fte.id} onClick={() => onFteCardClick?.(fte.id)} className={`w-full text-left rounded-md border-2 px-2 py-1.5 transition-all duration-200 cursor-pointer hover:shadow-sm ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-border'} ${isSelected ? 'ring-2 ring-primary ring-offset-1 shadow-md' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role?.primary }} />
                                <span className="text-[11px] font-semibold text-foreground">{fte.label}</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-foreground/70">{coverageLabel}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{fte.counties.length} counties served</div>
                          </button>
                        );
                      })}
                      {(() => {
                        const remote = fteCapacityData.find(f => f.hubLocation === null);
                        if (!remote) return null;
                        const role = FTE_ROLE_COLORS[remote.id];
                        const isRemoteSelected = selectedFteId === remote.id;
                        const isRemoteDimmed = selectedFteId != null && !isRemoteSelected;
                        return (
                          <button onClick={() => onFteCardClick?.(remote.id)} className={`w-full text-left rounded-md border-2 border-dashed px-2 py-2 transition-all duration-200 cursor-pointer hover:shadow-sm ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-muted-foreground/30'} ${isRemoteSelected ? 'ring-2 ring-primary ring-offset-1 shadow-md' : ''} ${isRemoteDimmed ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Headphones className="w-3.5 h-3.5" style={{ color: role?.primary }} />
                              <span className="text-[11px] font-bold text-foreground">Remote Coordination Team</span>
                            </div>
                            <div className="text-[10px] text-foreground/70">Remote Only</div>
                            <div className="text-[9px] text-muted-foreground mt-1">Statewide telephonic and virtual coordination (no in-person response)</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{remote.counties.length} counties served</div>
                          </button>
                        );
                      })()}
                    </div>
                  )}
                  {key === 'engagementGap' && layers.engagementGap && (() => {
                    const results = getEngagementGapResults();
                    const gapCounties = results.filter((r: any) => r.tier === 'gap');
                    const watchCounties = results.filter((r: any) => r.tier === 'watchlist');
                    const earlyCounties = results.filter((r: any) => r.tier === 'early-signal');
                    const hasAny = results.length > 0;

                    return (
                      <div className="px-2 pb-2 pt-1 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          <span className="font-medium" style={{ color: 'hsl(30, 90%, 50%)' }}>Orange</span> = True Gap (&gt;15 VPM).{' '}
                          <span className="font-medium" style={{ color: 'hsl(48, 90%, 50%)' }}>Yellow</span> = Watchlist (10–15).{' '}
                          <span className="font-medium" style={{ color: 'hsl(200, 70%, 55%)' }}>Blue</span> = Early Signal (6–10).
                        </p>

                        {!hasAny && (
                          <p className="text-[10px] text-muted-foreground/60 italic">No counties currently meet Engagement Gap or Early Signal thresholds.</p>
                        )}

                        {gapCounties.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold" style={{ color: 'hsl(30, 90%, 50%)' }}>True Gap ({gapCounties.length})</p>
                            <p className="text-[10px] text-muted-foreground">{gapCounties.map((r: any) => r.subZone === 'northern-washoe' ? 'N. Washoe' : r.county).join(', ')}</p>
                          </div>
                        )}
                        {watchCounties.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold" style={{ color: 'hsl(48, 90%, 50%)' }}>Watchlist ({watchCounties.length})</p>
                            <p className="text-[10px] text-muted-foreground">{watchCounties.map((r: any) => r.subZone === 'northern-washoe' ? 'N. Washoe' : r.county).join(', ')}</p>
                          </div>
                        )}
                        {earlyCounties.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold" style={{ color: 'hsl(200, 70%, 55%)' }}>Early Signal ({earlyCounties.length})</p>
                            <p className="text-[10px] text-muted-foreground">{earlyCounties.map((r: any) => r.subZone === 'northern-washoe' ? 'N. Washoe' : r.county).join(', ')}</p>
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">
                          Urban Washoe (Reno/Sparks core) and Carson City are excluded. Northern Washoe is included as rural service area.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── UTILIZATION ── */}
        <div className="mb-1">
          <button onClick={toggleUtilization} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            {utilizationOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Utilization</span>
          </button>
          {utilizationOpen && (
            <div className="space-y-1 mt-0.5">
              {LAYER_CONFIG.filter(l => l.key === 'utilizationIntensity').map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex items-center">
                    <button onClick={() => onToggleLayer(key)} className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary">
                      <div className={`w-2.5 h-2.5 rounded-sm ${color} ${!layers[key] ? 'opacity-20' : ''} transition-opacity duration-200`} />
                      <span className={`flex-1 text-left ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                      <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${layers[key] ? 'bg-primary' : 'bg-input'} relative`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${layers[key] ? 'left-3.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                    <span className="p-1 cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors" onMouseEnter={() => onHelpEnter?.(key)} onMouseLeave={() => onHelpLeave?.()} onTouchStart={() => onHelpEnter?.(key)}>
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </div>
                  {layers.utilizationIntensity && (
                    <div className="px-2 pb-2 pt-1.5 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">County shading by avg visits per member. Purple ramp — darker = higher utilization.</p>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-2.5 rounded-sm" style={{ background: 'linear-gradient(to right, hsla(270, 30%, 75%, 0.5), hsla(270, 45%, 55%, 0.7), hsla(270, 60%, 40%, 0.9))' }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                        <span>Low (&lt;10)</span>
                        <span>Mod (10–18)</span>
                        <span>High (&gt;18)</span>
                      </div>
                      <button onClick={() => onTopProvidersOnlyChange(!topProvidersOnly)} className="w-full flex items-center gap-2 px-1 py-1 rounded text-[11px] transition-colors duration-200 hover:bg-secondary mt-1">
                        <div className={`w-6 h-3.5 rounded-full transition-colors duration-200 ${topProvidersOnly ? 'bg-purple-600' : 'bg-input'} relative`}>
                          <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-card shadow-sm transition-all duration-200 ${topProvidersOnly ? 'left-3' : 'left-0.5'}`} />
                        </div>
                        <span className={`${topProvidersOnly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Top Providers Only (Top 20)</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ACCESS ── */}
        <div className="mb-1">
          <button onClick={toggleAccess} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            {accessOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Access</span>
          </button>
          {accessOpen && (
            <div className="space-y-1 mt-0.5">
              {/* Coverage Radius */}
              <div className={!layers.serviceLocations ? 'opacity-50 pointer-events-none' : ''}>
                <div className="flex items-center">
                  <button onClick={() => onCoverageRadiusChange(!coverageRadius)} className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary">
                    <div className={`w-2.5 h-2.5 rounded-sm bg-primary ${!coverageRadius ? 'opacity-20' : ''} transition-opacity duration-200`} />
                    <span className={`flex-1 text-left ${coverageRadius ? 'text-foreground' : 'text-muted-foreground'}`}>Coverage Radius ({kmToMiles(radiusKm)} mi)</span>
                    <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${coverageRadius ? 'bg-primary' : 'bg-input'} relative`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${coverageRadius ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <span className="p-1 cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors" onMouseEnter={() => onHelpEnter?.('coverageRadius')} onMouseLeave={() => onHelpLeave?.()} onTouchStart={() => onHelpEnter?.('coverageRadius')}>
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </div>
                {coverageRadius && (
                  <div className="px-2 pb-1 pt-0.5">
                    <input type="range" min={10} max={150} step={5} value={radiusKm} onChange={(e) => onRadiusChange(Number(e.target.value))} className="w-full h-1 accent-primary cursor-pointer" />
                    <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-0.5">
                      <span>6 mi</span>
                      <span>93 mi</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Coverage Gaps */}
              <div>
                <div className="flex items-center">
                  <button onClick={() => onCoverageGapsChange(!coverageGaps)} className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary">
                    <div className={`w-2.5 h-2.5 rounded-sm bg-destructive ${!coverageGaps ? 'opacity-20' : ''} transition-opacity duration-200`} />
                    <span className={`flex-1 text-left ${coverageGaps ? 'text-foreground' : 'text-muted-foreground'}`}>Coverage Gaps</span>
                    <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${coverageGaps ? 'bg-primary' : 'bg-input'} relative`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${coverageGaps ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <span className="p-1 cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors" onMouseEnter={() => onHelpEnter?.('coverageGaps')} onMouseLeave={() => onHelpLeave?.()} onTouchStart={() => onHelpEnter?.('coverageGaps')}>
                    <HelpCircle className="w-3 h-3" />
                  </span>
                </div>
                {coverageGaps && (
                  <p className="px-2 pb-1 pt-0.5 text-[10px] text-muted-foreground leading-relaxed">Counties highlighted in red have no hospital within <span className="font-medium text-foreground">{kmToMiles(radiusKm)} mi</span>.</p>
                )}
                <p className="px-2 pb-0.5 text-[9px] text-muted-foreground/60 italic">Gaps use the radius setting ({kmToMiles(radiusKm)} mi) independently of the radius overlay.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Legend
        </div>
        <div className="space-y-2.5 text-xs">
          {/* Facility Types */}
          <div>
            <div className="text-[10px] text-muted-foreground font-medium mb-1 px-2">Facility Types</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2">
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'hsl(0, 72%, 51%)', border: '1.5px solid white', boxShadow: '0 0 0 1px hsla(0, 0%, 0%, 0.15), 0 0 5px hsla(0, 72%, 51%, 0.35)' }} />
                <span className="text-muted-foreground">Hospital</span>
              </div>
              <div className="flex items-center gap-2 px-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'hsl(217, 91%, 60%)', border: '1.5px solid white', boxShadow: '0 0 0 1px hsla(0, 0%, 0%, 0.15)' }} />
                <span className="text-muted-foreground">Clinic / Provider</span>
              </div>
            </div>
          </div>
          {/* Operational Coverage */}
          {layers.operationalCoverage && (
            <div>
              <div className="text-[10px] text-muted-foreground font-medium mb-1 px-2">Response Capability</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(174, 50%, 45%, 0.25)', border: '1.5px solid hsla(174, 50%, 40%, 0.6)' }} />
                  <span className="text-muted-foreground">Same-Day Field</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(174, 40%, 55%, 0.12)', border: '1.5px dashed hsla(174, 40%, 50%, 0.45)' }} />
                  <span className="text-muted-foreground">Planned Field</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(220, 10%, 70%, 0.10)', border: '1.5px dashed hsla(220, 10%, 60%, 0.25)' }} />
                  <span className="text-muted-foreground">Remote Only</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border mx-4" />

      {/* CSV Import */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setCsvOpen(!csvOpen)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors"
        >
          {csvOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Data Import
        </button>
        {csvOpen && (
          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 h-16 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors duration-200"
            >
              <Upload className="w-4 h-4" />
              <span>Drop CSV or click to upload</span>
            </button>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Required: name, latitude, longitude. Optional: type, city, county, tier.
            </p>
          </div>
        )}
      </div>

      {/* Facilities List */}
      <div className="flex flex-col px-4 pt-2 pb-4">
        <button
          onClick={toggleFacilities}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors"
        >
          {facilitiesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Facilities ({displayFacilities.length})
        </button>
        {facilitiesOpen && (
          <div className="space-y-0.5">
            {displayFacilities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">No facilities match your search or filters.</p>
                {(searchQuery || filters.types.size > 0 || filters.counties.size > 0) && (
                  <button
                    onClick={() => { onSearchChange(''); onFiltersChange({ types: new Set(), counties: new Set(), serviceCategories: new Set() }); }}
                    className="mt-2 text-[11px] text-primary hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              displayFacilities.map(facility => (
                <button
                  key={facility.id}
                  onClick={() => onFacilityClick(facility)}
                  className="w-full text-left px-2 py-2 rounded hover:bg-secondary transition-colors duration-150"
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      facility.type === 'hospital' ? 'bg-hospital' : 'bg-clinic'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">
                        {facility.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {facility.city}{facility.county ? `, ${facility.county} Co.` : ''}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
