import { Phone, Mail, MapPin, ExternalLink, Bus } from 'lucide-react';
import { ContactPhoneAction } from '@/components/ContactPhoneAction';
import {
  getMobilityManagersForCounty,
  COUNTIES_WITH_MULTIPLE_MOBILITY_MANAGERS,
  type MobilityManager,
} from '@/data/mobility-managers';

interface TransportationCoordinationSectionProps {
  county: string;
  /** Header label override. Defaults to "Transportation Coordination". */
  title?: string;
}

const ManagerCard = ({ mm }: { mm: MobilityManager }) => (
  <div className="rounded-md border border-border bg-secondary/40 px-2 py-2 space-y-1">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-foreground leading-tight">{mm.name}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{mm.organization}</p>
      </div>
    </div>

    <div className="space-y-0.5">
      <div className="flex items-start gap-1 text-[10px]">
        <Phone className="w-2.5 h-2.5 mt-[2px] flex-shrink-0 text-muted-foreground" />
        <ContactPhoneAction
          phone={mm.officePhone}
          className="text-foreground hover:underline truncate"
        />
      </div>
      <div className="flex items-start gap-1 text-[10px]">
        <Mail className="w-2.5 h-2.5 mt-[2px] flex-shrink-0 text-muted-foreground" />
        <a
          href={`mailto:${mm.email}`}
          className="text-foreground hover:underline truncate"
        >
          {mm.email}
        </a>
      </div>
      <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
        <MapPin className="w-2.5 h-2.5 mt-[2px] flex-shrink-0" />
        <span className="leading-tight">{mm.address}</span>
      </div>
    </div>

    <div className="pt-1 border-t border-border/60">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground/80">Coverage</p>
      <p className="text-[10px] text-foreground leading-snug">
        {mm.coverageCounties.join(', ')}
      </p>
    </div>

    <p className="text-[10px] text-muted-foreground italic leading-snug">
      {mm.roleSummary}
    </p>
  </div>
);

const TransportationCoordinationSection = ({
  county,
  title = 'Transportation Coordination',
}: TransportationCoordinationSectionProps) => {
  const managers = getMobilityManagersForCounty(county);
  if (managers.length === 0) return null;

  const multiple = COUNTIES_WITH_MULTIPLE_MOBILITY_MANAGERS.has(county);

  return (
    <div className="mt-2 mb-2 rounded-md border border-border bg-card px-2 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bus className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>

      <div className="space-y-1.5">
        {managers.map(mm => (
          <ManagerCard key={mm.id} mm={mm} />
        ))}
      </div>

      {multiple && (
        <p className="mt-1.5 text-[9px] text-muted-foreground italic leading-snug">
          NDOT notes this county is served by multiple mobility managers; additional
          contacts may not yet be reflected here.
        </p>
      )}

      <p className="mt-1.5 text-[10px] font-medium text-foreground leading-snug">
        Coordination support only. Not a direct transportation provider.
      </p>

      <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
        <span>Source: NDOT</span>
        <a
          href={managers[0].sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
        >
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
};

export default TransportationCoordinationSection;
