import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ROUTING_TIER_COLORS, VERIFICATION_SIGNAL_COLORS } from '@/utils/statusColors';

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
          <Section title="What this is">
            <p>
              A decision tool that helps staff see where members can realistically receive care across rural Nevada. It surfaces verified access, flags uncertainty, and shows connectivity conditions — so routing decisions are based on evidence, not assumptions.
            </p>
          </Section>

          <Section title="The problem it solves">
            <ul className="list-disc pl-4 space-y-1">
              <li>Providers may be listed but not actually accessible to Medicaid members.</li>
              <li>Coverage data is often overstated or misread.</li>
              <li>Staff lose time on trial-and-error referrals that lead nowhere.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Routing Tier">
            <p>Every provider and service shows a Routing Tier that tells you how confident you can be when sending a member there:</p>
            <ul className="list-none pl-0 space-y-1.5">
              <li><span className={`font-semibold ${ROUTING_TIER_COLORS.recommended}`}>Recommended</span> — Verified participating provider. Send the member.</li>
              <li><span className={`font-semibold ${ROUTING_TIER_COLORS.available_unverified}`}>Available (Unverified)</span> — Provider exists but participation is not confirmed. Call first.</li>
              <li><span className={`font-semibold ${ROUTING_TIER_COLORS.fallback}`}>Fallback Option</span> — Known limitations or non-participating. Use only if no better option exists.</li>
            </ul>
          </Section>

          <Section title="Verification Signal">
            <p>Below the Routing Tier, a Verification Signal explains <em>why</em> the tier was assigned:</p>
            <ul className="list-none pl-0 space-y-1.5">
              <li className="flex items-center gap-1.5"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.medicaid_verified.dot}`} /><span className={`font-medium ${VERIFICATION_SIGNAL_COLORS.medicaid_verified.text}`}>Medicaid Verified (State Directory)</span><span className="text-foreground/80">— Confirmed participating via the state Medicaid directory.</span></li>
              <li className="flex items-center gap-1.5"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.npi_confirmed.dot}`} /><span className={`font-medium ${VERIFICATION_SIGNAL_COLORS.npi_confirmed.text}`}>Provider Identified (NPI Confirmed)</span><span className="text-foreground/80">— Identity is confirmed, but Medicaid participation is not verified.</span></li>
              <li className="flex items-center gap-1.5"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.unverified.dot}`} /><span className={`font-medium ${VERIFICATION_SIGNAL_COLORS.unverified.text}`}>Unverified Provider</span><span className="text-foreground/80">— Neither identity nor participation is confirmed.</span></li>
            </ul>
            <p className="text-[12px] text-muted-foreground italic">
              Knowing <em>who</em> a provider is and knowing they <em>accept Medicaid</em> are two different things.
            </p>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Deterministic Ordering">
            <p>Lists and service groups are always sorted by operational priority:</p>
            <ol className="list-none pl-0 space-y-1">
              <li className="flex items-center gap-1.5 text-[13px]"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.medicaid_verified.dot}`} /><span className={`${ROUTING_TIER_COLORS.recommended}`}>Recommended</span></li>
              <li className="flex items-center gap-1.5 text-[13px]"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.npi_confirmed.dot}`} /><span className={`${ROUTING_TIER_COLORS.available_unverified}`}>Provider Identified</span></li>
              <li className="flex items-center gap-1.5 text-[13px]"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.unverified.dot}`} /><span className={`${ROUTING_TIER_COLORS.fallback}`}>Unverified</span></li>
              <li className="flex items-center gap-1.5 text-[13px]"><span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${VERIFICATION_SIGNAL_COLORS.unverified.dot}`} /><span className={`${ROUTING_TIER_COLORS.fallback}`}>Fallback</span></li>
            </ol>
            <p>This means the most reliable options appear first, reducing guesswork when scanning a county or service list.</p>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Connectivity Layers">
            <p>Under the Connectivity section in the sidebar:</p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li><span className="font-medium">Broadband Access</span> — An aggregate county-level grade based on broadband service distribution. Not an address-level guarantee. Shows whether a county is broadly <span className="font-medium text-staffing-high">served</span>, <span className="font-medium text-engagement-watch">underserved</span>, or <span className="font-medium text-destructive">unserved</span>.</li>
              <li><span className="font-medium">Cellular Readiness</span> — Whether mobile-based engagement is realistically viable in a county. Graded as <span className="font-medium text-staffing-high">High</span>, <span className="font-medium text-engagement-watch">Mixed</span>, or <span className="font-medium text-destructive">Low</span> based on LTE and 5G availability.</li>
            </ul>
            <p>These layers matter because rural operations depend on whether staff and members can reliably connect — for telehealth, mobile outreach, and care coordination.</p>
          </Section>

          <Section title="Shared Legend & Consistency">
            <p>
              When both Broadband and Cellular layers are active, they appear together in a single combined legend at the bottom-left of the map. Broadband is listed first, Cellular second — matching the sidebar order. List ordering and legends follow the same logic throughout, so what you see in the sidebar matches what you see on the map.
            </p>
          </Section>

          <Section title="Tribal Access">
            <p>Tribal Nations and tribally operated services are shown separately from standard provider networks.</p>
            <p>These services may operate under different eligibility, funding, and care coordination structures than Medicaid-participating providers.</p>
            <p className="font-medium text-foreground">What this means in practice:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Tribal services may be available regardless of traditional network participation.</li>
              <li>Access may depend on tribal membership, referral relationships, or local agreements.</li>
              <li>These locations can be critical access points in rural areas where standard provider networks are limited.</li>
            </ul>
            <p className="font-medium text-foreground">Use this layer to:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Identify additional care options that may not appear in traditional provider networks.</li>
              <li>Understand where culturally specific and community-based services exist.</li>
              <li>Support coordination with tribal partners when appropriate.</li>
            </ul>
          </Section>

          <div className="border-t border-border/50" />

          <Section title="Why this matters for NBH">
            <ul className="list-disc pl-4 space-y-1">
              <li>Faster placement decisions.</li>
              <li>Fewer failed referrals.</li>
              <li>Better use of CCC time.</li>
              <li>More realistic rural strategy.</li>
              <li>An honest view of what is known versus what is unknown.</li>
            </ul>
          </Section>

          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3">
            <p className="text-[13px] font-medium text-foreground">
              Bottom line: This is not just a map. It is a routing tool for rural care decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapExplainerModal;
