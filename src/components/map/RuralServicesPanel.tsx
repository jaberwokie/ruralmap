import { useMemo } from 'react';
import { X, Phone } from 'lucide-react';
import { RuralService, RURAL_SERVICE_CATEGORIES } from '@/data/rural-services';

interface RuralServicesPanelProps {
  county: string;
  services: RuralService[];
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Coordinated Entry': 'bg-purple-100 text-purple-700',
  'Shelter': 'bg-orange-100 text-orange-700',
  'Supportive Housing': 'bg-amber-100 text-amber-700',
  'Legal': 'bg-slate-100 text-slate-700',
  'Housing (Low-Income)': 'bg-yellow-100 text-yellow-700',
  'Recovery/Boarding': 'bg-rose-100 text-rose-700',
  'Food': 'bg-green-100 text-green-700',
  'Family Services': 'bg-blue-100 text-blue-700',
  'Senior Services': 'bg-teal-100 text-teal-700',
  'Employment': 'bg-indigo-100 text-indigo-700',
  'Disability Services': 'bg-cyan-100 text-cyan-700',
  'Physical Health': 'bg-red-100 text-red-700',
  'Substance Use': 'bg-pink-100 text-pink-700',
  'Mental Health': 'bg-violet-100 text-violet-700',
};

const RuralServicesPanel = ({ county, services, onClose }: RuralServicesPanelProps) => {
  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach(s => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
    return RURAL_SERVICE_CATEGORIES
      .filter(c => counts.has(c))
      .map(c => ({ category: c, count: counts.get(c)! }));
  }, [services]);

  return (
    <div className="absolute top-3 left-3 z-[1000] w-72 max-h-[calc(100vh-120px)] rounded-lg border border-border bg-white/95 backdrop-blur-sm shadow-lg flex flex-col select-none">
      {/* Header */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rural Services
          </h3>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-sm font-semibold text-foreground">{county} County</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {services.length} service{services.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          By Category
        </div>
        <div className="flex flex-wrap gap-1">
          {breakdown.map(({ category, count }) => (
            <span
              key={category}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[category] ?? 'bg-secondary text-foreground'}`}
            >
              {category} ({count})
            </span>
          ))}
        </div>
      </div>

      {/* Service List */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {services.map(service => (
          <div key={service.id} className="px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors">
            <div className="text-xs font-medium text-foreground leading-snug">{service.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[service.category] ?? 'bg-secondary text-foreground'}`}>
                {service.category}
              </span>
              {service.city && (
                <span className="text-[10px] text-muted-foreground">{service.city}</span>
              )}
            </div>
            {service.phone && (
              <a
                href={`tel:${service.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
                onClick={e => e.stopPropagation()}
              >
                <Phone className="w-2.5 h-2.5" />
                {service.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RuralServicesPanel;
