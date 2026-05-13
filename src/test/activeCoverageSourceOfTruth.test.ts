/**
 * Regression tests — Active Field Coverage source-of-truth alignment.
 *
 * Locks the contract between:
 *  - the teal Active field coverage geometry (getActiveCoverageZone)
 *  - Engagement Ownership (getEngagementOwnership / EngagementOwnershipBlock)
 *  - Member Access recommendation copy (driven by ownership.inPersonAvailable)
 *  - the coverage radius constant (ACTIVE_COVERAGE_RADIUS_KM)
 *  - Public Safe Mode SSHP gating (usePublicSafeMode)
 *
 * If a future change drifts any one of these from the rendered geometry,
 * one of these tests should fail.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isPointInsideActiveCoverageZone } from '@/utils/coverageZones';
import { isPointInActiveFieldCoverage } from '@/utils/fieldCoverageStatus';
import { getEngagementOwnership } from '@/utils/engagementOwnership';
import { ACTIVE_COVERAGE_RADIUS_KM } from '@/data/operational-coverage';
import { isPublicSafeModeActive, setUnauthenticatedPublicSafe } from '@/hooks/usePublicSafeMode';

// Hub anchors (mirrors src/data/fte-capacity.ts)
const CARSON = { lat: 39.16204, lng: -119.75747 };
const HAWTHORNE = { lat: 38.5246, lng: -118.6256 };

const setPath = (pathname: string) => {
  const url = new URL(window.location.href);
  url.pathname = pathname || '/';
  url.search = '';
  window.history.replaceState({}, '', url.toString());
};

afterEach(() => setPath('/'));

describe('active field coverage — Hawthorne / Mineral', () => {
  it('is outside active coverage and resolves to Remote CHW Coverage', () => {
    expect(isPointInActiveFieldCoverage(HAWTHORNE.lat, HAWTHORNE.lng)).toBe(false);
    expect(
      isPointInsideActiveCoverageZone(HAWTHORNE.lat, HAWTHORNE.lng, ACTIVE_COVERAGE_RADIUS_KM),
    ).toBe(false);

    const ownership = getEngagementOwnership('Mineral', {
      lat: HAWTHORNE.lat,
      lng: HAWTHORNE.lng,
    });
    expect(ownership.inPersonAvailable).toBe(false);
    expect(ownership.ownershipLabel).toBe('Remote CHW Coverage');
    expect(ownership.ownershipLabel).not.toBe('Primary CHW Coverage');
  });
});

describe('active field coverage — Carson hub', () => {
  it('is inside active coverage and resolves to Primary CHW Coverage', () => {
    expect(isPointInActiveFieldCoverage(CARSON.lat, CARSON.lng)).toBe(true);

    const ownership = getEngagementOwnership('Carson City', {
      lat: CARSON.lat,
      lng: CARSON.lng,
    });
    expect(ownership.inPersonAvailable).toBe(true);
    expect(ownership.ownershipLabel).toBe('Primary CHW Coverage');
  });
});

describe('active field coverage — boundary behavior', () => {
  // 1° longitude ≈ 111.32 * cos(lat) km ≈ 86.4 km at Carson's latitude.
  // Use offsets that sit clearly inside / outside the configured radius
  // (default 120 km) along the Carson east axis.
  const KM_PER_DEG_LNG = 111.32 * Math.cos((CARSON.lat * Math.PI) / 180);

  it('returns true just inside and false just outside the active radius', () => {
    const insideKm = ACTIVE_COVERAGE_RADIUS_KM - 5;
    const outsideKm = ACTIVE_COVERAGE_RADIUS_KM + 5;

    const insidePt = { lat: CARSON.lat, lng: CARSON.lng + insideKm / KM_PER_DEG_LNG };
    const outsidePt = { lat: CARSON.lat, lng: CARSON.lng + outsideKm / KM_PER_DEG_LNG };

    expect(isPointInActiveFieldCoverage(insidePt.lat, insidePt.lng)).toBe(true);
    expect(isPointInActiveFieldCoverage(outsidePt.lat, outsidePt.lng)).toBe(false);
  });
});

describe('active field coverage — radius isolation', () => {
  it('engagement ownership only consumes the active coverage radius source', () => {
    // Static guarantee: engagementOwnership.ts must not import any
    // member / provider search-radius helper. The only allowed radius source
    // is ACTIVE_COVERAGE_RADIUS_KM (operational-coverage) plus the
    // active coverage geometry (fieldCoverageStatus / coverageZones).
    const src = readFileSync(
      resolve(__dirname, '../utils/engagementOwnership.ts'),
      'utf8',
    );
    expect(src).toContain("from '@/data/operational-coverage'");
    expect(src).toContain('ACTIVE_COVERAGE_RADIUS_KM');
    // No member/provider search-radius coupling.
    expect(src).not.toMatch(/memberAccess|providerVisibility|providerRadius|searchRadius/i);
  });

  it('default MemberPointContext radius is the active coverage constant', () => {
    // When no explicit radiusKm is supplied, ownership must fall back to the
    // active coverage constant — not any provider/member search radius.
    const inside = getEngagementOwnership('Carson City', {
      lat: CARSON.lat,
      lng: CARSON.lng,
    });
    const insideExplicit = getEngagementOwnership('Carson City', {
      lat: CARSON.lat,
      lng: CARSON.lng,
      radiusKm: ACTIVE_COVERAGE_RADIUS_KM,
    });
    expect(inside.inPersonAvailable).toBe(insideExplicit.inPersonAvailable);
  });
});

describe('public mode — SSHP gating vs coverage geometry', () => {
  it('/public route activates Public Safe Mode (single source of truth)', () => {
    setPath('/');
    setUnauthenticatedPublicSafe(false);
    expect(isPublicSafeModeActive()).toBe(false);

    setPath('/public');
    expect(isPublicSafeModeActive()).toBe(true);

    // Legacy query-param activation must no longer trigger public mode.
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '?public=1';
    window.history.replaceState({}, '', url.toString());
    expect(isPublicSafeModeActive()).toBe(false);
  });

  it('public mode does not alter active coverage classification', () => {
    setPath('/');
    const baseHawthorne = isPointInActiveFieldCoverage(HAWTHORNE.lat, HAWTHORNE.lng);
    const baseCarson = isPointInActiveFieldCoverage(CARSON.lat, CARSON.lng);
    const baseOwnershipHawthorne = getEngagementOwnership('Mineral', HAWTHORNE).ownershipLabel;
    const baseOwnershipCarson = getEngagementOwnership('Carson City', CARSON).ownershipLabel;

    setPath('/public');
    expect(isPublicSafeModeActive()).toBe(true);
    expect(isPointInActiveFieldCoverage(HAWTHORNE.lat, HAWTHORNE.lng)).toBe(baseHawthorne);
    expect(isPointInActiveFieldCoverage(CARSON.lat, CARSON.lng)).toBe(baseCarson);
    expect(getEngagementOwnership('Mineral', HAWTHORNE).ownershipLabel).toBe(baseOwnershipHawthorne);
    expect(getEngagementOwnership('Carson City', CARSON).ownershipLabel).toBe(baseOwnershipCarson);
  });
});
