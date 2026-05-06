/**
 * Decision Assist — deterministic helper.
 *
 * BOUNDARIES:
 * - Pure function. No I/O, no async, no fetches, no AI, no map mutations.
 * - Reads only the DecisionAssistContext passed in (member + facilities +
 *   services) and existing project utilities. Adds no new thresholds —
 *   reuses the established 10/25/40 mi access tiers.
 * - Wraps existing helpers only:
 *     - getCountyForLocation
 *     - getFTEForCounty + getLoadStatus
 *     - checkHighwayAccess
 *     - mobilityManagers (county lookup, never rendered as a map pin)
 *     - taxonomy predicates (facilityMatch / serviceMatch)
 * - Output (pathway, order of operations, confidence, constraint, next staff
 *   action, primary targets) is deterministic for a given input.
 */

import type { Facility } from '@/data/facilities';
import type { RuralService } from '@/data/rural-services';
import { getCountyForLocation } from '@/utils/countyLookup';
import { getLoadStatus, LOAD_STATUS_LABELS } from '@/data/fte-capacity';
import { checkHighwayAccess } from '@/utils/highwayProximity';
import { mobilityManagers } from '@/data/mobility-managers';
import { computeFieldResponseStrain } from '@/utils/fieldResponseStrain';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';
import { findNeed } from './decisionAssistTaxonomy';
import type {
  Confidence,
  DecisionAssistContext,
  DecisionAssistResult,
  DecisionAssistStep,
  DecisionAssistTarget,
  Domain,
  Need,
} from './decisionAssistTypes';

const haversineMi = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tierOf = (mi: number): DecisionAssistTarget['tier'] => {
  if (mi <= 10) return 'Local Access';
  if (mi <= 25) return 'Managed Access';
  if (mi <= 40) return 'High Friction';
  return 'Non-Viable';
};

const facilityToTarget = (f: Facility, member: { lat: number; lng: number }): DecisionAssistTarget => {
  const mi = haversineMi(member.lat, member.lng, f.lat, f.lng);
  return {
    id: f.id,
    name: f.name,
    kind: 'facility',
    tier: tierOf(mi),
    distanceMi: Math.round(mi * 10) / 10,
    facility: f,
  };
};

const serviceToTarget = (s: RuralService, member: { lat: number; lng: number }): DecisionAssistTarget => {
  const mi = haversineMi(member.lat, member.lng, s.lat, s.lng);
  return {
    id: s.id,
    name: s.name,
    kind: 'service',
    tier: tierOf(mi),
    distanceMi: Math.round(mi * 10) / 10,
    service: s,
  };
};

const tierRank: Record<DecisionAssistTarget['tier'], number> = {
  'Local Access': 0,
  'Managed Access': 1,
  'High Friction': 2,
  'Non-Viable': 3,
  'N/A': 4,
};

export const deriveDecisionAssist = (
  ctx: DecisionAssistContext,
  domain: Domain,
  needId: Need,
): DecisionAssistResult => {
  const need = findNeed(needId);
  if (!need || need.domain !== domain) {
    return {
      pathway: 'Unknown need',
      orderOfOperations: [{ step: 1, action: 'Select a need to continue.' }],
      confidence: 'low',
      constraint: 'Invalid selection.',
      nextStaffAction: 'Re-select a need.',
      primaryTargets: [],
    };
  }

  const { member, facilities, services } = ctx;
  const county = getCountyForLocation(member.lat, member.lng);
  // Site-based strain: use member point, not whole-county FTE assignment.
  // Mixed/large counties (e.g. Nye) cannot be summarised by one anchor FTE.
  const strain = computeFieldResponseStrain(member, ACTIVE_COVERAGE_RADIUS_KM);
  const fte = strain?.responder ?? null;
  const fteLoad = fte ? getLoadStatus(fte.currentLoad, fte.capacity) : null;
  const isRemoteOnly = !!strain && strain.responder === null;
  const highway = checkHighwayAccess(member.lat, member.lng);

  // Build candidates
  const facilityCandidates = need.facilityMatch(facilities, services).map(f => facilityToTarget(f, member));
  const serviceCandidates = need.serviceMatch(services).map(s => serviceToTarget(s, member));
  let allCandidates = [...facilityCandidates, ...serviceCandidates]
    .sort((a, b) => {
      const t = tierRank[a.tier] - tierRank[b.tier];
      if (t !== 0) return t;
      return (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity);
    });

  // Transportation: Mobility Manager is the primary target (never a pin elsewhere).
  if (need.preferMobilityManager && county) {
    const mm = mobilityManagers.find(m => m.coverageCounties.includes(county));
    if (mm) {
      allCandidates = [
        {
          id: mm.id,
          name: `${mm.name} — ${mm.organization}`,
          kind: 'mobility_manager',
          tier: 'N/A',
          distanceMi: null,
        },
        ...allCandidates,
      ];
    }
  }

  // Hotline ride-along (always offered for crisis / DV).
  if (need.hotline) {
    allCandidates = [
      {
        id: `hotline:${need.hotline.line}`,
        name: `${need.hotline.name} (${need.hotline.line})`,
        kind: 'hotline',
        tier: 'N/A',
        distanceMi: null,
      },
      ...allCandidates,
    ];
  }

  const primaryTargets = allCandidates.slice(0, 3);
  const nearestGeo = allCandidates.find(t => t.distanceMi !== null);

  // Confidence
  let confidence: Confidence;
  if (need.hotline) {
    confidence = 'high'; // hotline always available
  } else if (!nearestGeo) {
    confidence = 'low';
  } else if (
    (nearestGeo.tier === 'Local Access' || nearestGeo.tier === 'Managed Access') &&
    (!fteLoad || fteLoad !== 'over')
  ) {
    confidence = 'high';
  } else if (nearestGeo.tier === 'High Friction' || fteLoad === 'near') {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Constraint (worst single signal)
  let constraint: string | null = null;
  if (!nearestGeo && !need.hotline && !need.preferMobilityManager) {
    constraint = 'No in-network record found for this need in current data.';
  } else if (nearestGeo?.tier === 'Non-Viable') {
    constraint = `Nearest in-person option ${nearestGeo.distanceMi} mi — non-viable for routine in-person.`;
  } else if (nearestGeo?.tier === 'High Friction') {
    constraint = `Nearest in-person option ${nearestGeo.distanceMi} mi — confirm transport.`;
  } else if (fteLoad === 'over') {
    constraint = `${county ?? 'County'} field FTE at/over capacity — route remotely or schedule.`;
  } else if (!highway.hasAccess && nearestGeo && (nearestGeo.distanceMi ?? 0) > 10) {
    constraint = 'Member not on a major highway corridor — coordinate transport.';
  }

  // Order of operations
  const steps: DecisionAssistStep[] = [];
  let n = 1;

  if (need.hotline) {
    steps.push({ step: n++, action: `Connect member to ${need.hotline.name} (${need.hotline.line}).` });
  }
  if (need.preferMobilityManager) {
    const mmTarget = primaryTargets.find(t => t.kind === 'mobility_manager');
    steps.push({
      step: n++,
      action: mmTarget
        ? `Contact ${mmTarget.name} to coordinate transportation.`
        : 'No county Mobility Manager assigned — escalate to NBH coordination.',
    });
  }

  const firstGeo = primaryTargets.find(t => t.kind === 'facility' || t.kind === 'service');
  if (firstGeo) {
    steps.push({
      step: n++,
      action: `Refer to ${firstGeo.name} (${firstGeo.distanceMi} mi · ${firstGeo.tier}).`,
    });
  }

  if (nearestGeo?.tier === 'High Friction' || nearestGeo?.tier === 'Non-Viable') {
    steps.push({ step: n++, action: 'Confirm transportation, hours, and acceptance before scheduling.' });
  }

  if (fteLoad && fteLoad !== 'available' && fte) {
    steps.push({
      step: n++,
      action: `${fte.label}: ${LOAD_STATUS_LABELS[fteLoad]} — coordinate handoff accordingly.`,
    });
  }

  if (steps.length === 0) {
    steps.push({ step: n++, action: need.fallbackAction });
  }
  steps.push({ step: n++, action: 'Document outcome in CHW notes.' });

  const nextStaffAction = steps[0].action;

  return {
    pathway: need.pathway,
    orderOfOperations: steps,
    confidence,
    constraint,
    nextStaffAction,
    primaryTargets,
  };
};
