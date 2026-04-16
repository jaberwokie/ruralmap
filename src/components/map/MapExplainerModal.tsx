import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';


interface MapExplainerModalProps {
  open: boolean;
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    <div className="text-[13px] leading-relaxed text-foreground/80 space-y-2">{children}</div>
  </div>
);

const MapExplainerModal = ({ open, onClose }: MapExplainerModalProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            How to Use the Rural Nevada Access Map
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Close explainer"
          >
            <X className="h-4 w-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          <Section title="Core Map Layers">
            <ul className="list-disc pl-4 space-y-1">
              <li>Counties and tribal lands provide geographic context.</li>
              <li>Providers, behavioral health sites, and services show mapped network locations.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Access Views">
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="font-medium text-foreground">Distance to Provider</span> models geographic reach.</li>
              <li><span className="font-medium text-foreground">Access Gaps</span> highlights areas outside the selected provider radius.</li>
              <li>Distance helps estimate feasibility, but does not guarantee real access.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Rail and Transit">
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="font-medium text-foreground">Rail Corridor</span> shows the Nevada Amtrak corridor for long-distance northern travel support.</li>
              <li><span className="font-medium text-foreground">Local Transit Zones</span> show areas where local mobility support may exist.</li>
              <li><span className="font-medium text-foreground">Transit Providers</span> identify the operators serving those areas.</li>
              <li><span className="font-medium text-foreground">Structured</span> transit indicates organized local transit.</li>
              <li><span className="font-medium text-foreground">Limited</span> transit indicates community or senior transportation with narrower practical use.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Verification and Review">
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="font-medium text-foreground">Verification Priority Queue</span> highlights locations that may need review first.</li>
              <li><span className="font-medium text-foreground">Verification Audit History</span> shows recorded verification actions when available.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Important Limits">
            <ul className="list-disc pl-4 space-y-1">
              <li>Transit layers support coordination, not guaranteed transportation.</li>
              <li>Local transit does not imply full trip continuity across different service areas.</li>
              <li>Counties without a listed provider should be treated as having no identified local transit support in this model.</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
};

export default MapExplainerModal;
