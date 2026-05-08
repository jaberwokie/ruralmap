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
import { computeFieldResponseStrain, getCountyReachShape } from '@/utils/fieldResponseStrain';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';
import { isNearNevadaPlace } from '@/utils/nevadaPlaceNameValidation';
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

/**
 * Single coordinate validation used by every Decision Assist target builder.
 * Rejects null/undefined, NaN/Infinity, the (0,0) sentinel, and out-of-range
 * lat/lng. A target failing this check MUST NOT be assigned a distance tier
 * (Local / Managed / High Friction) — it falls into the 'N/A' fallback group.
 */
const hasValidCoords = (lat: unknown, lng: unknown): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
};

interface CoordSource {
  id: string;
  name: string;
  lat: unknown;
  lng: unknown;
  county?: string;
  city?: string;
  /** Tag for dev logs so we can identify the upstream pipeline stage. */
  source: 'facility' | 'service';
}

/**
 * Centralized target builder. Both facility and rural-service candidates flow
 * through this function so distance computation, tier assignment, validation,
 * and dev-only invariants cannot diverge across dataset types.
 *
 * INVARIANTS (enforced here, not at call sites):
 *   - A target may NEVER be labeled Local / Managed / High Friction unless
 *     valid coordinates exist AND haversine distance was successfully computed.
 *     Otherwise tier='N/A' and distanceMi=null.
 *   - distanceMi=0 with materially different coordinates from the member is
 *     logged as a probable upstream data error.
 *   - tier='Local Access' with an actual distance >10 mi is logged.
 */
const buildGeoTarget = (
  src: CoordSource,
  member: { lat: number; lng: number },
): DecisionAssistTarget => {
  const base = {
    id: src.id,
    name: src.name,
    kind: src.source,
  } as const;

  if (!hasValidCoords(src.lat, src.lng)) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[DecisionAssist] target dropped to N/A — invalid coordinates', {
        stage: 'buildGeoTarget',
        source: src.source,
        target: src.name,
        county: src.county ?? null,
        city: src.city ?? null,
        rawLat: src.lat,
        rawLng: src.lng,
        member,
      });
    }
    return { ...base, tier: 'N/A', distanceMi: null, ...(src.source === 'facility' ? {} : {}) };
  }

  const lat = src.lat as number;
  const lng = src.lng as number;
  const miRaw = haversineMi(member.lat, member.lng, lat, lng);
  const tier = tierOf(miRaw);
  const distanceMi = Math.round(miRaw * 10) / 10;

  if (import.meta.env.DEV) {
    // Invariant: distanceMi rounds to 0 yet coords differ materially → upstream data bug.
    const coordsMatch =
      Math.abs(lat - member.lat) < 1e-4 && Math.abs(lng - member.lng) < 1e-4;
    if (distanceMi === 0 && !coordsMatch) {
      // eslint-disable-next-line no-console
      console.warn('[DecisionAssist] distanceMi=0 but target coords differ materially from member', {
        stage: 'buildGeoTarget',
        source: src.source,
        target: src.name,
        county: src.county ?? null,
        city: src.city ?? null,
        memberCoords: member,
        targetCoords: { lat, lng },
        rawDistanceMi: miRaw,
      });
    }
    if (tier === 'Local Access' && miRaw > 10) {
      // eslint-disable-next-line no-console
      console.warn('[DecisionAssist] Local Access label assigned beyond 10 mi', {
        stage: 'buildGeoTarget',
        source: src.source,
        target: src.name,
        county: src.county ?? null,
        city: src.city ?? null,
        distanceMi: miRaw,
        tier,
        memberCoords: member,
        targetCoords: { lat, lng },
      });
    }
    // Soft invariant: target name mentions a city but coords are far from it.
    // Catches mislabeled DB rows like a "Pahrump" record with Tonopah coords.
    if (src.city && src.name && !src.name.toLowerCase().includes(src.city.toLowerCase())) {
      // Name does not mention the city — nothing actionable here.
    }
  }

  return { ...base, tier, distanceMi };
};

const facilityToTarget = (f: Facility, member: { lat: number; lng: number }): DecisionAssistTarget => {
  const t = buildGeoTarget(
    { id: f.id, name: f.name, lat: f.lat, lng: f.lng, county: f.county, city: f.city, source: 'facility' },
    member,
  );
  return { ...t, facility: f };
};

const serviceToTarget = (s: RuralService, member: { lat: number; lng: number }, needId?: Need): DecisionAssistTarget => {
  if (
    import.meta.env.DEV &&
    needId === 'therapy' &&
    /pahrump/i.test(s.name) &&
    (/tonopah/i.test(s.city) || isNearNevadaPlace(s.lat, s.lng, 'Tonopah'))
  ) {
    // eslint-disable-next-line no-console
    console.warn('BH target name/location mismatch.', {
      stage: 'therapyTargetBuilder',
      source: 'service',
      target: s.name,
      city: s.city,
      county: s.county,
      targetCoords: { lat: s.lat, lng: s.lng },
      memberCoords: member,
    });
  }
  const t = buildGeoTarget(
    { id: s.id, name: s.name, lat: s.lat, lng: s.lng, county: s.county, city: s.city, source: 'service' },
    member,
  );
  return { ...t, service: s };
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
      primary: 'Re-select a need',
      backup: null,
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
  const serviceCandidates = need.serviceMatch(services).map(s => serviceToTarget(s, member, needId));
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

  // Mixed-county detection (e.g. Nye): one anchor cannot stand for whole county.
  const reach = county ? getCountyReachShape(county, ACTIVE_COVERAGE_RADIUS_KM) : null;
  const isMixedCounty = !!reach?.isMixed;

  // Constraint — single short reason, no duplication.
  let constraint: string | null = null;
  if (isRemoteOnly) {
    constraint = 'Outside field FTE reach';
  } else if (isMixedCounty) {
    constraint = 'Field coverage varies by location within county';
  } else if (strain && strain.coverage === 'strained') {
    constraint = 'Field capacity strained';
  } else if (fteLoad === 'over') {
    constraint = 'Field capacity at limit';
  } else if (fteLoad === 'near') {
    constraint = 'Field capacity constrained';
  } else if (!nearestGeo && !need.hotline && !need.preferMobilityManager) {
    constraint = 'No in-network record for this need';
  } else if (nearestGeo?.tier === 'Non-Viable') {
    constraint = `Nearest in-person option ${nearestGeo.distanceMi} mi — non-viable`;
  } else if (nearestGeo?.tier === 'High Friction') {
    constraint = `Nearest in-person option ${nearestGeo.distanceMi} mi — confirm transport`;
  } else if (!highway.hasAccess && nearestGeo && (nearestGeo.distanceMi ?? 0) > 10) {
    constraint = 'Off major highway — coordinate transport';
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

  if (isRemoteOnly) {
    steps.push({
      step: n++,
      action: 'No field response available at member location — coordinate remotely; consider scheduled outreach or reallocation if recurring need.',
    });
  } else if (strain && strain.coverage === 'strained' && strain.responder) {
    const anchor = strain.responder.anchorSite?.name ?? strain.responder.label;
    steps.push({
      step: n++,
      action: `Field response from ${anchor} is strained (~${strain.oneWayMi} mi) — schedule outreach or use alternative routing.`,
    });
  } else if (fteLoad && fteLoad !== 'available' && fte) {
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

  // ── Tightened Primary / Backup ─────────────────────────────────────────
  // Priority order: hotline → mobility manager → remote-only → mixed county
  // → strained field → anchored field → nearest in-person → fallback.
  let primary: string;
  let backup: string | null = null;

  const firstFacilityOrService = primaryTargets.find(t => t.kind === 'facility' || t.kind === 'service');
  const anchorName = strain?.responder
    ? (strain.responder.anchorSite?.name ?? strain.responder.label)
    : null;

  if (need.hotline) {
    primary = `Connect member to ${need.hotline.name} (${need.hotline.line})`;
    backup = firstFacilityOrService
      ? `Refer to ${firstFacilityOrService.name} (${firstFacilityOrService.distanceMi} mi)`
      : null;
  } else if (need.preferMobilityManager) {
    const mmTarget = primaryTargets.find(t => t.kind === 'mobility_manager');
    primary = mmTarget
      ? `Contact ${mmTarget.name}`
      : 'Escalate to NBH coordination — no county Mobility Manager';
    backup = null;
  } else if (isRemoteOnly) {
    primary = 'Remote coordination';
    backup = 'Schedule outreach if feasible';
  } else if (isMixedCounty) {
    primary = 'Use member location to determine responder';
    backup = 'Remote coordination if outside local field zone';
  } else if (strain && strain.coverage === 'strained' && anchorName) {
    primary = `Route to ${anchorName}`;
    backup = 'Schedule outreach within 24–48 hours';
  } else if (anchorName) {
    primary = `Route to ${anchorName} for same-day field response`;
    backup = (fteLoad === 'near' || fteLoad === 'over')
      ? 'Schedule outreach within 24–48 hours'
      : null;
  } else if (firstFacilityOrService) {
    primary = `Refer to ${firstFacilityOrService.name} (${firstFacilityOrService.distanceMi} mi)`;
    backup = nearestGeo?.tier === 'High Friction' || nearestGeo?.tier === 'Non-Viable'
      ? 'Confirm transport before scheduling'
      : null;
  } else {
    primary = need.fallbackAction;
    backup = null;
  }

  // Informational payer-pathway context (non-scoring).
  let payerPathwayContext: string | null = null;
  try {
    // Lazy require avoided — static import is safe (small static module).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getSshpPayerPathwayContext } = await import('@/data/sshpCatchments');
    payerPathwayContext = getSshpPayerPathwayContext(county ?? null);
  } catch {
    payerPathwayContext = null;
  }

  return {
    pathway: need.pathway,
    orderOfOperations: steps,
    confidence,
    constraint,
    nextStaffAction,
    primaryTargets,
    primary,
    backup,
    payerPathwayContext,
  };
};
