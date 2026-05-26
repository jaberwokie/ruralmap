/**
 * Decision-support sub-components rendered inside CoverageDetailPanel.
 *
 * Strictly display-layer. None of these mutate verification state, queue
 * derivation, scoring, badges, filters, or map logic. They summarize what
 * already exists into shorter, action-oriented language for field staff.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, PhoneCall, Clock, Navigation, Route, ArrowRight, Brain } from 'lucide-react';
import type { Facility } from '@/data/facilities';
import type { ProviderEnrichmentRecord } from '@/utils/providerEnrichmentStore';
import {
  getEnrichmentForProvider,
  subscribeToEnrichment,
} from '@/utils/providerEnrichmentStore';
import { deriveRecommendedNextStep, type NextStepTone } from '@/utils/recommendedNextStep';
import { deriveRecency } from '@/utils/facilityRecency';
import { findBackupOptions, type BackupOption } from '@/utils/backupOptions';
import { facilityOffersBehavioralHealth } from '@/utils/facilityBehavioralHealth';
import { checkHighwayAccess } from '@/utils/highwayProximity';
import { logEvent } from '@/lib/metrics/logEvent';

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const TONE_STYLE: Record<NextStepTone, { color: string; bg: string; border: string; Icon: typeof CheckCircle2 }> = {
  go: { color: 'hsl(142, 60%, 35%)', bg: 'hsl(142, 60%, 96%)', border: 'hsl(142, 60%, 80%)', Icon: CheckCircle2 },
  caution: { color: 'hsl(38, 85%, 40%)', bg: 'hsl(38, 85%, 96%)', border: 'hsl(38, 85%, 80%)', Icon: Navigation },
  verify: { color: 'hsl(0, 65%, 45%)', bg: 'hsl(0, 65%, 97%)', border: 'hsl(0, 65%, 85%)', Icon: PhoneCall },
  fallback: { color: 'hsl(0, 0%, 40%)', bg: 'hsl(0, 0%, 96%)', border: 'hsl(0, 0%, 85%)', Icon: AlertTriangle },
};

// Hook: subscribe to enrichment updates so this provider's record reflects changes.
const useEnrichment = (providerId: string): ProviderEnrichmentRecord | undefined => {
  const [record, setRecord] = useState<ProviderEnrichmentRecord | undefined>(() =>
    getEnrichmentForProvider(providerId),
  );
  useEffect(() => {
    setRecord(getEnrichmentForProvider(providerId));
    return subscribeToEnrichment(() => setRecord(getEnrichmentForProvider(providerId)));
  }, [providerId]);
  return record;
};

// ── Recommended Next Step ──────────────────────────────────
export const RecommendedNextStep = ({
  facility,
  memberLocation,
}: {
  facility: Facility;
  memberLocation: { lat: number; lng: number } | null;
}) => {
  const enrichment = useEnrichment(facility.id);
  const step = deriveRecommendedNextStep(facility, enrichment, memberLocation);
  const style = TONE_STYLE[step.tone];
  const Icon = style.Icon;
  return (
    <div
      className="rounded-md border px-2 py-1.5 mb-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 flex-shrink-0" style={{ color: style.color }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: style.color }}>
          Recommended Next Step
        </span>
      </div>
      <p className="text-[11px] font-semibold leading-snug" style={{ color: style.color }}>{step.title}</p>
      <p className="text-[10px] text-foreground/80 leading-snug mt-0.5">{step.detail}</p>
    </div>
  );
};

// ── Access Friction Summary ────────────────────────────────
const tierLabel = (mi: number): string =>
  mi <= 10 ? 'Local Access' : mi <= 25 ? 'Managed Access' : mi <= 40 ? 'High Friction' : 'Non-Viable';

export const AccessFrictionSummary = ({
  facility,
  memberLocation,
}: {
  facility: Facility;
  memberLocation: { lat: number; lng: number } | null;
}) => {
  if (!memberLocation) {
    return (
      <div className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Access</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">No member selected</p>
      </div>
    );
  }
  const mi = haversineMi(memberLocation.lat, memberLocation.lng, facility.lat, facility.lng);
  const tier = tierLabel(mi);
  const hw = checkHighwayAccess(facility.lat, facility.lng);
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 mb-2">
      <div className="flex items-center gap-1.5">
        <Navigation className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Access</span>
      </div>
      <p className="text-[11px] text-foreground mt-0.5">
        {mi.toFixed(1)} mi · <span className="font-medium">{tier}</span>
        {hw.hasAccess && hw.corridor && (
          <span className="text-muted-foreground"> · {hw.corridor.label} corridor</span>
        )}
      </p>
    </div>
  );
};

// ── Last Touched ───────────────────────────────────────────
export const LastTouchedSummary = ({ facility }: { facility: Facility }) => {
  // Re-derive when enrichment store changes
  const enrichment = useEnrichment(facility.id);
  void enrichment;
  const summary = deriveRecency(facility);
  if (!summary) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5 mb-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Last touched</span>
      </div>
      <div className="space-y-0.5 text-[10px] text-foreground/80">
        {summary.verifiedDate && <div>Verified {summary.verifiedDate}</div>}
        {summary.enrichedDate && (
          <div>Imported {new Date(summary.enrichedDate).toISOString().slice(0, 10)}</div>
        )}
        <div className="text-[10px] font-medium text-foreground pt-0.5">Status: {summary.label}</div>
      </div>
    </div>
  );
};

// ── Backup Options ─────────────────────────────────────────
export const BackupOptions = ({
  facility,
  allFacilities,
  memberLocation,
  onSelect,
}: {
  facility: Facility;
  allFacilities: Facility[];
  memberLocation: { lat: number; lng: number } | null;
  onSelect: (next: Facility) => void;
}) => {
  const options = findBackupOptions(facility, allFacilities, memberLocation, 3);
  if (options.length === 0) return null;
  const sourceLabel = options[0].source === 'member' ? 'from member' : 'from this provider';
  const currentIsBH = facilityOffersBehavioralHealth(facility);
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5 mb-2">
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1.5">
          <Route className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Backup Options</span>
        </div>
        <span className="text-[9px] text-muted-foreground/70">{sourceLabel}</span>
      </div>
      <ul className="space-y-1">
        {options.map((opt) => (
          <BackupRow
            key={opt.facility.id}
            opt={opt}
            highlightBH={currentIsBH}
            onSelect={() => onSelect(opt.facility)}
          />
        ))}
      </ul>
    </div>
  );
};

const BackupRow = ({ opt, highlightBH, onSelect }: { opt: BackupOption; highlightBH: boolean; onSelect: () => void }) => (
  <li>
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        logEvent('backup_option_clicked', { provider: opt.facility.name, county: opt.facility.county });
        onSelect();
      }}
      className="w-full text-left rounded border border-transparent hover:border-border hover:bg-secondary/60 px-1.5 py-1 transition-colors"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-medium text-foreground truncate flex items-center gap-1">
          {highlightBH && opt.isBH && (
            <Brain className="w-2.5 h-2.5 flex-shrink-0" style={{ color: 'hsl(270, 50%, 55%)' }} />
          )}
          {opt.facility.name}
        </span>
        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
        <span>{opt.distanceMi.toFixed(1)} mi</span>
        <span>·</span>
        <span>{opt.tierLabel}</span>
        <span>·</span>
        <span className="truncate">{opt.facility.city}</span>
      </div>
    </button>
  </li>
);
