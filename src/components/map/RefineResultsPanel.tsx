import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { Filters } from '@/types/filters';
import type { Facility } from '@/data/facilities';
import { logEvent } from '@/lib/metrics/logEvent';

interface RefineResultsPanelProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  allFacilities: Facility[];
}

/**
 * Context-scoped filter controls relocated from the sidebar.
 * Renders inside the detail panel (county / address) so users can refine
 * what's shown for the current selection. Filter behavior, options, and
 * shape are identical to the previous sidebar implementation.
 */
const RefineResultsPanel = ({ filters, onFiltersChange, allFacilities }: RefineResultsPanelProps) => {
  const [open, setOpen] = useState(false);

  const allCounties = useMemo(() => {
    const set = new Set(allFacilities.map((f) => f.county).filter(Boolean));
    return Array.from(set).sort();
  }, [allFacilities]);

  const serviceLineFilterCount =
    (filters.psychiatry ? 1 : 0) + (filters.verifiedPsychiatryOnly ? 1 : 0) +
    (filters.acceptingPsychPatients ? 1 : 0) + (filters.telepsychiatry ? 1 : 0) +
    (filters.inpatientServices ? 1 : 0) + (filters.verifiedInpatientOnly ? 1 : 0) +
    (filters.psychiatricInpatient ? 1 : 0) + (filters.detoxInpatient ? 1 : 0) +
    (filters.acceptingAdmissions ? 1 : 0) + (filters.medicaidInpatient ? 1 : 0);

  const activeFilterCount =
    filters.types.size + filters.counties.size + filters.serviceCategories.size + serviceLineFilterCount;

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

  const toggleServiceLineFilter = (key: keyof Filters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] } as Filters);
  };

  const clearFilters = () => {
    onFiltersChange({
      types: new Set(), counties: new Set(), serviceCategories: new Set(),
      psychiatry: false, verifiedPsychiatryOnly: false, acceptingPsychPatients: false, telepsychiatry: false,
      inpatientServices: false, verifiedInpatientOnly: false, psychiatricInpatient: false, detoxInpatient: false,
      acceptingAdmissions: false, medicaidInpatient: false,
    });
  };

  return (
    <div className="mb-2 rounded-md border border-border bg-secondary/30">
      <div className="flex items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => setOpen((v) => { const next = !v; if (next) logEvent('detail_section_expanded', { section: 'Refine Results' }); return next; })}
          className="flex flex-1 items-center gap-1.5 py-1.5 text-left text-[11px] font-semibold tracking-tight text-foreground/70 transition-colors hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span>Refine Results</span>
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

      {open && (
        <div className="space-y-3 px-2 pb-2 pt-1">
          <div>
            <div className="mb-1.5 px-1 text-[10px] font-medium text-muted-foreground">Facility Type</div>
            <div className="grid grid-cols-2 gap-1.5">
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
  );
};

export default RefineResultsPanel;
