/**
 * Centralized color mapping for Routing Tier and Verification Signal states.
 *
 * Green  = verified_participating / recommended
 * Amber  = inferred_strong / available_unverified
 * Gray   = unknown / fallback
 */

export const STATUS_COLORS = {
  verified: { text: 'text-primary', dot: 'bg-primary' },
  amber: { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  neutral: { text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
} as const;

// ── Routing Tier ──

export type RoutingTierKey = 'recommended' | 'available_unverified' | 'fallback';

export const ROUTING_TIER_COLORS: Record<RoutingTierKey, string> = {
  recommended: STATUS_COLORS.verified.text,
  available_unverified: STATUS_COLORS.amber.text,
  fallback: STATUS_COLORS.neutral.text,
};

// ── Verification Signal ──

export type VerificationSignalKey = 'medicaid_verified' | 'npi_confirmed' | 'unverified';

export const VERIFICATION_SIGNAL_COLORS: Record<VerificationSignalKey, { text: string; dot: string }> = {
  medicaid_verified: STATUS_COLORS.verified,
  npi_confirmed: STATUS_COLORS.amber,
  unverified: STATUS_COLORS.neutral,
};
