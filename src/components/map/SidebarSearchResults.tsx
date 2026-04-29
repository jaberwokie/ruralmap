/**
 * SidebarSearchResults — global navigation dropdown for the sidebar search bar.
 *
 * Searches existing in-memory data sources only (no DB writes, no fake data,
 * no mock results):
 *   - Counties               → src/data/nevada-counties.ts
 *   - Verified facilities    → caller-provided `facilities` (already loaded
 *                              and filtered by Index/useFacilityData; covers
 *                              hospitals, clinics, services, behavioral health
 *                              that the app already knows about as Facility[])
 *   - Rural / verified services → src/data/enriched-rural-services.ts
 *                                  (caller may pass a live-merged list)
 *   - Behavioral health      → subset of rural services classified as BH via
 *                              isBehavioralHealthService(), plus any
 *                              Facility with type 'behavioralHealth'
 *   - Local transit providers → src/data/local-transit-providers.ts
 *   - Tribal nations         → src/data/tribal-nations.ts
 *
 * Selecting a result calls back into the existing Index handlers
 * (county select → auto-fits county; facility/service/transit select → opens
 * the existing detail panel; tribal nation → fits the tribe centroid).
 *
 * Public-safe mode: search continues to work, but utilization/member-volume
 * data is never surfaced here (we only expose name / city / county / category /
 * service-area / phone — the same fields already visible elsewhere on the
 * map). No new sensitive fields are added.
 */
import { useEffect, useMemo, useRef } from 'react';
import { MapPin, Building2, Brain, Bus, Landmark, Layers3 } from 'lucide-react';
import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import type { TribalNation } from '@/data/tribal-nations';
import type { LocalTransitProvider } from '@/data/local-transit-providers';
import type { CountyData } from '@/data/nevada-counties';
import { isBehavioralHealthService } from '@/utils/ruralServiceClassification';

export type SearchResultGroup =
  | 'County'
  | 'Service'
  | 'Behavioral Health'
  | 'Transit'
  | 'Tribal Nation';

export type SearchResult =
  | { kind: 'County'; id: string; label: string; sub: string; county: CountyData }
  | { kind: 'Facility'; id: string; label: string; sub: string; facility: Facility; group: SearchResultGroup }
  | { kind: 'Service'; id: string; label: string; sub: string; service: RuralService; group: SearchResultGroup }
  | { kind: 'Transit'; id: string; label: string; sub: string; provider: LocalTransitProvider }
  | { kind: 'TribalNation'; id: string; label: string; sub: string; tribe: TribalNation };

interface SidebarSearchResultsProps {
  query: string;
  counties: CountyData[];
  facilities: Facility[];
  services: RuralService[];
  transitProviders: LocalTransitProvider[];
  tribalNations: TribalNation[];
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
}

const MAX_PER_GROUP = 5;
const MAX_TOTAL = 20;

const matches = (haystack: string | undefined | null, q: string): boolean =>
  !!haystack && haystack.toLowerCase().includes(q);

/**
 * Build the grouped result list. Cheap string contains matching against
 * existing fields only — no scoring model, no remote lookup.
 */
const buildResults = (
  q: string,
  counties: CountyData[],
  facilities: Facility[],
  services: RuralService[],
  transitProviders: LocalTransitProvider[],
  tribalNations: TribalNation[],
): SearchResult[] => {
  const out: SearchResult[] = [];

  // Counties
  const countyHits: SearchResult[] = [];
  for (const c of counties) {
    if (matches(c.name, q)) {
      countyHits.push({
        kind: 'County',
        id: `county:${c.name}`,
        label: c.name,
        sub: 'Nevada county',
        county: c,
      });
    }
    if (countyHits.length >= MAX_PER_GROUP) break;
  }

  // Facilities — name/city/county/type/category/tags/phone (hospitals,
  // clinics, tier1 providers). Behavioral health is sourced from rural
  // services (no 'behavioralHealth' FacilityType exists).
  const facilityHits: SearchResult[] = [];
  for (const f of facilities) {
    const tagBlob = (f as unknown as { tags?: string[] }).tags?.join(' ') ?? '';
    const categoryBlob = (f as unknown as { category?: string }).category ?? '';
    const ok =
      matches(f.name, q) ||
      matches(f.city, q) ||
      matches(f.county, q) ||
      matches(f.type, q) ||
      matches(categoryBlob, q) ||
      matches(tagBlob, q) ||
      matches((f as unknown as { phone?: string }).phone, q);
    if (!ok) continue;
    const sub = `${f.city ? `${f.city}, ` : ''}${f.county} County`;
    facilityHits.push({
      kind: 'Facility',
      id: `facility:${f.id}`,
      label: f.name,
      sub,
      facility: f,
      group: 'Service',
    });
    if (facilityHits.length >= MAX_PER_GROUP) break;
  }
  const bhFacilityHits: SearchResult[] = [];

  // Rural services — name/city/county/category/notes/phone
  const serviceHits: SearchResult[] = [];
  const bhServiceHits: SearchResult[] = [];
  for (const s of services) {
    const ok =
      matches(s.name, q) ||
      matches(s.city, q) ||
      matches(s.county, q) ||
      matches(s.category, q) ||
      matches(s.notes, q) ||
      matches(s.phone, q);
    if (!ok) continue;
    const isBH = isBehavioralHealthService(s);
    const sub = `${s.category} · ${s.city ? `${s.city}, ` : ''}${s.county} County`;
    const result: SearchResult = {
      kind: 'Service',
      id: `service:${s.id}`,
      label: s.name,
      sub,
      service: s,
      group: isBH ? 'Behavioral Health' : 'Service',
    };
    if (isBH) {
      if (bhServiceHits.length < MAX_PER_GROUP) bhServiceHits.push(result);
    } else if (serviceHits.length < MAX_PER_GROUP) {
      serviceHits.push(result);
    }
  }

  // Transit providers — name + service-area note
  const transitHits: SearchResult[] = [];
  for (const t of transitProviders) {
    const ok =
      matches(t.name, q) ||
      matches(t.note, q) ||
      matches(t.fareNote, q);
    if (!ok) continue;
    transitHits.push({
      kind: 'Transit',
      id: `transit:${t.id}`,
      label: t.name,
      sub: t.note,
      provider: t,
    });
    if (transitHits.length >= MAX_PER_GROUP) break;
  }

  // Tribal nations — name / alternate name / counties
  const tribalHits: SearchResult[] = [];
  for (const tn of tribalNations) {
    const ok =
      matches(tn.name, q) ||
      matches(tn.alternateName, q) ||
      matches(tn.tribalGroup, q) ||
      tn.counties.some((c) => matches(c, q));
    if (!ok) continue;
    tribalHits.push({
      kind: 'TribalNation',
      id: `tribe:${tn.id}`,
      label: tn.name,
      sub: tn.counties.length > 0 ? `${tn.counties.join(', ')} County` : tn.tribalGroup,
      tribe: tn,
    });
    if (tribalHits.length >= MAX_PER_GROUP) break;
  }

  // Stable group ordering: County, Service, Behavioral Health, Transit, Tribal Nation
  out.push(...countyHits);
  out.push(...serviceHits);
  out.push(...facilityHits);
  out.push(...bhServiceHits);
  out.push(...bhFacilityHits);
  out.push(...transitHits);
  out.push(...tribalHits);
  return out.slice(0, MAX_TOTAL);
};

const groupOf = (r: SearchResult): SearchResultGroup => {
  switch (r.kind) {
    case 'County': return 'County';
    case 'Facility': return r.group;
    case 'Service': return r.group;
    case 'Transit': return 'Transit';
    case 'TribalNation': return 'Tribal Nation';
  }
};

const groupIcon: Record<SearchResultGroup, typeof MapPin> = {
  County: MapPin,
  Service: Layers3,
  'Behavioral Health': Brain,
  Transit: Bus,
  'Tribal Nation': Landmark,
};

const groupOrder: SearchResultGroup[] = [
  'County', 'Service', 'Behavioral Health', 'Transit', 'Tribal Nation',
];

const SidebarSearchResults = ({
  query,
  counties,
  facilities,
  services,
  transitProviders,
  tribalNations,
  onSelect,
  onClose,
}: SidebarSearchResultsProps) => {
  const trimmed = query.trim().toLowerCase();
  const results = useMemo(
    () => (trimmed.length < 2
      ? []
      : buildResults(trimmed, counties, facilities, services, transitProviders, tribalNations)),
    [trimmed, counties, facilities, services, transitProviders, tribalNations],
  );

  // Group by SearchResultGroup, preserving stable group order.
  const grouped = useMemo(() => {
    const map = new Map<SearchResultGroup, SearchResult[]>();
    for (const r of results) {
      const g = groupOf(r);
      const arr = map.get(g) ?? [];
      arr.push(r);
      map.set(g, arr);
    }
    return groupOrder
      .filter((g) => map.has(g))
      .map((g) => ({ group: g, items: map.get(g)! }));
  }, [results]);

  // Expose top result + Enter/Escape via a window-level handler installed on
  // the parent input. We use a ref + effect rather than capturing keys here so
  // the input keeps focus during typing.
  const topRef = useRef<SearchResult | null>(null);
  topRef.current = results[0] ?? null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!trimmed) return;
      // Only react when the search input is the active element.
      const active = document.activeElement as HTMLElement | null;
      if (!active || active.dataset.searchInput !== 'sidebar') return;
      if (e.key === 'Enter') {
        if (topRef.current) {
          e.preventDefault();
          onSelect(topRef.current);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSelect, onClose, trimmed]);

  if (trimmed.length < 2) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 z-40 rounded-md border border-border bg-card shadow-lg max-h-[60vh] overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      {results.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-muted-foreground">
          No results found for “{query.trim()}”.
        </div>
      ) : (
        grouped.map(({ group, items }) => {
          const Icon = groupIcon[group] ?? Building2;
          return (
            <div key={group} className="py-1">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span>{group}</span>
              </div>
              {items.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown so we fire before the input blur closes us.
                    e.preventDefault();
                    onSelect(r);
                  }}
                  className="block w-full px-3 py-1.5 text-left hover:bg-secondary focus:bg-secondary outline-none"
                >
                  <div className="text-[12px] font-medium text-foreground truncate">{r.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.sub}</div>
                </button>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SidebarSearchResults;
