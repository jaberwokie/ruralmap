import { useState, useRef, useMemo } from 'react';
import { Search, Upload, ChevronDown, ChevronRight, Filter, X } from 'lucide-react';
import { Facility, FacilityType } from '@/data/facilities';
import { toast } from 'sonner';
import { Filters } from '@/pages/Index';

interface LayerState {
  counties: boolean;
  hospitals: boolean;
  clinics: boolean;
  zones: boolean;
  tier1: boolean;
  radius: boolean;
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
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', color: 'bg-muted-foreground' },
  { key: 'hospitals' as const, label: 'Hospitals', color: 'bg-hospital' },
  { key: 'clinics' as const, label: 'Clinics / FQHCs', color: 'bg-clinic' },
  { key: 'zones' as const, label: 'Operational Zones', color: 'bg-primary/30' },
  { key: 'tier1' as const, label: 'Tier 1 Providers', color: 'bg-green-500' },
  { key: 'radius' as const, label: 'Coverage Radius (50 km)', color: 'bg-primary' },
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

  const activeFilterCount = filters.types.size + filters.counties.size;

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

  const clearFilters = () => {
    onFiltersChange({ types: new Set(), counties: new Set() });
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
    <div className="w-80 h-full bg-card flex flex-col" style={{ boxShadow: 'var(--shadow-panel)' }}>
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
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
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
                  { value: 'tier1', label: 'Tier 1', color: 'bg-green-500' },
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
        <div className="space-y-1">
          {LAYER_CONFIG.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => onToggleLayer(key)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs hover:bg-secondary transition-colors duration-200"
            >
              <div className={`w-2.5 h-2.5 rounded-sm ${color} ${!layers[key] ? 'opacity-20' : ''} transition-opacity duration-200`} />
              <span className={`flex-1 text-left ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${layers[key] ? 'bg-primary' : 'bg-input'} relative`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-card shadow-sm transition-all duration-200 ${layers[key] ? 'left-3.5' : 'left-0.5'}`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Zone Legend */}
      <div className="px-4 pb-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Zone Legend
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 px-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(217, 91%, 60%, 0.12)', border: '1px solid hsla(217, 91%, 60%, 0.4)' }} />
            <span className="text-muted-foreground">Primary (Field-Based)</span>
          </div>
          <div className="flex items-center gap-2 px-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(35, 92%, 50%, 0.08)', border: '1px solid hsla(35, 92%, 50%, 0.3)' }} />
            <span className="text-muted-foreground">Secondary (Virtual-First)</span>
          </div>
          <div className="flex items-center gap-2 px-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'hsla(240, 5%, 64%, 0.05)', border: '1px solid hsla(240, 5%, 64%, 0.2)' }} />
            <span className="text-muted-foreground">Frontier (Low-Touch)</span>
          </div>
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
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-4">
        <button
          onClick={() => setFacilitiesOpen(!facilitiesOpen)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors"
        >
          {facilitiesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Facilities ({displayFacilities.length})
        </button>
        {facilitiesOpen && (
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {displayFacilities.map(facility => (
              <button
                key={facility.id}
                onClick={() => onFacilityClick(facility)}
                className="w-full text-left px-2 py-2 rounded hover:bg-secondary transition-colors duration-150"
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    facility.type === 'hospital' ? 'bg-hospital' :
                    facility.type === 'tier1' ? 'bg-green-500' : 'bg-clinic'
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
