/** Independent edition: no preconfigured partner field or remote staffing. */
import { describe, it, expect, afterEach } from 'vitest';
import { isPointInActiveFieldCoverage } from '@/utils/fieldCoverageStatus';
import { getEngagementOwnership } from '@/utils/engagementOwnership';
import { isPublicSafeModeActive, setUnauthenticatedPublicSafe } from '@/hooks/usePublicSafeMode';

const CARSON = { lat: 39.16204, lng: -119.75747 };
const HAWTHORNE = { lat: 38.5246, lng: -118.6256 };

const setPath = (pathname: string) => {
  const url = new URL(window.location.href);
  url.pathname = pathname || '/';
  url.search = '';
  window.history.replaceState({}, '', url.toString());
};

afterEach(() => setPath('/'));

describe('independent edition — no inferred staffing', () => {
  it('does not infer staff coverage from legacy field hubs', () => {
    for (const point of [CARSON, HAWTHORNE]) {
      expect(isPointInActiveFieldCoverage(point.lat, point.lng)).toBe(false);
    }
  });

  it('does not assign a CHW or promise remote response anywhere', () => {
    for (const [county, point] of [['Carson City', CARSON], ['Mineral', HAWTHORNE]] as const) {
      const ownership = getEngagementOwnership(county, point);
      expect(ownership.inPersonAvailable).toBe(false);
      expect(ownership.telehealthAvailable).toBe(false);
      expect(ownership.ownershipType).toBe('none');
    }
  });
});

describe('public route behavior', () => {
  it('/public route activates Public Safe Mode', () => {
    setPath('/');
    setUnauthenticatedPublicSafe(false);
    expect(isPublicSafeModeActive()).toBe(false);
    setPath('/public');
    expect(isPublicSafeModeActive()).toBe(true);
  });
});
