import { useState, useRef, useMemo } from 'react';
import { Search, Upload, ChevronDown, ChevronRight, Filter, X } from 'lucide-react';
import { Facility, FacilityType } from '@/data/facilities';
import { toast } from 'sonner';
import { Filters } from '@/pages/Index';
import { RURAL_SERVICE_CATEGORIES } from '@/data/rural-services';

interface LayerState {
  counties: boolean;
  serviceLocations: boolean;
  memberVolume: boolean;
  ruralServices: boolean;
  operationalCoverage: boolean;
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
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', color: 'bg-muted-foreground' },
  { key: 'zones' as const, label: 'Coverage Areas', color: 'bg-primary/30' },
  { key: 'serviceLocations' as const, label: 'Service Locations', color: 'bg-foreground' },
  { key: 'memberVolume' as const, label: 'Member Volume', color: 'bg-teal-500' },
  { key: 'ruralServices' as const, label: 'Rural Services (Resource Guide)', color: 'bg-slate-500' },
  { key: 'operationalCoverage' as const, label: 'Operational Coverage Model', color: 'bg-teal-600' },
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
  focusedArea,
  onFocusedAreaChange,
}: SidebarProps) => {
  const [facilitiesOpen, setFacilitiesOpen] = useState(true);
  const [csvOpen, setCsvOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Counts from filtered set
  const hospitalCount = facilities.filter(f => f.type === 'hospital').length;
  const clinicCount = facilities.filter(f => f.type === 'clinic').length;
  const tier1Count = facilities.filter(f => f.type === 'tier1').length;
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
        const type: FacilityType = rawType.includes('hospital') ? 'hospital' :
                                    rawType.includes('tier') ? 'tier1' : 'clinic';

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
        {tier1Count > 0 && (
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tier1 inline-block" />
            <span className="font-mono font-medium text-foreground">{tier1Count}</span> Tier 1
          </span>
        )}
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
          onClick={() => setFiltersOpen(!filtersOpen)}
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
                  { value: 'tier1', label: 'Tier 1', color: 'bg-tier1' },
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

            {/* Service Category Filter */}
            {layers.ruralServices && (
              <div>
                <div className="text-[10px] text-muted-foreground font-medium mb-1.5 px-1">Service Category</div>
                <div className="flex flex-wrap gap-1">
                  {RURAL_SERVICE_CATEGORIES.map(cat => {
                    const active = filters.serviceCategories.has(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleServiceCategoryFilter(cat)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all duration-150 ${
                          active
                            ? 'bg-foreground text-background font-medium'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border mx-4" />

      {/* Coverage Area Selector */}
      <div className="px-4 py-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Focus Area
        </div>
        <div className="flex gap-1.5">
          {([
            { key: 'area1' as CoverageArea, label: 'Area 1', color: 'hsla(142, 71%, 45%', solid: 'hsl(142, 71%, 45%)' },
            { key: 'area2' as CoverageArea, label: 'Area 2', color: 'hsla(35, 92%, 50%', solid: 'hsl(35, 92%, 50%)' },
            { key: 'area3' as CoverageArea, label: 'Area 3', color: 'hsla(217, 91%, 60%', solid: 'hsl(217, 91%, 60%)' },
          ]).map(({ key, label, color, solid }) => {
            const active = focusedArea === key;
            return (
              <button
                key={key}
                onClick={() => onFocusedAreaChange(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-all duration-150 ${
                  active
                    ? 'font-medium shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                style={active ? { background: `${color}, 0.18)`, color: solid, borderWidth: 1, borderColor: `${color}, 0.5)` } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: solid, opacity: active ? 1 : 0.5 }}
                />
                {label}
              </button>
            );
          })}
        </div>
        {focusedArea && (
          <button
            onClick={() => onFocusedAreaChange(focusedArea)}
            className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Clear focus
          </button>
        )}
      </div>

      <div className="border-t border-border mx-4" />

      {/* Layer Manager */}
      <div className="px-4 py-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Layers
        </div>
        <div className="space-y-1">
          {LAYER_CONFIG.map(({ key, label, color }) => (
            <div key={key}>
              <button
                onClick={() => onToggleLayer(key)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary"
              >
                <div className={`w-2.5 h-2.5 rounded-sm ${color} ${!layers[key] ? 'opacity-20' : ''} transition-opacity duration-200`} />
                <span className={`flex-1 text-left ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${layers[key] ? 'bg-primary' : 'bg-input'} relative`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${layers[key] ? 'left-3.5' : 'left-0.5'}`} />
                </div>
              </button>
              {key === 'memberVolume' && layers.memberVolume && (
                <div className="px-2 pb-1 pt-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-2.5 rounded-sm" style={{
                      background: 'linear-gradient(to right, hsl(190, 40%, 92%), hsl(190, 55%, 64%), hsl(190, 70%, 37%))'
                    }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                    <span>0</span>
                    <span>5,000</span>
                    <span>10,764</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Member count by county. Darker = higher volume.
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Coverage Radius — standalone */}
          <div className={!layers.serviceLocations ? 'opacity-50 pointer-events-none' : ''}>
            <button
              onClick={() => onCoverageRadiusChange(!coverageRadius)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary"
            >
              <div className={`w-2.5 h-2.5 rounded-sm bg-primary ${!coverageRadius ? 'opacity-20' : ''} transition-opacity duration-200`} />
              <span className={`flex-1 text-left ${coverageRadius ? 'text-foreground' : 'text-muted-foreground'}`}>
                Coverage Radius ({radiusKm} km)
              </span>
              <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${coverageRadius ? 'bg-primary' : 'bg-input'} relative`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${coverageRadius ? 'left-3.5' : 'left-0.5'}`} />
              </div>
            </button>
            {coverageRadius && (
              <div className="px-2 pb-1 pt-0.5">
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={radiusKm}
                  onChange={(e) => onRadiusChange(Number(e.target.value))}
                  className="w-full h-1 accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-0.5">
                  <span>10 km</span>
                  <span>150 km</span>
                </div>
              </div>
            )}
          </div>

          {/* Coverage Gaps — independent toggle */}
          <div>
            <button
              onClick={() => onCoverageGapsChange(!coverageGaps)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors duration-200 hover:bg-secondary"
            >
              <div className={`w-2.5 h-2.5 rounded-sm bg-destructive ${!coverageGaps ? 'opacity-20' : ''} transition-opacity duration-200`} />
              <span className={`flex-1 text-left ${coverageGaps ? 'text-foreground' : 'text-muted-foreground'}`}>
                Coverage Gaps
              </span>
              <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${coverageGaps ? 'bg-primary' : 'bg-input'} relative`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${coverageGaps ? 'left-3.5' : 'left-0.5'}`} />
              </div>
            </button>
            {coverageGaps && (
              <p className="px-2 pb-1 pt-0.5 text-[10px] text-muted-foreground leading-relaxed">
                Counties highlighted in red have no hospital within <span className="font-medium text-foreground">{radiusKm} km</span>.
              </p>
            )}
            <p className="px-2 pb-0.5 text-[9px] text-muted-foreground/60 italic">
              Gaps use the radius setting ({radiusKm} km) independently of the radius overlay.
            </p>
          </div>
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
              <div className="flex items-center gap-2 px-2">
                <div className="w-3 h-3 flex-shrink-0" style={{ background: 'hsl(45, 93%, 47%)', border: '1.5px solid white', boxShadow: '0 0 0 1px hsla(0, 0%, 0%, 0.15)', transform: 'rotate(45deg)' }} />
                <span className="text-muted-foreground">Tier 1</span>
              </div>
            </div>
          </div>
          {/* Coverage Areas */}
          <div>
            <div className="text-[10px] text-muted-foreground font-medium mb-1 px-2">Coverage Areas</div>
            <div className="space-y-1">
              {([
                { key: 'area1' as CoverageArea, label: 'Area 1 — Western Hub', bg: 'hsla(142, 71%, 45%, 0.35)', border: '1px dashed hsla(142, 71%, 45%, 0.65)' },
                { key: 'area2' as CoverageArea, label: 'Area 2 — Northern / Rural Hub', bg: 'hsla(35, 92%, 50%, 0.25)', border: '1px dashed hsla(35, 92%, 50%, 0.50)' },
                { key: 'area3' as CoverageArea, label: 'Area 3 — Southern / Rural Hub', bg: 'hsla(217, 91%, 60%, 0.15)', border: '1px dashed hsla(217, 91%, 60%, 0.40)' },
              ])
                .filter(({ key }) => !focusedArea || key === focusedArea)
                .map(({ key, label, bg, border }) => (
                  <div key={key} className="flex items-center gap-2 px-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: bg, border }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
            </div>
          </div>
          {/* Operational Coverage */}
          {layers.operationalCoverage && (
            <div>
              <div className="text-[10px] text-muted-foreground font-medium mb-1 px-2">Operational Coverage</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(174, 50%, 45%, 0.25)', border: '1.5px solid hsla(174, 50%, 40%, 0.6)' }} />
                  <span className="text-muted-foreground">Active Field Coverage</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(174, 40%, 55%, 0.12)', border: '1.5px dashed hsla(174, 40%, 50%, 0.45)' }} />
                  <span className="text-muted-foreground">Scheduled Outreach</span>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(220, 10%, 70%, 0.10)', border: '1.5px dashed hsla(220, 10%, 60%, 0.25)' }} />
                  <span className="text-muted-foreground">Remote Support Only</span>
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
          onClick={() => setFacilitiesOpen(!facilitiesOpen)}
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
                      facility.type === 'hospital' ? 'bg-hospital' :
                      facility.type === 'tier1' ? 'bg-tier1' : 'bg-clinic'
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
