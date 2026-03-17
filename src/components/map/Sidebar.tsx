import { useState, useRef } from 'react';
import { Search, Upload, ChevronDown, ChevronRight, MapPin, Building2, Plus } from 'lucide-react';
import { Facility, FacilityType } from '@/data/facilities';

interface LayerState {
  counties: boolean;
  hospitals: boolean;
  clinics: boolean;
  zones: boolean;
  tier1: boolean;
}

interface SidebarProps {
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
  facilities: Facility[];
  onAddFacilities: (facilities: Facility[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFacilityClick: (facility: Facility) => void;
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', color: 'bg-muted-foreground' },
  { key: 'hospitals' as const, label: 'Hospitals', color: 'bg-hospital' },
  { key: 'clinics' as const, label: 'Clinics / FQHCs', color: 'bg-clinic' },
  { key: 'zones' as const, label: 'Operational Zones', color: 'bg-primary/30' },
  { key: 'tier1' as const, label: 'Tier 1 Providers', color: 'bg-green-500' },
];

const Sidebar = ({
  layers,
  onToggleLayer,
  facilities,
  onAddFacilities,
  searchQuery,
  onSearchChange,
  onFacilityClick,
}: SidebarProps) => {
  const [facilitiesOpen, setFacilitiesOpen] = useState(true);
  const [csvOpen, setCsvOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hospitalCount = facilities.filter(f => f.type === 'hospital').length;
  const clinicCount = facilities.filter(f => f.type === 'clinic').length;
  const tier1Count = facilities.filter(f => f.type === 'tier1').length;

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const typeIdx = headers.indexOf('type');
      const cityIdx = headers.indexOf('city');
      const countyIdx = headers.indexOf('county');
      const latIdx = headers.indexOf('latitude') !== -1 ? headers.indexOf('latitude') : headers.indexOf('lat');
      const lngIdx = headers.indexOf('longitude') !== -1 ? headers.indexOf('longitude') : headers.indexOf('lng');

      if (nameIdx === -1 || latIdx === -1 || lngIdx === -1) return;

      const newFacilities: Facility[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const lat = parseFloat(cols[latIdx]);
        const lng = parseFloat(cols[lngIdx]);
        if (isNaN(lat) || isNaN(lng)) continue;

        const rawType = (cols[typeIdx] || 'clinic').toLowerCase();
        const type: FacilityType = rawType.includes('hospital') ? 'hospital' :
                                    rawType.includes('tier') ? 'tier1' : 'clinic';

        newFacilities.push({
          id: `csv-${Date.now()}-${i}`,
          name: cols[nameIdx] || `Facility ${i}`,
          type,
          city: cols[cityIdx] || '',
          county: cols[countyIdx] || '',
          lat,
          lng,
        });
      }

      if (newFacilities.length > 0) {
        onAddFacilities(newFacilities);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredFacilities = searchQuery
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
        <p className="text-xs text-muted-foreground mt-0.5">
          Nevada Behavioral Health
        </p>
      </div>

      {/* Stats Bar */}
      <div className="px-4 pb-3 flex gap-3 text-xs">
        <span className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{hospitalCount}</span> Hospitals
        </span>
        <span className="text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{clinicCount}</span> Clinics
        </span>
        {tier1Count > 0 && (
          <span className="text-muted-foreground">
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

      {/* Layer Manager */}
      <div className="px-4 pb-3">
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
              Required: name, latitude, longitude. Optional: type, city, county.
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
          Facilities ({filteredFacilities.length})
        </button>
        {facilitiesOpen && (
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {filteredFacilities.map(facility => (
              <button
                key={facility.id}
                onClick={() => onFacilityClick(facility)}
                className="w-full text-left px-2 py-2 rounded hover:bg-secondary transition-colors duration-150 group"
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
