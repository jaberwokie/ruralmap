import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { ContactPhoneAction } from '@/components/ContactPhoneAction';
import { formatDisplayValue } from '@/utils/displayFormat';
import { kmToMiles } from '@/utils/coverageZones';
import { normalizeWebsite } from './websiteUtils';

export const ActionStep = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex items-start gap-1.5">
    <span className="text-[10px] font-bold text-primary mt-px">{n}</span>
    <div className="text-[10px] text-foreground/80 space-y-0.5">{children}</div>
  </div>
);

export const MetaRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (value == null || value === '' || value === 'unknown') return null;
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{formatDisplayValue(value)}</span>
    </div>
  );
};

export const ActionButtonRow = ({ phone, website }: { phone?: string; address?: string; lat?: number; lng?: number; city?: string; website?: string }) => {
  const normalizedWebsite = normalizeWebsite(website);
  if (!phone && !normalizedWebsite) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      <ContactPhoneAction phone={phone} variant="button" />
      {normalizedWebsite && (
        <a
          href={normalizedWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-secondary transition-colors"
          title="Visit website"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Website
        </a>
      )}
    </div>
  );
};

export const CopyAddress = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 p-0.5 rounded hover:bg-secondary text-muted-foreground"
      title="Copy address"
    >
      {copied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
};

export const CoverageGapContent = ({ radiusKm }: { radiusKm: number }) => (
  <>
    <div className="text-[10px] font-medium uppercase tracking-wide mb-1 text-destructive">
      ● Coverage Gap
    </div>
    <p className="text-sm font-semibold text-foreground mb-2">Service Gap Detected</p>
    <div className="text-xs text-muted-foreground space-y-1">
      <p>No hospital or clinic within <strong>{kmToMiles(radiusKm)} mi</strong> of this area.</p>
      <p className="italic">This region may have limited access to emergency and primary care services.</p>
    </div>
  </>
);
