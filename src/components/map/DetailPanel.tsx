import { X, MapPin, Building2, Stethoscope } from 'lucide-react';
import { Facility } from '@/data/facilities';

interface DetailPanelProps {
  facility: Facility;
  onClose: () => void;
}

const DetailPanel = ({ facility, onClose }: DetailPanelProps) => {
  const typeLabel = facility.type === 'hospital' ? 'Hospital' :
                    facility.type === 'tier1' ? 'Tier 1 Provider' : 'Clinic / FQHC';
  const typeColor = facility.type === 'hospital' ? 'bg-hospital' :
                    facility.type === 'tier1' ? 'bg-green-500' : 'bg-clinic';
  const TypeIcon = facility.type === 'hospital' ? Building2 : Stethoscope;

  return (
    <div
      className="absolute bottom-6 right-6 w-72 bg-card rounded-lg overflow-hidden z-[1000]"
      style={{ boxShadow: 'var(--shadow-panel)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${typeColor}`} />
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            {typeLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-secondary rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        <h3 className="text-sm font-semibold text-foreground leading-tight">
          {facility.name}
        </h3>

        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{facility.city}, {facility.county} County</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-3 h-3 flex-shrink-0 text-center text-[10px]">⊕</span>
            <span>{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailPanel;
