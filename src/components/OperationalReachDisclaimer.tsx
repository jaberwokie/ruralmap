/**
 * Shared presentational disclaimer used by /platform and /briefing.
 *
 * Pure presentation. No logic, no state. Single source of truth so the
 * wording cannot drift between operational surfaces.
 */
const OperationalReachDisclaimer = () => (
  <p className="text-[12px] text-muted-foreground">
    Operational reach is contextual. This environment supports coordination
    decisions; it does not guarantee access, availability, or transportation
    continuity.
  </p>
);

export default OperationalReachDisclaimer;
