/**
 * Decision Assist — type contracts.
 *
 * Strictly read-only over existing data. No mutations to map state, filters,
 * selection, or scoring. Domains and Needs are stable IDs; labels live in the
 * taxonomy file and may change without breaking the helper.
 */

import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';

export type Domain = 'physical' | 'behavioral' | 'social';

export type Need =
  // Physical
  | 'primary_care' | 'urgent_care' | 'medication' | 'hospital_er' | 'dental' | 'vision'
  // Behavioral
  | 'therapy' | 'psychiatry' | 'crisis' | 'substance_use' | 'case_mgmt' | 'peer_support'
  // Social
  | 'housing' | 'food' | 'transportation' | 'benefits' | 'employment' | 'safety_dv' | 'legal_aid';

export interface DecisionAssistContext {
  member: { lat: number; lng: number };
  facilities: Facility[];
  services: RuralService[];
}

export type Confidence = 'high' | 'medium' | 'low';

export interface DecisionAssistTarget {
  id: string;
  name: string;
  kind: 'facility' | 'service' | 'mobility_manager' | 'hotline';
  tier: 'Local Access' | 'Managed Access' | 'High Friction' | 'Non-Viable' | 'N/A';
  distanceMi: number | null;
  /** Original record for click-through (only set for facility/service kinds). */
  facility?: Facility;
  service?: RuralService;
}

export interface DecisionAssistStep {
  step: number;
  action: string;
}

export interface DecisionAssistResult {
  pathway: string;
  orderOfOperations: DecisionAssistStep[];
  confidence: Confidence;
  constraint: string | null;
  nextStaffAction: string;
  primaryTargets: DecisionAssistTarget[];
  /** Tightened single-line primary action for staff. */
  primary: string;
  /** Optional backup line. Null when none needed. */
  backup: string | null;
  /**
   * Informational SSHP payer-pathway context for this member's county.
   * NON-SCORING. Never alters tier, distance, primary, backup, or constraint.
   */
  payerPathwayContext?: string | null;
}
