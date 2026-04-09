/**
 * Medicaid participation, cross-border, and tribal provider operational metadata.
 *
 * These types belong to SERVICE/PROVIDER records, never to Tribal Nation polygons.
 * Tribal Nations = geography/sovereignty. Services = operational access context.
 */

// ── Participation Status ──

export type MedicaidParticipationStatus = 'participating' | 'non_participating' | 'unknown';

// ── Operational Metadata ──

export interface ServiceOperationalMeta {
  /** Nevada Medicaid participation status */
  medicaidParticipationStatus: MedicaidParticipationStatus;

  /**
   * State(s) where this provider/service participates in Medicaid.
   * Empty array or null = unknown.
   */
  medicaidParticipationState: string[] | null;

  /** Shorthand: true if medicaidParticipationStatus === 'participating' */
  isNevadaMedicaidParticipating: boolean | null;

  /** Whether this provider is tribally affiliated */
  isTribalProvider: boolean;

  /** Whether this service is operated by a Tribal Nation */
  isTriballyOperated: boolean;

  /** Whether this service involves cross-border (out-of-state) access */
  isCrossBorderService: boolean;

  /** Human-readable access warning for routing/display */
  serviceAccessWarning: string | null;

  /** Reimbursement notes for operational context */
  reimbursementNotes: string | null;
}

// ── Defaults ──

export const DEFAULT_OPERATIONAL_META: ServiceOperationalMeta = {
  medicaidParticipationStatus: 'unknown',
  medicaidParticipationState: null,
  isNevadaMedicaidParticipating: null,
  isTribalProvider: false,
  isTriballyOperated: false,
  isCrossBorderService: false,
  serviceAccessWarning: null,
  reimbursementNotes: null,
};

/**
 * Resolve operational meta from partial data.
 * Unknown/missing fields fall back to safe defaults.
 */
export const resolveOperationalMeta = (
  partial?: Partial<ServiceOperationalMeta> | null,
): ServiceOperationalMeta => {
  if (!partial) return { ...DEFAULT_OPERATIONAL_META };
  return { ...DEFAULT_OPERATIONAL_META, ...partial };
};

// ── Display Labels ──

export const PARTICIPATION_STATUS_LABELS: Record<MedicaidParticipationStatus, string> = {
  participating: 'Yes',
  non_participating: 'No',
  unknown: 'Unknown',
};

export const PARTICIPATION_STATUS_COLORS: Record<MedicaidParticipationStatus, string> = {
  participating: 'text-primary',
  non_participating: 'text-destructive',
  unknown: 'text-muted-foreground',
};
