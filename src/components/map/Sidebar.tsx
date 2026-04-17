import { useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type MouseEvent, type KeyboardEvent, type TouchEvent } from 'react';
import novumLogo from '@/assets/novumhealth-logo.svg';
import MapExplainerModal from './MapExplainerModal';
import { Search, Upload, ChevronDown, ChevronRight, X, Brain, Headphones, HelpCircle, Map as MapIcon, Layers3, MapPin, Radio, Users, Activity, BarChart3, Circle, TriangleAlert, Wifi, Signal, Landmark, Check, Flame, Grid3X3, Download, TrainFront, Route, type LucideIcon } from 'lucide-react';
import { HELP_TOOLTIPS } from '@/data/help-tooltips';
import { Facility, FacilityType, getFacilityClassification, getFacilityDataConfidence } from '@/data/facilities';
import { exportCsv } from '@/utils/csvExport';
import { parseFacilityCsv, type CsvImportResult } from '@/utils/csvImport';

import { toast } from 'sonner';
import VerificationPriorityPanel, { VerificationAuditHistoryPanel } from './VerificationPriorityPanel';
import type { Filters } from '@/types/filters';
import type { LayerState, EngagementGapView } from '@/types/layers';
import { RURAL_SERVICE_CATEGORIES } from '@/data/rural-services';
import { enrichedRuralServices as ruralServices } from '@/data/enriched-rural-services';
import { localTransitProviders, LOCAL_TRANSIT_SUPPORT_LEVEL_LABELS } from '@/data/local-transit-providers';
import { isBehavioralHealthService, isCommunitySupportService } from '@/utils/ruralServiceClassification';
import { tribalNations } from '@/data/tribal-nations';
import { fteCapacityData, getLoadStatus, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUS_GUIDANCE, FTE_ROLE_COLORS } from '@/data/fte-capacity';
import { kmToMiles, getCountyCoverageBreakdown } from '@/utils/coverageZones';
import { getProviderAccessTierByKm, getProviderAccessTierByMiles, PROVIDER_ACCESS_TIER_LABELS } from '@/utils/providerAccessTiers';
import { sortEntitiesByOperationalPriority } from '@/utils/entitySortOrder';
import { nevadaCounties } from '@/data/nevada-counties';
import { getCountyEngagementRankings, getEngagementGapResults, getFilteredEngagementPriorityCounties, getTopUnengagedCounties } from '@/utils/utilizationAggregation';
import { COUNTY_BROADBAND_DATA } from '@/data/broadband-coverage';
import { COUNTY_CELLULAR_DATA } from '@/data/cellular-coverage';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { MAP_PIN_VISUALS, getSharedPinSvgMarkup } from '@/components/map/pinVisuals';
import { RESPONSE_CAPABILITY_META, getResponseCapabilityMarkerHtml, type ResponseCapabilityCategory } from '@/components/map/responseCapabilityVisuals';
import DemandUtilizationPanel from '@/components/map/utilization/DemandUtilizationPanel';
import { usePermissions } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

// LayerState imported from @/types/layers

export interface SidebarLayerProps {
  layers: LayerState;
  onToggleLayer: (layer: keyof LayerState) => void;
  onSetLayers?: React.Dispatch<React.SetStateAction<LayerState>>;
  coverageRadius: boolean;
  coverageGaps: boolean;
  onCoverageRadiusChange: (checked: boolean) => void;
  onCoverageGapsChange: (checked: boolean) => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  coverageRadiusKm: number;
  onCoverageRadiusKmChange?: (km: number) => void;
  engagementGapView: EngagementGapView;
  onEngagementGapViewChange: (view: EngagementGapView) => void;
}

export interface SidebarFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  topProvidersOnly: boolean;
  onTopProvidersOnlyChange: (checked: boolean) => void;
  engagementRateBelow20Only: boolean;
  onEngagementRateBelow20OnlyChange: (checked: boolean) => void;
}

export interface SidebarFacilityProps {
  allFacilities: Facility[];
  facilities: Facility[];
  onAddFacilities: (facilities: Facility[]) => void;
  onFacilityClick: (facility: Facility) => void;
}

export interface SidebarSelectionProps {
  selectedFteId?: string | null;
  onFteCardClick?: (fteId: string) => void;
  onCountySelect?: (county: string) => void;
  onTransitProviderClick?: (providerId: string) => void;
}

interface SidebarProps {
  layer: SidebarLayerProps;
  filter: SidebarFilterProps;
  facility: SidebarFacilityProps;
  selection: SidebarSelectionProps;
}

const LAYER_CONFIG = [
  { key: 'counties' as const, label: 'County Boundaries', colorClassName: 'text-muted-foreground', icon: MapIcon },
  { key: 'tribalNations' as const, label: 'Tribal Nations', colorClassName: 'text-tribal-nation', icon: Landmark },
  { key: 'services' as const, label: 'Services', colorClassName: 'text-service-presence', icon: Layers3 },
  { key: 'behavioralHealth' as const, label: 'Behavioral Health', colorClassName: 'text-behavioral-health', icon: Brain },
  { key: 'serviceLocations' as const, label: 'Provider Locations', colorClassName: 'text-foreground', icon: MapPin },
  { key: 'operationalCoverage' as const, label: 'Response Capability', colorClassName: 'text-response-active', icon: Radio },
  { key: 'fteCapacity' as const, label: 'Staffing Capacity & Load', colorClassName: 'text-staffing-medium', icon: Users },
  { key: 'utilizationIntensity' as const, label: 'Service Utilization Intensity', colorClassName: 'text-utilization-mid', icon: Activity },
  { key: 'engagementGap' as const, label: 'Gap Overlay', colorClassName: 'text-engagement-gap', icon: BarChart3 },
] as const;

const ACCESS_LAYER_CONFIG = {
  coverageRadius: {
    label: 'Provider Coverage Radius',
    colorClassName: 'text-primary',
    icon: Circle,
  },
  coverageGaps: {
    label: 'Access Gaps (Outside Coverage Radius)',
    colorClassName: 'text-destructive',
    icon: TriangleAlert,
  },
} as const;

const PROVIDER_COVERAGE_RADIUS_MIN_KM = 10;
const PROVIDER_COVERAGE_RADIUS_MAX_KM = 150;
const PROVIDER_COVERAGE_RADIUS_DEFAULT_KM = 32;
const PROVIDER_COVERAGE_RADIUS_MIN_MI = kmToMiles(PROVIDER_COVERAGE_RADIUS_MIN_KM);
const PROVIDER_COVERAGE_RADIUS_MAX_MI = kmToMiles(PROVIDER_COVERAGE_RADIUS_MAX_KM);
const MILES_TO_KM = 1.60934;

const clampProviderCoverageKm = (km: number) => Math.min(PROVIDER_COVERAGE_RADIUS_MAX_KM, Math.max(PROVIDER_COVERAGE_RADIUS_MIN_KM, km));
const milesToCoverageKm = (miles: number) => {
  if (miles <= PROVIDER_COVERAGE_RADIUS_MIN_MI) return PROVIDER_COVERAGE_RADIUS_MIN_KM;
  if (miles >= PROVIDER_COVERAGE_RADIUS_MAX_MI) return PROVIDER_COVERAGE_RADIUS_MAX_KM;
  return clampProviderCoverageKm(Number((miles * MILES_TO_KM).toFixed(2)));
};

const getProviderAccessThresholdNote = (km: number) => {
  const miles = kmToMiles(km);
  if (miles > 45) {
    return 'Distances over 45 miles should be treated as access gaps without transportation or outreach support';
  }
  if (miles > 30) {
    return 'Engagement reliability drops beyond 30 miles for many rural members';
  }
  return null;
};

const getProviderAccessTierTextClassName = (km: number) => {
  const tier = getProviderAccessTierByKm(km);
  if (tier === 'strong') return 'text-staffing-high';
  if (tier === 'conditional') return 'text-engagement-watch';
  if (tier === 'weak') return 'text-destructive';
  return 'text-muted-foreground';
};

const SECTION_META = {
  coreMap: {
    question: 'What exists here?',
    helper: 'Base geography and mapped network locations for fast orientation.',
  },
  operations: {
    question: 'How can teams respond?',
    helper: 'Operational reach, staffing deployment, and where field support is stretched.',
  },
  utilization: {
    question: 'Where is care used most?',
    helper: 'County-level intensity to show where demand is concentrating.',
  },
  access: {
    question: 'Where does geographic reach fall short?',
    helper: 'Distance-based provider access and the uncovered areas outside that range.',
  },
} as const;

const SECTION_HEADER_CLASSNAME = 'flex w-full items-center gap-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#064f88] transition-colors hover:text-[#064f88]/80';
const TOGGLE_ROW_CLASSNAME = 'group flex min-h-[30px] items-center gap-2 rounded-md border border-transparent px-2 py-0.5 transition-colors duration-150 hover:bg-secondary/40 hover:text-[hsl(var(--brand-health))] [&:hover_svg]:text-[hsl(var(--brand-health))]';
const SECTION_CONTENT_CLASSNAME = 'mt-0.5 space-y-px';

// Single source of truth for the horizontal rule that separates top-level
// sidebar sections (Connectivity, Verification Priority Queue, Verification
// Audit History, Data Import, etc.). Uniform inset, thickness, color, and
// vertical breathing room.
const SectionDivider = () => (
  <div className="my-2 mx-4 h-px bg-border" aria-hidden="true" />
);

const renderLayerIcon = (Icon: LucideIcon, colorClassName: string, dimmed = false) => (
  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${dimmed ? 'opacity-50' : ''}`}>
    <Icon className={`h-3.5 w-3.5 stroke-[1.75] ${colorClassName}`} />
  </span>
);

const renderPinVisual = ({
  pin,
  size = 12,
  color,
  dimmed = false,
}: {
  pin: keyof typeof MAP_PIN_VISUALS;
  size?: number;
  color?: string;
  dimmed?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={`flex items-center justify-center ${dimmed ? 'opacity-60' : ''}`}
    dangerouslySetInnerHTML={{ __html: getSharedPinSvgMarkup(pin, size, color ? { color } : undefined) }}
  />
);

const renderProviderTypeVisual = (dimmed = false, size = 12) => (
  <span className={`flex items-center gap-0.5 ${dimmed ? 'opacity-60' : ''}`} aria-hidden="true">
    {renderPinVisual({ pin: 'providerLocations', size, color: 'hsl(var(--hospital))' })}
    {renderPinVisual({ pin: 'providerLocations', size, color: 'hsl(var(--clinic))' })}
  </span>
);

const renderProviderLocationsBelowLegend = (dimmed = false) => (
  <span className={`flex items-center gap-3 text-[10px] text-muted-foreground ${dimmed ? 'opacity-60' : ''}`}>
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-hospital" />
      <span>Hospital</span>
    </span>
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-clinic" />
      <span>Clinic</span>
    </span>
  </span>
);

const renderResponseCapabilityVisual = (category: ResponseCapabilityCategory, dimmed = false) => (
  <span
    aria-hidden="true"
    className={`flex items-center justify-center ${dimmed ? 'opacity-60' : ''}`}
    dangerouslySetInnerHTML={{ __html: getResponseCapabilityMarkerHtml(category) }}
  />
);

const HelpIconTooltip = ({
  helpKey,
}: {
  helpKey: string;
}) => {
  const helpData = HELP_TOOLTIPS[helpKey];
  const [open, setOpen] = useState(false);

  const stopSidebarHelpEvent = (event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const showPopover = () => {
    setOpen(true);
  };

  const hidePopover = () => {
    setOpen(false);
  };

  if (!helpData) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
    <button
      type="button"
      className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onMouseEnter={showPopover}
      onMouseLeave={hidePopover}
      onTouchStart={(event) => {
        stopSidebarHelpEvent(event);
        showPopover();
      }}
      onClick={(event) => {
        stopSidebarHelpEvent(event);
        setOpen((current) => {
          return !current;
        });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          stopSidebarHelpEvent(event);
          setOpen((current) => !current);
        }
      }}
      aria-label={`More information about ${helpData.label}`}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <HelpCircle className="w-3 h-3" />
    </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        avoidCollisions
        collisionPadding={{ top: 12, right: 12, bottom: 12, left: 12 }}
        className="z-[1700] w-72 max-w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">{helpData.label}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {helpData.explanation}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const InlineHelpTooltip = ({ label, explanation }: { label: string; explanation: string }) => {
  const [open, setOpen] = useState(false);

  const stop = (event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/30 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onTouchStart={(event) => { stop(event); setOpen(true); }}
          onClick={(event) => { stop(event); setOpen((c) => !c); }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { stop(event); setOpen((c) => !c); } }}
          aria-label={`More information about ${label}`}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="text-[8px] font-semibold leading-none">?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        avoidCollisions
        collisionPadding={{ top: 12, right: 12, bottom: 12, left: 12 }}
        className="z-[1700] max-w-[260px] rounded-md border border-border bg-popover p-2.5 text-popover-foreground shadow-md animate-in fade-in-0 duration-150"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold text-foreground">{label}</p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{explanation}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Sidebar = ({
  layer: {
    layers,
    onToggleLayer,
    onSetLayers,
    coverageRadius,
    coverageGaps,
    onCoverageRadiusChange,
    onCoverageGapsChange,
    radiusKm,
    onRadiusChange,
    coverageRadiusKm = 120,
    onCoverageRadiusKmChange,
    engagementGapView,
    onEngagementGapViewChange,
  },
  filter: {
    searchQuery,
    onSearchChange,
    filters,
    onFiltersChange,
    topProvidersOnly,
    onTopProvidersOnlyChange,
    engagementRateBelow20Only,
    onEngagementRateBelow20OnlyChange,
  },
  facility: {
    allFacilities,
    facilities,
    onAddFacilities,
    onFacilityClick,
  },
  selection: {
    selectedFteId,
    onFteCardClick,
    onCountySelect,
    onTransitProviderClick,
  },
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

  const { isAdmin, isAuthenticated, ready: authReady, role, user, signOut, canImportData, canApplyVerification, canEditMapData } = usePermissions();
  const [facilitiesOpen, toggleFacilities] = usePersistToggle('sidebar_facilities');
  const [csvOpen, setCsvOpen] = useState(false);
  const [verifQueueOpen, setVerifQueueOpen] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [csvImportState, setCsvImportState] = useState<'idle' | 'processing' | 'preview' | 'success' | 'error'>('idle');
  const [csvParsed, setCsvParsed] = useState<{ valid: Facility[]; invalidCount: number; errors: string[]; totalRows: number } | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleFilters = useCallback(() => setFiltersOpen(v => !v), []);
  const [coreMapOpen, toggleCoreMap, setCoreMapOpen] = usePersistToggle('sidebar_layer_core', true);
  const [operationsOpen, toggleOperations, setOperationsOpen] = usePersistToggle('sidebar_layer_ops');
  const [utilizationOpen, toggleUtilization] = usePersistToggle('sidebar_layer_util');
  const [accessOpen, toggleAccess, setAccessOpen] = usePersistToggle('sidebar_layer_access');
  const [transitOpen, toggleTransit, setTransitOpen] = usePersistToggle('sidebar_layer_transit');
  const [connectivityOpen, toggleConnectivity, setConnectivityOpen] = usePersistToggle('sidebar_layer_connectivity');
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Counts from filtered set
  const hospitalCount = facilities.filter(f => f.type === 'hospital').length;
  const clinicCount = facilities.filter(f => f.type === 'clinic').length;
  const providerCount = hospitalCount + clinicCount;

  // Core Map layer counts (reactive to filters)
  const countyCount = nevadaCounties.length;
  const tribalNationCount = tribalNations.length;

  const filteredServices = useMemo(() => {
    let result = ruralServices.filter(isCommunitySupportService);
    if (filters.counties.size > 0) result = result.filter(s => filters.counties.has(s.county));
    return result;
  }, [filters.counties]);

  const filteredBhServices = useMemo(() => {
    let result = ruralServices.filter(isBehavioralHealthService);
    if (filters.counties.size > 0) result = result.filter(s => filters.counties.has(s.county));
    return result;
  }, [filters.counties]);

  const serviceCount = filteredServices.length;
  const bhCount = filteredBhServices.length;

  const coreMapCounts: Record<string, string> = {
    counties: `${countyCount} Counties`,
    tribalNations: `${tribalNationCount} Tribal Nations`,
    services: `${serviceCount} Services`,
    behavioralHealth: `${bhCount} Locations`,
    serviceLocations: `${providerCount} Locations`,
  };

  // Unique counties from all facilities
  const allCounties = useMemo(() => {
    const set = new Set(allFacilities.map(f => f.county).filter(Boolean));
    return Array.from(set).sort();
  }, [allFacilities]);

  const hasActiveFilters = filters.types.size > 0 || filters.counties.size > 0 || filters.serviceCategories.size > 0;
  const filterSuffix = hasActiveFilters ? '-filtered' : '';

  const exportProviderLocations = useCallback(() => {
    exportCsv(
      facilities.map(f => ({
        Name: f.name,
        Type: f.type,
        Classification: getFacilityClassification(f),
        County: f.county,
        City: f.city,
        Address: f.address ?? '',
        Latitude: f.lat,
        Longitude: f.lng,
        DataConfidence: getFacilityDataConfidence(f),
      })),
      [
        { key: 'Name', header: 'Name' },
        { key: 'Type', header: 'Type' },
        { key: 'Classification', header: 'Classification' },
        { key: 'County', header: 'County' },
        { key: 'City', header: 'City' },
        { key: 'Address', header: 'Address' },
        { key: 'Latitude', header: 'Latitude' },
        { key: 'Longitude', header: 'Longitude' },
        { key: 'DataConfidence', header: 'Data Confidence' },
      ],
      `provider-locations-export${filterSuffix}.csv`,
    );
  }, [facilities, filterSuffix]);

  const exportBehavioralHealth = useCallback(() => {
    exportCsv(
      filteredBhServices.map(s => ({
        Name: s.name,
        County: s.county,
        City: s.city,
        Address: s.address ?? '',
        Category: s.category,
        Phone: s.phone ?? '',
        Latitude: s.lat,
        Longitude: s.lng,
      })),
      [
        { key: 'Name', header: 'Name' },
        { key: 'County', header: 'County' },
        { key: 'City', header: 'City' },
        { key: 'Address', header: 'Address' },
        { key: 'Category', header: 'Category' },
        { key: 'Phone', header: 'Phone' },
        { key: 'Latitude', header: 'Latitude' },
        { key: 'Longitude', header: 'Longitude' },
      ],
      `behavioral-health-export${filterSuffix}.csv`,
    );
  }, [filteredBhServices, filterSuffix]);

  const exportServices = useCallback(() => {
    exportCsv(
      filteredServices.map(s => ({
        Name: s.name,
        County: s.county,
        City: s.city,
        Address: s.address ?? '',
        Category: s.category,
        Phone: s.phone ?? '',
        Latitude: s.lat,
        Longitude: s.lng,
      })),
      [
        { key: 'Name', header: 'Name' },
        { key: 'County', header: 'County' },
        { key: 'City', header: 'City' },
        { key: 'Address', header: 'Address' },
        { key: 'Category', header: 'Category' },
        { key: 'Phone', header: 'Phone' },
        { key: 'Latitude', header: 'Latitude' },
        { key: 'Longitude', header: 'Longitude' },
      ],
      `services-export${filterSuffix}.csv`,
    );
  }, [filteredServices, filterSuffix]);

  const serviceLineFilterCount =
    (filters.psychiatry ? 1 : 0) + (filters.verifiedPsychiatryOnly ? 1 : 0) +
    (filters.acceptingPsychPatients ? 1 : 0) + (filters.telepsychiatry ? 1 : 0) +
    (filters.inpatientServices ? 1 : 0) + (filters.verifiedInpatientOnly ? 1 : 0) +
    (filters.psychiatricInpatient ? 1 : 0) + (filters.detoxInpatient ? 1 : 0) +
    (filters.acceptingAdmissions ? 1 : 0) + (filters.medicaidInpatient ? 1 : 0);

  const activeFilterCount = filters.types.size + filters.counties.size + filters.serviceCategories.size + serviceLineFilterCount;

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

  const toggleServiceLineFilter = (key: keyof typeof filters) => {
    onFiltersChange({ ...filters, [key]: !filters[key as keyof typeof filters] });
  };

  const clearFilters = () => {
    onFiltersChange({
      types: new Set(), counties: new Set(), serviceCategories: new Set(),
      psychiatry: false, verifiedPsychiatryOnly: false, acceptingPsychPatients: false, telepsychiatry: false,
      inpatientServices: false, verifiedInpatientOnly: false, psychiatricInpatient: false, detoxInpatient: false,
      acceptingAdmissions: false, medicaidInpatient: false,
    });
  };


  const processCSVFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are accepted.');
      setCsvImportState('error');
      return;
    }
    console.log('[csv-import] File selected:', file.name);
    setCsvImportState('processing');
    setCsvParsed(null);

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('Failed to read file.');
      setCsvImportState('error');
    };
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) { toast.error('Failed to read file.'); setCsvImportState('error'); return; }

      const result: CsvImportResult = parseFacilityCsv(text);

      if (result.valid.length === 0 && result.errors.length > 0 && result.totalRows === 0) {
        toast.error(result.errors[0]);
        setCsvImportState('error');
        return;
      }

      console.log(`[csv-import] Parsed: ${result.valid.length} valid, ${result.invalidCount} invalid out of ${result.totalRows} rows`);
      setCsvParsed({ valid: result.valid, invalidCount: result.invalidCount, errors: result.errors, totalRows: result.totalRows });
      setCsvImportState(result.valid.length > 0 ? 'preview' : 'error');
      if (result.valid.length === 0) toast.error('No valid rows found in the CSV.');
    };
    reader.readAsText(file);
  }, []);

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSVFile(file);
    e.target.value = '';
  }, [processCSVFile]);

  const confirmImport = useCallback(() => {
    if (!csvParsed || csvParsed.valid.length === 0) return;
    if (!canImportData) {
      toast.error('You do not have permission to import data.');
      console.warn('[csv-import] Blocked: caller is not authorized to import data.');
      return;
    }
    onAddFacilities(csvParsed.valid);
    toast.success(`Imported ${csvParsed.valid.length} facilities.`);
    console.log(`[csv-import] Imported ${csvParsed.valid.length} facilities`);
    setCsvImportState('success');
    setTimeout(() => { setCsvImportState('idle'); setCsvParsed(null); }, 3000);
  }, [csvParsed, onAddFacilities, canImportData]);

  const resetImport = useCallback(() => {
    setCsvImportState('idle');
    setCsvParsed(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCSVFile(file);
  }, [processCSVFile]);

  const displayFacilities = useMemo(() => {
    const filtered = searchQuery
      ? facilities.filter(f =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.county.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : facilities;
    return sortEntitiesByOperationalPriority(filtered);
  }, [searchQuery, facilities]);

  const renderHelpIcon = (key: string) => (
    <HelpIconTooltip helpKey={key} />
  );

  const getLayerConfig = (key: keyof LayerState) => LAYER_CONFIG.find((layer) => layer.key === key)!;

  const renderSectionIntro = (question: string, helper: string) => (
    <div className="space-y-0.5 px-2 pb-1">
      <p className="text-[11px] font-medium text-foreground">{question}</p>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{helper}</p>
    </div>
  );

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
    icon,
    iconClassName,
    checked,
    onCheckedChange,
    helpKey,
    dataTutorial,
    inlineLegend,
    belowLegend,
    subtitle,
  }: {
    label: string;
    icon: LucideIcon;
    iconClassName: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    helpKey?: string;
    dataTutorial?: string;
    inlineLegend?: ReactNode;
    belowLegend?: ReactNode;
    subtitle?: string;
  }) => (
    <div data-tutorial={dataTutorial}>
      <div className={TOGGLE_ROW_CLASSNAME}>
        <button
          type="button"
          onClick={() => onCheckedChange(!checked)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {renderLayerIcon(icon, iconClassName, !checked)}
          <span className="min-w-0 flex-1">
            <span className={`block text-[11.5px] leading-snug ${checked ? 'text-foreground/85' : 'text-foreground/55'}`}>{label}</span>
            {subtitle && <span className="block text-[10px] leading-tight text-muted-foreground mt-0.5">{subtitle}</span>}
          </span>
        </button>
        {inlineLegend ? <div className="ml-2 shrink-0">{inlineLegend}</div> : null}
        <div className="ml-2 flex shrink-0 items-center justify-end gap-0.5">
          {helpKey ? renderHelpIcon(helpKey) : null}
          <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={`${checked ? 'Hide' : 'Show'} ${label}`} />
        </div>
      </div>
      {belowLegend ? <div className="pl-7 pb-0.5">{belowLegend}</div> : null}
    </div>
  );

  return (
    <div data-tutorial="sidebar" className="relative flex h-full w-full flex-col bg-card shadow-[var(--shadow-panel)] md:w-80 border-r border-[hsl(var(--brand-health)/0.3)]">
      <div className="flex-1 overflow-y-scroll scroll-smooth sidebar-scroll pb-6">
      {/* Header */}
      <div className="flex flex-col items-center px-4 pt-4 pb-3 text-center border-b border-border/60">
        <img
          src={novumLogo}
          alt="NovumHealth"
          className="block w-full max-w-[180px] h-auto object-contain"
          decoding="async"
        />
        <h1 className="mt-2 text-base font-semibold tracking-tight leading-tight" style={{ color: '#064f88' }}>Rural Operations Map</h1>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground max-w-[280px]">
          Search by facility, city, county, or enter a member address.
        </p>

        {/* Auth + admin row */}
        <div className="mt-2 flex w-full flex-col items-start gap-y-1 text-[10.5px] leading-none">
          {!authReady ? null : isAdmin ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary"
              title={user?.email ?? 'Admin'}
            >
              <span className="h-1 w-1 rounded-full bg-primary" />
              Admin
            </span>
          ) : null}
          {authReady && (isAdmin || isAuthenticated) ? (
            <div className="flex flex-nowrap items-center whitespace-nowrap text-muted-foreground/70">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin"
                    className="font-normal transition-colors hover:text-foreground"
                  >
                    Admin Panel
                  </Link>
                  <span aria-hidden className="px-2 text-muted-foreground/30">|</span>
                  <Link
                    to="/admin/provider-mapping-import"
                    className="font-normal transition-colors hover:text-foreground"
                  >
                    Provider Mapping
                  </Link>
                </>
              ) : null}
              {isAdmin && isAuthenticated ? (
                <span aria-hidden className="px-2 text-muted-foreground/30">|</span>
              ) : null}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => { void signOut(); }}
                  className="font-normal transition-colors hover:text-foreground"
                  title={user?.email ?? undefined}
                >
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Divider between admin/auth row and map interaction controls */}
        {authReady && (isAdmin || isAuthenticated) ? (
          <div className="mt-3 border-t border-border" />
        ) : null}

        {/* Action buttons row: Staff sign in + Map Explainer */}
        <div className={`${authReady && (isAdmin || isAuthenticated) ? 'mt-3' : 'mt-1.5'} grid grid-cols-2 gap-2 w-full`}>
          {authReady && !isAuthenticated ? (
            <Link
              to="/auth"
              className="inline-flex h-8 items-center justify-center rounded-md border border-[#064f88]/40 bg-[hsl(var(--brand-health))] px-3 text-xs font-medium text-white transition-colors hover:bg-[hsl(var(--primary-hover))] hover:border-[#064f88]/60 active:bg-[hsl(var(--primary-active))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064f88]/40"
            >
              Staff Sign In
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setExplainerOpen(true)}
            className={`inline-flex h-8 items-center justify-center rounded-md border border-[hsl(var(--brand-health)/0.35)] bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-[hsl(var(--brand-health)/0.55)] hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-health)/0.3)] ${authReady && isAuthenticated ? 'col-span-2' : ''}`}
          >
            Map Explainer
          </button>
        </div>

        <MapExplainerModal open={explainerOpen} onClose={() => setExplainerOpen(false)} />
      </div>

      {/* View toggle */}
      {onSetLayers && (
        <div className="px-4 pt-2.5 pb-2 border-b border-border/60">
          <div className="flex flex-col gap-1" role="group" aria-label="View Mode">
            <span className="text-[11px] font-medium text-muted-foreground">View</span>
            <div className={`flex w-full items-center rounded-md border bg-secondary/40 p-0.5 transition-colors ${
              layers.tribalNations && layers.behavioralHealth && layers.services
                ? 'border-[#064f88]/50'
                : 'border-[hsl(var(--brand-health)/0.35)]'
            }`}>
              <button
                type="button"
                onClick={() => onSetLayers((prev) => ({
                  ...prev,
                  tribalNations: false,
                  behavioralHealth: false,
                  services: false,
                }))}
                className={`flex-1 px-3 py-1 text-[11px] font-medium rounded transition-colors ${
                  !layers.tribalNations && !layers.behavioralHealth && !layers.services
                    ? 'bg-card text-foreground shadow-sm border border-[hsl(var(--brand-health)/0.35)]'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
                aria-pressed={!layers.tribalNations && !layers.behavioralHealth && !layers.services}
              >
                Basic
              </button>
              <button
                type="button"
                onClick={() => onSetLayers((prev) => ({
                  ...prev,
                  tribalNations: true,
                  behavioralHealth: true,
                  services: true,
                }))}
                className={`flex-1 px-3 py-1 text-[11px] font-medium rounded transition-colors ${
                  layers.tribalNations && layers.behavioralHealth && layers.services
                    ? 'bg-[hsl(var(--brand-health))] text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={layers.tribalNations && layers.behavioralHealth && layers.services}
              >
                Full System
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--brand-health)/0.3)] bg-card px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-hospital flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Hospitals</span>
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-foreground">{hospitalCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--brand-health)/0.3)] bg-card px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-clinic flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">Clinics</span>
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-foreground">{clinicCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pt-2.5 pb-2" data-tutorial="search-bar">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--brand-health))]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search facilities, cities, or counties"
            className="w-full h-9 pl-9 pr-3 text-sm bg-card border border-[hsl(var(--brand-health)/0.35)] rounded-md text-foreground placeholder:text-[hsl(var(--brand-health)/0.6)] transition-colors hover:border-[hsl(var(--brand-health)/0.55)] focus:outline-none focus:border-[hsl(var(--brand-health))] focus:ring-2 focus:ring-[hsl(var(--brand-health)/0.2)]"
          />
        </div>
      </div>

      {/* Filter Panel */}
      <div className="px-4 pb-2">
        <div className="mb-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFilters}
            className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold tracking-tight text-foreground/70 transition-colors hover:text-foreground"
          >
            {filtersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Filters</span>
          </button>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
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
              <div data-tutorial="facility-filters">
                <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">Facility Type</div>
                <div data-tutorial="facility-filter-chips" className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: 'hospital', label: 'Hospital', color: 'bg-hospital' },
                    { value: 'clinic', label: 'Clinic', color: 'bg-clinic' },
                    { value: 'service', label: 'Service', color: 'bg-service-presence' },
                    { value: 'behavioralHealth', label: 'Behavioral Health', color: 'bg-behavioral-health' },
                  ].map(({ value, label, color }) => {
                    const active = filters.types.has(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleTypeFilter(value)}
                        className={`flex h-7 min-w-0 items-center justify-start gap-1.5 rounded-md border px-2 text-[11px] transition-colors duration-150 ${
                          active
                            ? 'border-border bg-secondary font-medium text-foreground'
                            : 'border-transparent bg-secondary/70 text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color} ${active ? 'opacity-100' : 'opacity-60'}`} />
                        <span className="truncate">{label}</span>
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

              {/* Service-Line Filters */}
              <div>
                <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">Provider Psychiatric</div>
                <div className="flex flex-wrap gap-1">
                  {([
                    { key: 'psychiatry' as const, label: 'Psychiatry' },
                    { key: 'verifiedPsychiatryOnly' as const, label: 'Verified Only' },
                    { key: 'acceptingPsychPatients' as const, label: 'Accepting Patients' },
                    { key: 'telepsychiatry' as const, label: 'Telepsychiatry' },
                  ] as const).map(({ key, label }) => {
                    const active = !!filters[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleServiceLineFilter(key)}
                        className={`rounded px-2 py-0.5 text-[11px] transition-all duration-150 ${
                          active
                            ? 'bg-foreground font-medium text-background'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">Hospital Inpatient</div>
                <div className="flex flex-wrap gap-1">
                  {([
                    { key: 'inpatientServices' as const, label: 'Inpatient' },
                    { key: 'verifiedInpatientOnly' as const, label: 'Verified Only' },
                    { key: 'psychiatricInpatient' as const, label: 'Psych Inpatient' },
                    { key: 'detoxInpatient' as const, label: 'Detox / WM' },
                    { key: 'acceptingAdmissions' as const, label: 'Accepting' },
                    { key: 'medicaidInpatient' as const, label: 'Medicaid' },
                  ] as const).map(({ key, label }) => {
                    const active = !!filters[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleServiceLineFilter(key)}
                        className={`rounded px-2 py-0.5 text-[11px] transition-all duration-150 ${
                          active
                            ? 'bg-foreground font-medium text-background'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
          </div>
        )}

      </div>

      <SectionDivider />
      <div className="px-4 pb-2">
        <div className="space-y-1.5">
              <div className="space-y-1">
                <div data-tutorial="section-core-map">
                  {renderSectionHeader('CORE MAP', coreMapOpen, toggleCoreMap)}
                  {coreMapOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {/* section intro removed for cleanup */}
                      {(['counties', 'tribalNations', 'serviceLocations', 'behavioralHealth', 'services'] as const).map((key) => {
                        const { label, colorClassName, icon } = getLayerConfig(key);
                        const count = coreMapCounts[key];
                        const dividerBefore = key === 'serviceLocations' || key === 'services';
                        const exportHandler = key === 'serviceLocations' ? exportProviderLocations
                          : key === 'behavioralHealth' ? exportBehavioralHealth
                          : key === 'services' ? exportServices
                          : undefined;
                        return (
                          <div key={key}>
                            {dividerBefore && <div className="my-1 border-t border-border/40" />}
                            {renderLayerToggleRow({
                              label,
                              icon,
                              iconClassName: colorClassName,
                              checked: layers[key],
                              onCheckedChange: () => onToggleLayer(key),
                              helpKey: key,
                              subtitle: count || undefined,
                              dataTutorial:
                                key === 'services'
                                  ? 'toggle-services'
                                  : key === 'behavioralHealth'
                                    ? 'toggle-behavioral-health'
                                    : key === 'serviceLocations'
                                      ? 'toggle-provider-locations'
                                      : undefined,
                              belowLegend: key === 'serviceLocations' ? renderProviderLocationsBelowLegend(!layers.serviceLocations) : undefined,
                              inlineLegend: exportHandler ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); exportHandler(); }}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  title="Export CSV"
                                  aria-label={`Export ${label} as CSV`}
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                              ) : undefined,
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  {renderSectionHeader('OPERATIONS', operationsOpen, toggleOperations)}
                  {operationsOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {/* section intro removed for cleanup */}
                      {(['operationalCoverage', 'fteCapacity', 'engagementGap'] as const).map((key) => {
                        const { label, colorClassName, icon } = getLayerConfig(key);
                        return (
                          <div key={key}>
                            {renderLayerToggleRow({
                              label,
                              icon,
                              iconClassName: colorClassName,
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
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-response-active" />
                                        <span><span className="font-semibold text-foreground">{counts.active}</span> counties with same-day field response</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-response-scheduled" />
                                        <span><span className="font-semibold text-foreground">{counts.scheduled}</span> counties with scheduled outreach only</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-response-remote" />
                                        <span><span className="font-semibold text-foreground">{counts.remote}</span> counties with remote-only support</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                                    <div className="mb-1 flex items-center justify-between">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/70">Field Response Radius</span>
                                      <div className="flex min-w-0 items-center gap-2 pl-2">
                                        <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-border bg-background px-2 text-[11px] font-bold tabular-nums leading-none text-foreground">
                                          {Math.round((radius / 80) * 60)} min
                                        </span>
                                        <span className="whitespace-nowrap text-[10px] font-medium tabular-nums text-muted-foreground">
                                          ~{kmToMiles(radius)} mi
                                        </span>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={40}
                                      max={200}
                                      step={10}
                                      value={radius}
                                      onChange={(e) => onCoverageRadiusKmChange?.(Number(e.target.value))}
                                      className="h-1.5 w-full cursor-pointer accent-response-active"
                                    />
                                    <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
                                      <span>~30 min (~25 mi)</span>
                                      <span>~150 min (~124 mi)</span>
                                    </div>
                                    <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/70">Based on real travel time, not straight-line distance.</p>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Response Capability</div>
                                    {(['active', 'scheduled', 'remote'] as const).map((category) => (
                                      <div key={category} className="flex gap-2">
                                        <div className="mt-0.5 flex-shrink-0">
                                          {renderResponseCapabilityVisual(category)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className={`text-[11px] font-medium leading-tight ${RESPONSE_CAPABILITY_META[category].titleClassName}`}>{RESPONSE_CAPABILITY_META[category].label}</div>
                                          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{RESPONSE_CAPABILITY_META[category].description}</p>
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
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="text-muted-foreground">View:</span>
                                    <button
                                      type="button"
                                      onClick={() => onEngagementGapViewChange('priority')}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-150 ${
                                        engagementGapView === 'priority'
                                          ? 'bg-destructive/15 text-destructive'
                                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      <Flame className="h-2.5 w-2.5" />
                                      Priority
                                    </button>
                                    <InlineHelpTooltip
                                      label="Priority"
                                      explanation="Ranks where to act first. Combines unengaged volume, low engagement rate, and lack of staff coverage to show urgency across counties."
                                    />
                                    <button
                                      type="button"
                                      onClick={() => onEngagementGapViewChange('boundaries')}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-150 ${
                                        engagementGapView === 'boundaries'
                                          ? 'bg-destructive/15 text-destructive'
                                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      <Grid3X3 className="h-2.5 w-2.5" />
                                      Boundaries
                                    </button>
                                    <InlineHelpTooltip
                                      label="Boundaries"
                                      explanation="Shows where a gap exists. A county is flagged when demand is high and there's no field staff coverage. This is a yes/no view with tiers (Gap, Watchlist, Early Signal)."
                                    />
                                  </div>
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
                                    <span className="font-medium text-engagement-gap">Orange</span> = True Gap (&gt;15 VPM).{' '}
                                    <span className="font-medium text-engagement-watch">Yellow</span> = Watchlist (10–15).{' '}
                                    <span className="font-medium text-engagement-early">Blue</span> = Early Signal (6–10).
                                  </p>

                                  {!hasAny && <p className="text-[10px] italic text-muted-foreground/60">No counties currently meet Engagement Gap or Early Signal thresholds.</p>}

                                  {gapCounties.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-engagement-gap">True Gap ({gapCounties.length})</p>
                                      <p className="text-[10px] text-muted-foreground">{gapCounties.map((r: any) => r.subZone === 'northern-washoe' ? 'N. Washoe' : r.county).join(', ')}</p>
                                    </div>
                                  )}
                                  {watchCounties.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-engagement-watch">Watchlist ({watchCounties.length})</p>
                                      <p className="text-[10px] text-muted-foreground">{watchCounties.map((r: any) => r.subZone === 'northern-washoe' ? 'N. Washoe' : r.county).join(', ')}</p>
                                    </div>
                                  )}
                                  {earlyCounties.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-engagement-early">Early Signal ({earlyCounties.length})</p>
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
                      {/* section intro removed for cleanup */}
                      {(() => {
                        const { key, label, colorClassName, icon } = getLayerConfig('utilizationIntensity');
                        return (
                          <div key={key}>
                            {renderLayerToggleRow({
                              label,
                              icon,
                              iconClassName: colorClassName,
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
                      <p className="px-2 pb-1 text-[10px] leading-relaxed text-muted-foreground">Distance-based access modeling for rural coverage.</p>
                      {renderLayerToggleRow({
                        label: 'Distance to Provider (Access View)',
                        icon: ACCESS_LAYER_CONFIG.coverageRadius.icon,
                        iconClassName: ACCESS_LAYER_CONFIG.coverageRadius.colorClassName,
                        checked: coverageRadius,
                        onCheckedChange: onCoverageRadiusChange,
                        helpKey: 'coverageRadius',
                        dataTutorial: 'toggle-coverage-radius',
                      })}
                      <div className="px-2 pb-1 pt-0.5">
                        <div className="mb-1 flex items-center justify-between gap-2 px-1">
                          <span className={`truncate text-[10px] font-semibold transition-colors ${coverageRadius ? getProviderAccessTierTextClassName(radiusKm) : 'text-muted-foreground'}`}>
                            {PROVIDER_ACCESS_TIER_LABELS[getProviderAccessTierByKm(radiusKm)]}
                          </span>
                        </div>
                        <div className="relative px-1 pt-6">
                          <div
                            className={`pointer-events-none absolute top-0 z-10 -translate-x-1/2 transition-opacity ${coverageRadius ? 'opacity-100' : 'opacity-40'}`}
                            style={{
                              left: `calc(${((kmToMiles(radiusKm) - PROVIDER_COVERAGE_RADIUS_MIN_MI) / (PROVIDER_COVERAGE_RADIUS_MAX_MI - PROVIDER_COVERAGE_RADIUS_MIN_MI)) * 100}% + ${10 - ((((kmToMiles(radiusKm) - PROVIDER_COVERAGE_RADIUS_MIN_MI) / (PROVIDER_COVERAGE_RADIUS_MAX_MI - PROVIDER_COVERAGE_RADIUS_MIN_MI)) * 100) / 100) * 20}px)`,
                            }}
                            aria-hidden="true"
                          >
                            <span className={`inline-flex h-5 min-w-[3.75rem] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0 text-[10px] font-semibold tabular-nums leading-none shadow-sm transition-colors ${coverageRadius ? 'border-border bg-background text-foreground' : 'border-border/70 bg-secondary text-muted-foreground'}`}>
                              {kmToMiles(radiusKm)} mi
                            </span>
                          </div>
                          <Slider
                            min={PROVIDER_COVERAGE_RADIUS_MIN_MI}
                            max={PROVIDER_COVERAGE_RADIUS_MAX_MI}
                            step={1}
                            value={[kmToMiles(radiusKm || PROVIDER_COVERAGE_RADIUS_DEFAULT_KM)]}
                            disabled={!coverageRadius}
                            onValueChange={([miles]) => {
                              if (!coverageRadius) return;
                              if (typeof miles !== 'number') return;
                              onRadiusChange(milesToCoverageKm(miles));
                            }}
                            className={coverageRadius ? 'w-full' : 'w-full opacity-60'}
                            aria-label="Provider coverage radius"
                          />
                        </div>
                        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
                          <span>{PROVIDER_COVERAGE_RADIUS_MIN_MI} mi</span>
                          <span>{PROVIDER_COVERAGE_RADIUS_MAX_MI} mi</span>
                        </div>
                        {getProviderAccessThresholdNote(radiusKm) && (
                          <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground/80">
                            {getProviderAccessThresholdNote(radiusKm)}
                          </p>
                        )}
                      </div>

                      {renderLayerToggleRow({
                        label: 'Access Gaps (Outside Coverage Radius)',
                        icon: ACCESS_LAYER_CONFIG.coverageGaps.icon,
                        iconClassName: ACCESS_LAYER_CONFIG.coverageGaps.colorClassName,
                        checked: coverageGaps,
                        onCheckedChange: onCoverageGapsChange,
                        helpKey: 'coverageGaps',
                      })}
                      {coverageGaps && (
                        <p className="px-2 pb-1 pt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                          Counties highlighted in red fall outside the current distance-to-provider scenario of <span className="font-medium text-foreground">{kmToMiles(radiusKm)} mi</span>.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <DemandUtilizationPanel layers={layers} onToggleLayer={onToggleLayer} />

                <div data-tutorial="section-transit">
                  {renderSectionHeader('TRANSIT PROVIDERS', transitOpen, toggleTransit)}
                  {transitOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {renderLayerToggleRow({
                        label: 'Rail Corridor (Amtrak)',
                        icon: TrainFront,
                        iconClassName: 'text-muted-foreground',
                        checked: layers.railCorridor,
                        onCheckedChange: () => onToggleLayer('railCorridor'),
                        subtitle: 'Northern corridor only · 4 stations',
                      })}
                      {renderLayerToggleRow({
                        label: 'Local Transit Zones',
                        icon: MapPin,
                        iconClassName: 'text-muted-foreground',
                        checked: layers.localTransitZones,
                        onCheckedChange: () => onToggleLayer('localTransitZones'),
                        subtitle: 'Silver Rider · JAC · approximate',
                      })}

                      {/* Transit Providers — additive utility list (not a facility/provider/service) */}
                      <div className="mt-1 px-2">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1">
                          Transit Providers
                        </div>
                        {(() => {
                          // Operational ordering (UI-only). Not alphabetical.
                          const STRUCTURED_ORDER = [
                            'ltp-silver-rider',
                            'ltp-jac',
                            'ltp-pahrump-valley-public-transportation',
                            'ltp-cart',
                            'ltp-get-my-ride',
                            'ltp-ely-bus',
                          ];
                          const LIMITED_ORDER = [
                            'ltp-lincoln-county-transportation',
                            'ltp-pleasant-senior-center',
                            'ltp-lyon-county-human-services',
                            'ltp-nye-senior-nutrition',
                            'ltp-pyramid-lake-tribal-transit',
                          ];
                          const byId = new Map(localTransitProviders.map((p) => [p.id, p]));
                          const structured = STRUCTURED_ORDER
                            .map((id) => byId.get(id))
                            .filter((p): p is NonNullable<typeof p> => !!p && p.supportLevel === 'structured_local_transit');
                          const limited = LIMITED_ORDER
                            .map((id) => byId.get(id))
                            .filter((p): p is NonNullable<typeof p> => !!p && p.supportLevel === 'limited_community_transit');
                          // Append any future providers not yet ranked, preserving group integrity.
                          const ranked = new Set([...STRUCTURED_ORDER, ...LIMITED_ORDER]);
                          for (const p of localTransitProviders) {
                            if (ranked.has(p.id)) continue;
                            if (p.supportLevel === 'structured_local_transit') structured.push(p);
                            else limited.push(p);
                          }

                          const renderItem = (p: typeof localTransitProviders[number]) => {
                            const isStructured = p.supportLevel === 'structured_local_transit';
                            const levelLabel = isStructured ? 'Structured' : 'Limited';
                            const levelTitle = LOCAL_TRANSIT_SUPPORT_LEVEL_LABELS[p.supportLevel];
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => onTransitProviderClick?.(p.id)}
                                  className="w-full rounded-sm px-1.5 py-1 text-left text-[11px] leading-tight text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center gap-1.5"
                                  title={levelTitle}
                                >
                                  <Route className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate flex-1">{p.name}</span>
                                  <span
                                    className={`flex-shrink-0 rounded px-1 py-px text-[8px] font-medium uppercase tracking-wide ${
                                      isStructured
                                        ? 'bg-secondary text-foreground/80'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {levelLabel}
                                  </span>
                                </button>
                              </li>
                            );
                          };

                          return (
                            <>
                              {structured.length > 0 && (
                                <>
                                  <div className="px-1 pt-0.5 pb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                                    Structured Transit
                                  </div>
                                  <ul className="space-y-0.5">{structured.map(renderItem)}</ul>
                                </>
                              )}
                              {limited.length > 0 && (
                                <>
                                  <div className="mt-1 border-t border-border/60 px-1 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                                    Limited Transit
                                  </div>
                                  <ul className="space-y-0.5">{limited.map(renderItem)}</ul>
                                </>
                              )}
                            </>
                          );
                        })()}
                        <p
                          className="mt-1.5 px-1 text-[9px] leading-snug text-muted-foreground/80"
                          title="Transit reflects local mobility support, not guaranteed end-to-end coverage."
                        >
                          <span className="font-medium text-muted-foreground">Structured</span> = organized local transit ·{' '}
                          <span className="font-medium text-muted-foreground">Limited</span> = community / senior transport.
                          Reflects local mobility support, not guaranteed end-to-end coverage.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div data-tutorial="section-connectivity">
                  {renderSectionHeader('CONNECTIVITY', connectivityOpen, toggleConnectivity)}
                  {connectivityOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {/* connectivity intro removed for cleanup */}
                      {renderLayerToggleRow({
                        label: 'Broadband Access',
                        icon: Wifi,
                        iconClassName: 'text-broadband-served',
                        checked: layers.broadbandAccess,
                        onCheckedChange: () => onToggleLayer('broadbandAccess'),
                        helpKey: 'broadbandAccess',
                      })}
                      {layers.broadbandAccess && (() => {
                        const high = COUNTY_BROADBAND_DATA.filter(d => d.operationalReadiness === 'High').length;
                        const mixed = COUNTY_BROADBAND_DATA.filter(d => d.operationalReadiness === 'Mixed').length;
                        const low = COUNTY_BROADBAND_DATA.filter(d => d.operationalReadiness === 'Low').length;
                        const uneven = COUNTY_BROADBAND_DATA.filter(d => d.coverageUnevenness).length;
                        return (
                          <div className="space-y-1.5 px-2 pb-2 pt-1">
                            <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Operational Readiness</div>
                              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-broadband-served" />
                                  <span><span className="font-semibold text-foreground">{high}</span> High readiness</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-broadband-underserved" />
                                  <span><span className="font-semibold text-foreground">{mixed}</span> Mixed readiness</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-broadband-unserved" />
                                  <span><span className="font-semibold text-foreground">{low}</span> Low readiness</span>
                                </div>
                              </div>
                            </div>
                            {uneven > 0 && (
                              <p className="text-[9px] text-engagement-watch">
                                ⚠ {uneven} counties have uneven coverage distribution
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      {renderLayerToggleRow({
                        label: 'Cellular Coverage',
                        icon: Signal,
                        iconClassName: 'text-cellular-strong',
                        checked: layers.cellularCoverage,
                        onCheckedChange: () => onToggleLayer('cellularCoverage'),
                        helpKey: 'cellularCoverage',
                      })}
                      {layers.cellularCoverage && (() => {
                        const high = COUNTY_CELLULAR_DATA.filter(d => d.operationalCellularReadiness === 'High').length;
                        const mixed = COUNTY_CELLULAR_DATA.filter(d => d.operationalCellularReadiness === 'Mixed').length;
                        const low = COUNTY_CELLULAR_DATA.filter(d => d.operationalCellularReadiness === 'Low').length;
                        return (
                          <div className="space-y-1.5 px-2 pb-2 pt-1">
                            <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Operational Cellular Readiness</div>
                              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-cellular-strong" />
                                  <span><span className="font-semibold text-foreground">{high}</span> High readiness</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-cellular-moderate" />
                                  <span><span className="font-semibold text-foreground">{mixed}</span> Mixed readiness</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-cellular-weak" />
                                  <span><span className="font-semibold text-foreground">{low}</span> Low readiness</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[9px] italic text-muted-foreground/60">
                              Derived from FCC BDC J25 (March 2026). Confidence: Medium — modeled coverage, not field-measured.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
        </div>
      </div>

      {canEditMapData && (
      <>
      <SectionDivider />

      {/* Verification Priority Queue */}
      <div className="px-4">
        <button
          onClick={() => setVerifQueueOpen(!verifQueueOpen)}
          className={SECTION_HEADER_CLASSNAME}
        >
          {verifQueueOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Verification Priority Queue
        </button>
        {verifQueueOpen && (
          <div className="mb-3">
            <VerificationPriorityPanel filters={filters} />
          </div>
        )}
      </div>

      <SectionDivider />

      {/* Verification Audit History */}
      <div className="px-4">
        <button
          onClick={() => setAuditHistoryOpen(!auditHistoryOpen)}
          className={SECTION_HEADER_CLASSNAME}
        >
          {auditHistoryOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Verification Audit History
        </button>
        {auditHistoryOpen && (
          <div className="mb-3">
            <VerificationAuditHistoryPanel />
          </div>
        )}
      </div>

      <SectionDivider />
      <div className="px-4">
        <button
          onClick={() => setCsvOpen(!csvOpen)}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 hover:text-foreground transition-colors"
        >
          {csvOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Data Import
        </button>
        {csvOpen && (
          <div className="mb-3 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVUpload}
              className="hidden"
            />

            {csvImportState === 'idle' || csvImportState === 'error' ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full flex items-center justify-center gap-2 h-16 border-2 border-dashed rounded-md text-xs transition-colors duration-200 ${
                    csvDragActive
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>{csvDragActive ? 'Drop file here' : 'Drop CSV or click to upload'}</span>
                </button>
                <p className="text-[10px] text-muted-foreground px-1">
                  Required: name, latitude, longitude. Optional: type, city, county, tier.
                </p>
                {csvImportState === 'error' && csvParsed && csvParsed.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 space-y-0.5">
                    {csvParsed.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-[10px] text-destructive">{err}</p>
                    ))}
                    {csvParsed.errors.length > 5 && (
                      <p className="text-[10px] text-destructive">…and {csvParsed.errors.length - 5} more</p>
                    )}
                    <button type="button" onClick={resetImport} className="text-[10px] text-primary hover:underline mt-1">
                      Try again
                    </button>
                  </div>
                )}
              </>
            ) : csvImportState === 'processing' ? (
              <div className="w-full flex items-center justify-center gap-2 h-16 border-2 border-dashed border-border rounded-md text-xs text-muted-foreground">
                <span className="animate-pulse">Processing…</span>
              </div>
            ) : csvImportState === 'preview' && csvParsed ? (
              <div className="space-y-2">
                <div className="rounded-md border border-border bg-secondary/50 px-2 py-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Total rows</span>
                    <span className="font-medium text-foreground">{csvParsed.totalRows}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Valid</span>
                    <span className="font-medium text-primary">{csvParsed.valid.length}</span>
                  </div>
                  {csvParsed.invalidCount > 0 && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Invalid (skipped)</span>
                      <span className="font-medium text-destructive">{csvParsed.invalidCount}</span>
                    </div>
                  )}
                </div>

                {csvParsed.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 space-y-0.5">
                    {csvParsed.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-[10px] text-destructive">{err}</p>
                    ))}
                    {csvParsed.errors.length > 3 && (
                      <p className="text-[10px] text-destructive">…and {csvParsed.errors.length - 3} more</p>
                    )}
                  </div>
                )}

                {/* Preview table */}
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1 bg-secondary/70">
                    Preview ({Math.min(csvParsed.valid.length, 5)} of {csvParsed.valid.length})
                  </div>
                  <div className="divide-y divide-border">
                    {csvParsed.valid.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 text-[10px]">
                        <span className="font-medium text-foreground truncate flex-1">{f.name}</span>
                        <span className="text-muted-foreground tabular-nums">{f.lat.toFixed(2)}, {f.lng.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={confirmImport}
                    className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Import {csvParsed.valid.length} rows
                  </button>
                  <button
                    type="button"
                    onClick={resetImport}
                    className="rounded-md border border-border bg-secondary px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : csvImportState === 'success' ? (
              <div className="w-full flex items-center justify-center gap-2 h-16 border-2 border-dashed border-primary/40 bg-primary/5 rounded-md text-xs text-primary">
                <Check className="w-4 h-4" />
                <span>Import complete</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </>
      )}

      {/* Facilities List removed — search bar is the primary navigation */}
      </div>
      {/* Bottom fade overlay */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-[5px] h-8 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
};

export default Sidebar;
