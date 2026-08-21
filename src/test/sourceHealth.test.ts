import { describe, it, expect } from 'vitest';
import {
  calculateSourceHealth,
  getSourceWarnings,
  summarizeHealth,
} from '@/lib/sources/sourceHealth';

const NOW = new Date('2026-08-21T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe('calculateSourceHealth', () => {
  it('returns current when recently verified and review is in the future', () => {
    expect(
      calculateSourceHealth(
        { status: 'current', last_verified_at: daysAgo(5), stale_after_days: 90, next_review_at: daysAhead(30) },
        NOW,
      ),
    ).toBe('current');
  });

  it('returns stale when freshness exceeds stale_after_days', () => {
    expect(
      calculateSourceHealth({ last_verified_at: daysAgo(120), stale_after_days: 90 }, NOW),
    ).toBe('stale');
  });

  it('does not go stale exactly at the boundary', () => {
    expect(
      calculateSourceHealth({ last_verified_at: daysAgo(90), stale_after_days: 90 }, NOW),
    ).toBe('current');
  });

  it('returns review_due when the review date has passed but data is not stale', () => {
    expect(
      calculateSourceHealth(
        { last_verified_at: daysAgo(10), stale_after_days: 365, next_review_at: daysAgo(1) },
        NOW,
      ),
    ).toBe('review_due');
  });

  it('prefers stale over review_due', () => {
    expect(
      calculateSourceHealth(
        { last_verified_at: daysAgo(400), stale_after_days: 90, next_review_at: daysAgo(1) },
        NOW,
      ),
    ).toBe('stale');
  });

  it('returns unknown when there is no freshness evidence', () => {
    expect(calculateSourceHealth({ status: 'unknown' }, NOW)).toBe('unknown');
    expect(calculateSourceHealth({}, NOW)).toBe('unknown');
  });

  it('returns unknown when only stale_after_days is set with no dates', () => {
    expect(calculateSourceHealth({ stale_after_days: 30 }, NOW)).toBe('unknown');
  });

  it('returns failing for explicit failing or disabled status', () => {
    expect(calculateSourceHealth({ status: 'failing', last_verified_at: daysAgo(1) }, NOW)).toBe('failing');
    expect(calculateSourceHealth({ status: 'disabled' }, NOW)).toBe('failing');
  });

  it('returns failing when the latest ingestion attempt failed', () => {
    expect(
      calculateSourceHealth(
        {
          status: 'current',
          last_successful_ingestion_at: daysAgo(10),
          last_failed_ingestion_at: daysAgo(1),
        },
        NOW,
      ),
    ).toBe('failing');
  });

  it('is not failing when a success came after the failure', () => {
    expect(
      calculateSourceHealth(
        {
          status: 'current',
          last_successful_ingestion_at: daysAgo(1),
          last_failed_ingestion_at: daysAgo(10),
          stale_after_days: 90,
        },
        NOW,
      ),
    ).toBe('current');
  });

  it('ignores unparseable dates rather than throwing', () => {
    expect(calculateSourceHealth({ last_verified_at: 'not-a-date' }, NOW)).toBe('unknown');
  });
});

describe('getSourceWarnings', () => {
  it('flags a credential-requiring source with no credential reference', () => {
    const codes = getSourceWarnings(
      { source_name: 'X', requires_credentials: true, credential_reference: null, owner_role: 'admin' },
      NOW,
    ).map((w) => w.code);
    expect(codes).toContain('missing_credential_reference');
  });

  it('flags a source with no owner', () => {
    const codes = getSourceWarnings({ source_name: 'X' }, NOW).map((w) => w.code);
    expect(codes).toContain('missing_owner');
  });

  it('flags a runtime-critical failing source', () => {
    const codes = getSourceWarnings(
      { source_name: 'X', status: 'failing', runtime_dependency: true, owner_name: 'Ops' },
      NOW,
    ).map((w) => w.code);
    expect(codes).toContain('runtime_critical_failing');
  });

  it('flags an ingestion target with no successful ingestion history', () => {
    const codes = getSourceWarnings(
      { source_name: 'X', internalization_target: 'ingest_internal', owner_name: 'Ops' },
      NOW,
    ).map((w) => w.code);
    expect(codes).toContain('no_successful_ingestion');
  });

  it('does not flag ingestion history for sources that remain external', () => {
    const codes = getSourceWarnings(
      { source_name: 'X', internalization_target: 'remain_external', owner_name: 'Ops' },
      NOW,
    ).map((w) => w.code);
    expect(codes).not.toContain('no_successful_ingestion');
  });

  it('flags stale and overdue review together', () => {
    const codes = getSourceWarnings(
      {
        source_name: 'X',
        owner_name: 'Ops',
        last_verified_at: daysAgo(400),
        stale_after_days: 90,
        next_review_at: daysAgo(5),
        internalization_target: 'remain_external',
      },
      NOW,
    ).map((w) => w.code);
    expect(codes).toContain('stale');
    expect(codes).toContain('review_overdue');
  });

  it('returns no warnings for a fully governed healthy source', () => {
    expect(
      getSourceWarnings(
        {
          source_name: 'X',
          status: 'current',
          owner_role: 'admin',
          owner_name: 'Data Ops',
          requires_credentials: false,
          internalization_target: 'remain_external',
          last_verified_at: daysAgo(2),
          stale_after_days: 90,
          next_review_at: daysAhead(60),
        },
        NOW,
      ),
    ).toEqual([]);
  });
});

describe('summarizeHealth', () => {
  it('counts every health bucket', () => {
    const counts = summarizeHealth(
      [
        { last_verified_at: daysAgo(1), stale_after_days: 90 },
        { last_verified_at: daysAgo(500), stale_after_days: 90 },
        { last_verified_at: daysAgo(1), stale_after_days: 365, next_review_at: daysAgo(1) },
        { status: 'failing' },
        {},
      ],
      NOW,
    );
    expect(counts).toEqual({ current: 1, stale: 1, review_due: 1, failing: 1, unknown: 1 });
  });
});
