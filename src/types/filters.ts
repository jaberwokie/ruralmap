export interface Filters {
  types: Set<string>;
  counties: Set<string>;
  serviceCategories: Set<string>;

  // ── Future-ready operational filters (not wired to UI yet) ──
  /** Filter by Nevada Medicaid participation status */
  medicaidParticipating?: boolean | null;
  /** Filter to tribal providers only */
  tribalProvider?: boolean | null;
  /** Filter to tribally operated services only */
  triballyOperated?: boolean | null;
  /** Filter to cross-border services */
  crossBorder?: boolean | null;
}
