import { useState, useRef, useMemo, useEffect, type CSSProperties, type ReactNode } from 'react';
import { Search, Upload, ChevronDown, ChevronRight, X, Headphones, HelpCircle } from 'lucide-react';
import { HELP_TOOLTIPS } from '@/data/help-tooltips';
import { Facility, FacilityType } from '@/data/facilities';
import { MapTutorialStepKey } from '@/data/map-tutorial';
import { toast } from 'sonner';
import { Filters } from '@/pages/Index';
import { RURAL_SERVICE_CATEGORIES } from '@/data/rural-services';
import { fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { kmToMiles, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { nevadaCounties } from '@/data/nevada-counties';
import { getCountyEngagementRankings, getEngagementGapResults, getFilteredEngagementPriorityCounties, getTopUnengagedCounties } from '@/utils/utilizationAggregation';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LayerState {
  counties: boolean;
  services: boolean;
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
  engagementRateBelow20Only: boolean;
  onEngagementRateBelow20OnlyChange: (checked: boolean) => void;
  onCountySelect?: (county: string) => void;
  onHelpEnter?: (key: string) => void;
  onHelpLeave?: () => void;
  onReplayTutorial?: () => void;
  tutorialStepKey?: MapTutorialStepKey | null;
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', color: 'bg-muted-foreground' },
  { key: 'services' as const, label: 'Service Presence', color: 'bg-service-presence' },
  { key: 'serviceLocations' as const, label: 'Provider Locations', color: 'bg-foreground' },
  { key: 'operationalCoverage' as const, label: 'Response Capability', color: 'bg-response-active' },
  { key: 'fteCapacity' as const, label: 'Staffing Capacity & Load', color: 'bg-staffing-medium' },
  { key: 'utilizationIntensity' as const, label: 'Service Utilization Intensity', color: 'bg-utilization-mid' },
  { key: 'engagementGap' as const, label: 'Engagement Gap', color: 'bg-engagement-gap' },
] as const;

const SECTION_HEADER_CLASSNAME = 'flex w-full items-center gap-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground';
const ROW_CLASSNAME = 'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-secondary';
const SECTION_CONTENT_CLASSNAME = 'mt-0.5 space-y-0.5';
const LEGEND_LABEL_CLASSNAME = 'text-[11px] text-muted-foreground';

const HelpIconTooltip = ({
  helpKey,
  onHelpEnter,
  onHelpLeave,
}: {
  helpKey: string;
  onHelpEnter?: (key: string) => void;
  onHelpLeave?: () => void;
}) => {
  const tooltip = HELP_TOOLTIPS[helpKey]?.shortExplanation;
  const [open, setOpen] = useState(false);

  const showTooltip = () => {
    setOpen(true);
    onHelpEnter?.(helpKey);
  };

  const hideTooltip = () => {
    setOpen(false);
    onHelpLeave?.();
  };

  const button = (
    <button
      type="button"
      className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onTouchStart={showTooltip}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((current) => {
          const next = !current;
          if (next) onHelpEnter?.(helpKey);
          else onHelpLeave?.();
          return next;
        });
      }}
      aria-label={`More information about ${HELP_TOOLTIPS[helpKey]?.label ?? helpKey}`}
    >
      <HelpCircle className="w-3 h-3" />
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={10} className="max-w-56 text-[11px] leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

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
  engagementRateBelow20Only,
  onEngagementRateBelow20OnlyChange,
  onCountySelect,
  onHelpEnter,
  onHelpLeave,
  onReplayTutorial,
  tutorialStepKey,
}: SidebarProps) => {
  const usePersistToggle = (key: string, defaultOpen = false) => {
    const [open, setOpen] = useState(() => {
      try { const v = localStorage.getItem(key); return v === null ? defaultOpen : v === 'true'; } catch { return defaultOpen; }
    });
    useEffect(() => {
      try { localStorage.setItem(key, String(open)); } catch {}
    }, [key, open]);
    const toggle = () => setOpen(prev => !prev);
    return [open, toggle, setOpen] as const;
  };

  const [facilitiesOpen, toggleFacilities] = usePersistToggle('sidebar_facilities');
  const [csvOpen, setCsvOpen] = useState(false);
  const [filtersOpen, toggleFilters] = usePersistToggle('sidebar_filters');
  const [coreMapOpen, toggleCoreMap, setCoreMapOpen] = usePersistToggle('sidebar_layer_core', true);
  const [operationsOpen, toggleOperations, setOperationsOpen] = usePersistToggle('sidebar_layer_ops');
  const [utilizationOpen, toggleUtilization] = usePersistToggle('sidebar_layer_util');
  const [accessOpen, toggleAccess, setAccessOpen] = usePersistToggle('sidebar_layer_access');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tutorialStepKey === 'serviceNetwork') setCoreMapOpen(true);
    if (tutorialStepKey === 'engagementGap') setOperationsOpen(true);
    if (tutorialStepKey === 'coverageRadius') setAccessOpen(true);
  }, [setAccessOpen, setCoreMapOpen, setOperationsOpen, tutorialStepKey]);

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

  const renderHelpIcon = (key: string) => (
    <HelpIconTooltip helpKey={key} onHelpEnter={onHelpEnter} onHelpLeave={onHelpLeave} />
  );

  const getLayerConfig = (key: keyof LayerState) => LAYER_CONFIG.find((layer) => layer.key === key)!;

  const renderSectionHeader = (label: string, open: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className={SECTION_HEADER_CLASSNAME}
    >
      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      <span>{label}</span>
    </button>
  );

  const renderLayerToggleRow = ({
    label,
    indicatorClassName,
    checked,
    onCheckedChange,
    helpKey,
    dataTutorial,
  }: {
    label: string;
    indicatorClassName: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    helpKey?: string;
    dataTutorial?: string;
  }) => (
    <div
      className={ROW_CLASSNAME}
      data-tutorial={dataTutorial}
    >
      <button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${indicatorClassName} ${checked ? 'opacity-100' : 'opacity-50'} transition-opacity duration-200`} />
        <span className={`truncate text-xs ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      </button>
      <div className="flex items-center gap-1">
        {helpKey ? renderHelpIcon(helpKey) : null}
        <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={`${checked ? 'Hide' : 'Show'} ${label}`} />
      </div>
    </div>
  );

  const renderLegendRow = ({
    label,
    sample,
    dimmed = false,
  }: {
    label: string;
    sample: ReactNode;
    dimmed?: boolean;
  }) => (
    <div className={`flex items-center gap-2 px-2 py-1 ${dimmed ? 'opacity-60' : ''}`}>
      <div className="flex h-4 w-10 items-center justify-start">{sample}</div>
      <span className={LEGEND_LABEL_CLASSNAME}>{label}</span>
    </div>
  );

  const renderLegendGradient = ({
    label,
    gradientStyle,
    low,
    high,
    dimmed = false,
  }: {
    label: string;
    gradientStyle: CSSProperties;
    low: string;
    high: string;
    dimmed?: boolean;
  }) => (
    <div className={`${dimmed ? 'opacity-60' : ''} px-2 py-1`}>
      <div className={LEGEND_LABEL_CLASSNAME}>{label}</div>
      <div className="mt-1.5 h-2 w-full rounded-sm" style={gradientStyle} />
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );

  const renderLegendGroup = ({
    title,
    open,
    onToggle,
    children,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
  }) => (
    <div>
      {renderSectionHeader(title, open, onToggle)}
      {open ? <div className={SECTION_CONTENT_CLASSNAME}>{children}</div> : null}
    </div>
  );

  return (
    <TooltipProvider delayDuration={120}>
    <div data-tutorial="sidebar" className="flex h-full w-full flex-col overflow-y-auto bg-card shadow-[var(--shadow-panel)] md:w-80">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Rural Operations Map</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Nevada Behavioral Health</p>
          </div>
          {onReplayTutorial && (
            <button
              type="button"
              onClick={onReplayTutorial}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Replay Tutorial
            </button>
          )}
        </div>
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
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFilters}
            className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold text-foreground transition-colors hover:text-foreground/80"
          >
            {filtersOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span>Filters</span>
          </button>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground font-mono">
                {activeFilterCount}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Clear facility filters"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {filtersOpen && (
          <div className="space-y-3">
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">Type</div>
                <div className="flex gap-1.5">
                  {[
                    { value: 'hospital', label: 'Hospital', color: 'bg-hospital' },
                    { value: 'clinic', label: 'Clinic', color: 'bg-clinic' },
                  ].map(({ value, label, color }) => {
                    const active = filters.types.has(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleTypeFilter(value)}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-all duration-150 ${
                          active
                            ? 'bg-foreground font-medium text-background'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${color} ${active ? 'opacity-100' : 'opacity-50'}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">County</div>
                <div className="flex flex-wrap gap-1">
                  {allCounties.map((county) => {
                    const active = filters.counties.has(county);
                    return (
                      <button
                        key={county}
                        type="button"
                        onClick={() => toggleCountyFilter(county)}
                        className={`rounded px-2 py-0.5 text-[11px] transition-all duration-150 ${
                          active
                            ? 'bg-foreground font-medium text-background'
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

            <div className="space-y-3 border-t border-border pt-3">
              <div className="space-y-2">
                <div>
                  {renderSectionHeader('CORE MAP', coreMapOpen, toggleCoreMap)}
                  {coreMapOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {(['counties', 'services', 'serviceLocations'] as const).map((key) => {
                        const { label, color } = getLayerConfig(key);
                        return renderLayerToggleRow({
                          label,
                          indicatorClassName: color,
                          checked: layers[key],
                          onCheckedChange: () => onToggleLayer(key),
                          helpKey: key,
                          dataTutorial: key === 'services' ? 'toggle-services' : undefined,
                        });
                      })}
                    </div>
                  )}
                </div>

                <div>
                  {renderSectionHeader('OPERATIONS', operationsOpen, toggleOperations)}
                  {operationsOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {(['operationalCoverage', 'fteCapacity', 'engagementGap'] as const).map((key) => {
                        const { label, color } = getLayerConfig(key);
                        return (
                          <div key={key}>
                            {renderLayerToggleRow({
                              label,
                              indicatorClassName: color,
                              checked: layers[key],
                              onCheckedChange: () => onToggleLayer(key),
                              helpKey: key,
                              dataTutorial: key === 'engagementGap' ? 'toggle-engagement-gap' : undefined,
                            })}

                            {key === 'operationalCoverage' && layers.operationalCoverage && (() => {
                              const radius = coverageRadiusKm ?? 120;
                              const counts = { active: 0, scheduled: 0, remote: 0 };

                              nevadaCounties.forEach((c) => {
                                const bd = getCountyCoverageBreakdown(c.name, radius);
                                if (bd.activePercent >= 50) counts.active++;
                                else if (bd.activePercent > 0 || bd.anchoringFtes.length > 0) counts.scheduled++;
                                else counts.remote++;
                              });

                              return (
                                <div className="space-y-2.5 px-2 pb-2 pt-1.5">
                                  <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Field Coverage Status</div>
                                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: 'hsl(174, 50%, 40%)' }} />
                                        <span><span className="font-semibold text-foreground">{counts.active}</span> counties with same-day field response</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: 'hsl(190, 55%, 50%)' }} />
                                        <span><span className="font-semibold text-foreground">{counts.scheduled}</span> counties with scheduled outreach only</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: 'hsl(220, 10%, 70%)' }} />
                                        <span><span className="font-semibold text-foreground">{counts.remote}</span> counties with remote-only support</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                                    <div className="mb-1 flex items-center justify-between">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Field Response Radius</span>
                                      <span className="text-[11px] font-bold tabular-nums text-foreground">
                                        ~{Math.round((radius / 80) * 60)} min (~{kmToMiles(radius)} mi)
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={40}
                                      max={200}
                                      step={10}
                                      value={radius}
                                      onChange={(e) => onCoverageRadiusKmChange?.(Number(e.target.value))}
                                      className="h-1.5 w-full cursor-pointer accent-teal-600"
                                    />
                                    <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
                                      <span>~30 min (~25 mi)</span>
                                      <span>~150 min (~124 mi)</span>
                                    </div>
                                    <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/70">Defines the maximum same-day response range from field staff base.</p>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Response Capability</div>
                                    {[
                                      { label: 'Same-Day Field Response Available', desc: 'In-person response within ~75–90 minutes of FTE base.', color: 'hsl(174, 50%, 40%)', opacity: 0.85, style: 'solid' as const },
                                      { label: 'Field Response Available (Planned)', desc: 'In-person visits require scheduling. Not same-day.', color: 'hsl(190, 55%, 50%)', opacity: 0.55, style: 'dashed' as const },
                                      { label: 'Remote Support Only', desc: 'No in-person response. Telephonic and virtual coordination only.', color: 'hsl(220, 10%, 64%)', opacity: 0.35, style: 'dashed' as const },
                                    ].map(({ label: lbl, desc, color: clr, opacity, style }) => (
                                      <div key={lbl} className="flex gap-2">
                                        <div className="mt-0.5 flex-shrink-0">
                                          <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: clr, opacity, border: style === 'dashed' ? `1.5px dashed ${clr}` : 'none' }} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[11px] font-medium leading-tight text-foreground" style={{ opacity }}>{lbl}</div>
                                          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{desc}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <p className="text-[9px] italic leading-relaxed text-muted-foreground/60">Coverage is based on real travel time, not straight-line distance.</p>
                                </div>
                              );
                            })()}

                            {key === 'fteCapacity' && layers.fteCapacity && (
                              <div className="space-y-2 px-2 pb-2 pt-1.5">
                                {fteCapacityData.filter((fte) => fte.hubLocation !== null).map((fte) => {
                                  const role = FTE_ROLE_COLORS[fte.id];
                                  const isSelected = selectedFteId === fte.id;
                                  const isDimmed = selectedFteId != null && !isSelected;
                                  const coverageLabel = fte.hubLocation ? 'Active Field Coverage' : 'Remote Only';

                                  return (
                                    <button key={fte.id} onClick={() => onFteCardClick?.(fte.id)} className={`w-full cursor-pointer rounded-md border-2 px-2 py-1.5 text-left transition-all duration-200 hover:shadow-sm ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-border'} ${isSelected ? 'ring-2 ring-primary ring-offset-1 shadow-md' : ''} ${isDimmed ? 'opacity-40' : ''}`}>
                                      <div className="mb-0.5 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: role?.primary }} />
                                          <span className="text-[11px] font-semibold text-foreground">{fte.label}</span>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-foreground/70">{coverageLabel}</div>
                                      <div className="mt-0.5 text-[10px] text-muted-foreground">{fte.counties.length} counties served</div>
                                    </button>
                                  );
                                })}

                                {(() => {
                                  const remote = fteCapacityData.find((f) => f.hubLocation === null);
                                  if (!remote) return null;

                                  const role = FTE_ROLE_COLORS[remote.id];
                                  const isRemoteSelected = selectedFteId === remote.id;
                                  const isRemoteDimmed = selectedFteId != null && !isRemoteSelected;

                                  return (
                                    <button onClick={() => onFteCardClick?.(remote.id)} className={`w-full cursor-pointer rounded-md border-2 border-dashed px-2 py-2 text-left transition-all duration-200 hover:shadow-sm ${role?.light ?? 'bg-secondary'} ${role?.border ?? 'border-muted-foreground/30'} ${isRemoteSelected ? 'ring-2 ring-primary ring-offset-1 shadow-md' : ''} ${isRemoteDimmed ? 'opacity-40' : ''}`}>
                                      <div className="mb-1 flex items-center gap-1.5">
                                        <Headphones className="h-3.5 w-3.5" style={{ color: role?.primary }} />
                                        <span className="text-[11px] font-bold text-foreground">Remote Coordination Team</span>
                                      </div>
                                      <div className="text-[10px] text-foreground/70">Remote Only</div>
                                      <div className="mt-1 text-[9px] text-muted-foreground">Statewide telephonic and virtual coordination (no in-person response)</div>
                                      <div className="mt-0.5 text-[10px] text-muted-foreground">{remote.counties.length} counties served</div>
                                    </button>
                                  );
                                })()}
                              </div>
                            )}

                            {key === 'engagementGap' && layers.engagementGap && (() => {
                              const results = getEngagementGapResults();
                              const rankedPriorityCounties = engagementRateBelow20Only
                                ? getFilteredEngagementPriorityCounties({ belowRateThreshold: 0.2 }).slice(0, 5)
                                : getTopUnengagedCounties(5);
                              const belowThresholdCount = getFilteredEngagementPriorityCounties({ belowRateThreshold: 0.2 }).length;
                              const rankedCountyTotal = getCountyEngagementRankings().filter((metrics) => metrics.totalMembers > 0).length;
                              const gapCounties = results.filter((r: any) => r.tier === 'gap');
                              const watchCounties = results.filter((r: any) => r.tier === 'watchlist');
                              const earlyCounties = results.filter((r: any) => r.tier === 'early-signal');
                              const hasAny = results.length > 0;

                              return (
                                <div className="space-y-1.5 px-2 pb-2 pt-1">
                                  <div className="space-y-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Outreach Priority</p>
                                        <p className="text-[10px] text-muted-foreground">Ranked by highest unengaged members, then lowest engagement rate.</p>
                                      </div>
                                      <button onClick={() => onEngagementRateBelow20OnlyChange(!engagementRateBelow20Only)} className="flex items-center gap-2 rounded px-1 py-1 text-[11px] transition-colors duration-200 hover:bg-background/70">
                                        <div className={`relative h-3.5 w-6 rounded-full transition-colors duration-200 ${engagementRateBelow20Only ? 'bg-destructive' : 'bg-input'}`}>
                                          <div className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-card shadow-sm transition-all duration-200 ${engagementRateBelow20Only ? 'left-3' : 'left-0.5'}`} />
                                        </div>
                                        <span className={engagementRateBelow20Only ? 'font-medium text-foreground' : 'text-muted-foreground'}>Rate &lt; 20%</span>
                                      </button>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">Counties below 20% engagement</span>
                                      <span className="tabular-nums font-semibold text-foreground">{belowThresholdCount} of {rankedCountyTotal}</span>
                                    </div>

                                    {rankedPriorityCounties.length > 0 ? (
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-semibold text-destructive">
                                          Top 5 unengaged counties{engagementRateBelow20Only ? ' (filtered)' : ''}
                                        </p>
                                        {rankedPriorityCounties.map((metrics) => (
                                          <button
                                            key={metrics.county}
                                            type="button"
                                            onClick={() => onCountySelect?.(metrics.county)}
                                            className="w-full rounded-sm px-1 py-0.5 text-left text-[10px] leading-relaxed text-foreground transition-colors duration-150 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                          >
                                            <span className={`font-semibold ${metrics.isTop5Unengaged ? 'text-destructive' : 'text-foreground'}`}>#{metrics.rank}</span>{' '}
                                            <span className="font-medium">{metrics.county}</span>
                                            <span className="text-muted-foreground"> — </span>
                                            <span className="tabular-nums font-semibold">{metrics.unengagedMembers.toLocaleString()}</span>{' '}
                                            <span className="text-muted-foreground">unengaged</span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] italic text-muted-foreground">No counties match the current engagement-rate filter.</p>
                                    )}
                                  </div>

                                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                                    <span className="font-medium" style={{ color: 'hsl(30, 90%, 50%)' }}>Orange</span> = True Gap (&gt;15 VPM).{' '}
                                    <span className="font-medium" style={{ color: 'hsl(48, 90%, 50%)' }}>Yellow</span> = Watchlist (10–15).{' '}
                                    <span className="font-medium" style={{ color: 'hsl(200, 70%, 55%)' }}>Blue</span> = Early Signal (6–10).
                                  </p>

                                  {!hasAny && <p className="text-[10px] italic text-muted-foreground/60">No counties currently meet Engagement Gap or Early Signal thresholds.</p>}

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

                                  <p className="text-[10px] italic leading-relaxed text-muted-foreground/70">Urban Washoe (Reno/Sparks core) and Carson City are excluded. Northern Washoe is included as rural service area.</p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  {renderSectionHeader('UTILIZATION', utilizationOpen, toggleUtilization)}
                  {utilizationOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {(() => {
                        const { key, label, color } = getLayerConfig('utilizationIntensity');
                        return (
                          <div key={key}>
                            {renderLayerToggleRow({
                              label,
                              indicatorClassName: color,
                              checked: layers.utilizationIntensity,
                              onCheckedChange: () => onToggleLayer('utilizationIntensity'),
                              helpKey: key,
                            })}
                            {layers.utilizationIntensity && (
                              <div className="space-y-1.5 px-2 pb-2 pt-1.5">
                                <p className="text-[10px] leading-relaxed text-muted-foreground">County shading by avg visits per member. Purple ramp — darker = higher utilization.</p>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2.5 flex-1 rounded-sm" style={{ background: 'linear-gradient(to right, hsla(270, 30%, 75%, 0.5), hsla(270, 45%, 55%, 0.7), hsla(270, 60%, 40%, 0.9))' }} />
                                </div>
                                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                                  <span>Low (&lt;10)</span>
                                  <span>Mod (10–18)</span>
                                  <span>High (&gt;18)</span>
                                </div>
                                <button onClick={() => onTopProvidersOnlyChange(!topProvidersOnly)} className="mt-1 flex w-full items-center gap-2 rounded px-1 py-1 text-[11px] transition-colors duration-200 hover:bg-secondary">
                                  <div className={`relative h-3.5 w-6 rounded-full transition-colors duration-200 ${topProvidersOnly ? 'bg-primary' : 'bg-input'}`}>
                                    <div className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-card shadow-sm transition-all duration-200 ${topProvidersOnly ? 'left-3' : 'left-0.5'}`} />
                                  </div>
                                  <span className={topProvidersOnly ? 'font-medium text-foreground' : 'text-muted-foreground'}>Top Providers Only (Top 20)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  {renderSectionHeader('ACCESS', accessOpen, toggleAccess)}
                  {accessOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {renderLayerToggleRow({
                        label: `Provider Coverage Radius (${kmToMiles(radiusKm)} mi)`,
                        indicatorClassName: 'bg-primary',
                        checked: coverageRadius,
                        onCheckedChange: onCoverageRadiusChange,
                        helpKey: 'coverageRadius',
                        dataTutorial: 'toggle-coverage-radius',
                      })}
                      <div className="px-2 pb-1 pt-0.5">
                        <input
                          type="range"
                          min={10}
                          max={150}
                          step={5}
                          value={radiusKm}
                          onChange={(e) => onRadiusChange(Number(e.target.value))}
                          className="h-1 w-full cursor-pointer accent-primary"
                          aria-label="Provider coverage radius"
                        />
                        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
                          <span>6 mi</span>
                          <span>93 mi</span>
                        </div>
                      </div>

                      {renderLayerToggleRow({
                        label: 'Access Gaps (Outside Coverage Radius)',
                        indicatorClassName: 'bg-destructive',
                        checked: coverageGaps,
                        onCheckedChange: onCoverageGapsChange,
                        helpKey: 'coverageGaps',
                      })}
                      {coverageGaps && (
                        <p className="px-2 pb-1 pt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                          Counties highlighted in red fall outside the current provider coverage radius of <span className="font-medium text-foreground">{kmToMiles(radiusKm)} mi</span>.
                        </p>
                      )}
                      <p className="px-2 pb-0.5 text-[9px] italic text-muted-foreground/60">Access gaps use the current provider coverage radius setting ({kmToMiles(radiusKm)} mi).</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-3" data-tutorial="legend">
                {renderLegendGroup({
                  title: 'CORE MAP',
                  open: coreMapOpen,
                  onToggle: toggleCoreMap,
                  children: (
                    <>
                      {renderLegendRow({
                        label: 'County Boundaries',
                        dimmed: !layers.counties,
                        sample: <div className="h-px w-8 bg-muted-foreground" />,
                      })}
                      {renderLegendRow({
                        label: 'Service Presence',
                        dimmed: !layers.services,
                        sample: (
                          <div className="relative h-4 w-8">
                            <span className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-service-presence/20" />
                            <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-service-presence" />
                          </div>
                        ),
                      })}
                      {renderLegendRow({
                        label: 'Provider Locations',
                        dimmed: !layers.serviceLocations,
                        sample: (
                          <div className="flex items-center gap-1">
                            <span className="h-3.5 w-3.5 rounded-full border border-background bg-hospital shadow-sm" />
                            <span className="h-3 w-3 rounded-full border border-background bg-clinic shadow-sm" />
                          </div>
                        ),
                      })}
                    </>
                  ),
                })}

                {renderLegendGroup({
                  title: 'OPERATIONS',
                  open: operationsOpen,
                  onToggle: toggleOperations,
                  children: (
                    <>
                      {renderLegendRow({
                        label: 'Response Capability',
                        dimmed: !layers.operationalCoverage,
                        sample: (
                          <div className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded-sm border border-response-active/60 bg-response-active/25" />
                            <span className="h-3 w-3 rounded-sm border border-dashed border-response-scheduled/50 bg-response-scheduled/10" />
                            <span className="h-3 w-3 rounded-sm border border-dashed border-response-remote/40 bg-response-remote/10" />
                          </div>
                        ),
                      })}
                      {renderLegendRow({
                        label: 'Staffing Capacity & Load',
                        dimmed: !layers.fteCapacity,
                        sample: (
                          <div className="flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-staffing-low" />
                            <span className="h-2.5 w-2.5 rounded-full bg-staffing-medium" />
                            <span className="h-2.5 w-2.5 rounded-full bg-staffing-high" />
                          </div>
                        ),
                      })}
                      {renderLegendGradient({
                        label: 'Engagement Gap',
                        dimmed: !layers.engagementGap,
                        gradientStyle: { background: 'linear-gradient(to right, hsl(var(--engagement-early)), hsl(var(--engagement-watch)), hsl(var(--engagement-gap)))' },
                        low: 'Low',
                        high: 'High',
                      })}
                    </>
                  ),
                })}

                {renderLegendGroup({
                  title: 'UTILIZATION',
                  open: utilizationOpen,
                  onToggle: toggleUtilization,
                  children: renderLegendGradient({
                    label: 'Service Utilization Intensity',
                    dimmed: !layers.utilizationIntensity,
                    gradientStyle: { background: 'linear-gradient(to right, hsl(var(--utilization-low) / 0.5), hsl(var(--utilization-mid) / 0.7), hsl(var(--utilization-high) / 0.9))' },
                    low: 'Low',
                    high: 'High',
                  }),
                })}

                {renderLegendGroup({
                  title: 'ACCESS',
                  open: accessOpen,
                  onToggle: toggleAccess,
                  children: (
                    <>
                      {renderLegendRow({
                        label: `Provider Coverage Radius (${kmToMiles(radiusKm)} mi)`,
                        dimmed: !coverageRadius,
                        sample: (
                          <div className="relative h-4 w-8">
                            <span className="absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-radius-stroke/60 bg-radius-stroke/10" />
                          </div>
                        ),
                      })}
                      {renderLegendRow({
                        label: 'Access Gaps (Outside Coverage Radius)',
                        dimmed: !coverageGaps,
                        sample: <span className="h-3 w-6 rounded-sm border border-destructive/30 bg-destructive/15" />,
                      })}
                    </>
                  ),
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mx-4 border-t border-border" />

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
    </TooltipProvider>
  );
};

export default Sidebar;
