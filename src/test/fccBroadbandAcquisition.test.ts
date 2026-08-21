/**
 * Phase 2A.1 — FCC acquisition protocol: credentials, release selection,
 * manifest filtering, technology crosswalk, redaction.
 */
import { describe, it, expect } from 'vitest';
import {
  FCC_API_BASE,
  FCC_CREDENTIAL_ENV_NAMES,
  FCC_FIXED_TECHNOLOGY_CODES,
  aggregateArtifactIdentity,
  fccEndpoints,
  redactCredentials,
  resolveCredentials,
  selectLatestPublishedRelease,
  selectRequiredNevadaArtifacts,
} from './helpers/fccBroadbandPorts';

const env = (values: Record<string, string>) => (name: string) => values[name];

describe('credentials', () => {
  it('fails with fcc_credentials_missing and names only when unset', () => {
    try {
      resolveCredentials(env({}));
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; message: string };
      expect(e.code).toBe('fcc_credentials_missing');
      expect(e.message).toContain('FCC_BDC_API_USERNAME');
      expect(e.message).toContain('FCC_BDC_API_HASH_VALUE');
    }
  });

  it('fails when only one credential is present', () => {
    expect(() => resolveCredentials(env({ FCC_BDC_API_USERNAME: 'a' }))).toThrow(/FCC_BDC_API_HASH_VALUE/);
  });

  it('resolves both credentials when configured', () => {
    const creds = resolveCredentials(
      env({ FCC_BDC_API_USERNAME: 'user@example.org', FCC_BDC_API_HASH_VALUE: 'abc123' }),
    );
    expect(creds.username).toBe('user@example.org');
    expect(creds.hashValue).toBe('abc123');
  });

  it('declares only secret names, never values', () => {
    expect(FCC_CREDENTIAL_ENV_NAMES).toEqual(['FCC_BDC_API_USERNAME', 'FCC_BDC_API_HASH_VALUE']);
  });
});

describe('endpoints', () => {
  it('uses the official public API base with no invented version segment', () => {
    expect(FCC_API_BASE).toBe('https://broadbandmap.fcc.gov/api/public/map');
    expect(fccEndpoints.listAsOfDates()).toBe(`${FCC_API_BASE}/listAsOfDates`);
    expect(fccEndpoints.listAvailabilityData('2024-06-30')).toBe(
      `${FCC_API_BASE}/downloads/listAvailabilityData/2024-06-30`,
    );
    expect(fccEndpoints.downloadFile('42')).toBe(
      `${FCC_API_BASE}/downloads/downloadFile/availability/42`,
    );
  });
});

describe('release selection', () => {
  const today = new Date('2026-08-21T00:00:00Z');

  it('selects the newest published availability release', () => {
    const res = selectLatestPublishedRelease(
      {
        data: [
          { as_of_date: '2023-06-30', data_type: 'availability' },
          { as_of_date: '2024-12-31', data_type: 'availability' },
          { as_of_date: '2024-06-30', data_type: 'availability' },
        ],
      },
      today,
    );
    expect(res.asOfDate).toBe('2024-12-31');
  });

  it('ignores non-availability data types', () => {
    const res = selectLatestPublishedRelease(
      [
        { as_of_date: '2026-06-30', data_type: 'challenge' },
        { as_of_date: '2025-12-31', data_type: 'availability' },
      ],
      today,
    );
    expect(res.asOfDate).toBe('2025-12-31');
  });

  it('never selects a future as-of date', () => {
    const res = selectLatestPublishedRelease(
      [
        { as_of_date: '2027-06-30', data_type: 'availability' },
        { as_of_date: '2025-06-30', data_type: 'availability' },
      ],
      today,
    );
    expect(res.asOfDate).toBe('2025-06-30');
  });

  it('fails when nothing valid is advertised', () => {
    expect(() =>
      selectLatestPublishedRelease([{ as_of_date: 'not-a-date', data_type: 'availability' }], today),
    ).toThrow(/No published FCC fixed-availability release/i);
  });

  it('fails when the response is empty', () => {
    expect(() => selectLatestPublishedRelease({ data: [] }, today)).toThrow(/no entries/i);
  });
});

describe('manifest filtering', () => {
  const summaryFile = {
    file_id: 901,
    file_name: 'bdc_us_fixed_broadband_summary_by_geography_D24Jun_29aug2024.zip',
    category: 'Summary Data',
    subcategory: 'Fixed Broadband Summary by Geography Type',
    state_fips: null,
  };

  it('selects the county-denominator artifact', () => {
    const artifacts = selectRequiredNevadaArtifacts({
      data: [
        summaryFile,
        {
          file_id: 12,
          file_name: 'bdc_06_Cable_fixed_broadband_D24Jun_29aug2024.zip',
          category: 'Availability Data',
          subcategory: 'Fixed Broadband Availability Data',
          state_fips: '06',
        },
      ],
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].fileId).toBe('901');
    expect(artifacts[0].role).toBe('fixed_summary_by_geography');
  });

  it('never selects another state\u2019s availability files', () => {
    const artifacts = selectRequiredNevadaArtifacts([
      summaryFile,
      { file_id: 5, file_name: 'bdc_06_Fiber_fixed_broadband.zip', state_fips: '06' },
      { file_id: 6, file_name: 'bdc_48_Fiber_fixed_broadband.zip', state_fips: '48' },
    ]);
    expect(artifacts.map((a) => a.fileId)).toEqual(['901']);
  });

  it('accepts a Nevada-scoped summary artifact when the FCC scopes it by state', () => {
    const artifacts = selectRequiredNevadaArtifacts([
      {
        file_id: 77,
        file_name: 'bdc_32_fixed_broadband_summary_by_geography.zip',
        state_fips: '32',
        state_name: 'Nevada',
      },
    ]);
    expect(artifacts[0].fileId).toBe('77');
  });

  it('fails when the release has no summary-by-geography artifact', () => {
    expect(() =>
      selectRequiredNevadaArtifacts([
        { file_id: 5, file_name: 'bdc_32_Fiber_fixed_broadband.zip', state_fips: '32' },
      ]),
    ).toThrow(/no "Fixed Broadband Summary by Geography Type" artifact/i);
  });

  it('fails on an empty manifest', () => {
    expect(() => selectRequiredNevadaArtifacts({ data: [] })).toThrow(/no files/i);
  });

  it('produces a deterministic artifact identity', () => {
    const a = aggregateArtifactIdentity([
      { fileName: 'b.zip', sha256: 'bb' },
      { fileName: 'a.zip', sha256: 'aa' },
    ]);
    const b = aggregateArtifactIdentity([
      { fileName: 'a.zip', sha256: 'aa' },
      { fileName: 'b.zip', sha256: 'bb' },
    ]);
    expect(a).toBe(b);
  });
});

describe('technology crosswalk', () => {
  it('maps the official FCC fixed technology codes', () => {
    expect(FCC_FIXED_TECHNOLOGY_CODES['50']).toMatch(/Fiber/);
    expect(FCC_FIXED_TECHNOLOGY_CODES['40']).toMatch(/Cable/);
    expect(FCC_FIXED_TECHNOLOGY_CODES['60']).toMatch(/Geostationary Satellite/);
    expect(FCC_FIXED_TECHNOLOGY_CODES['61']).toMatch(/Non-geostationary Satellite/);
    expect(FCC_FIXED_TECHNOLOGY_CODES['71']).toMatch(/Licensed Fixed Wireless/);
    expect(FCC_FIXED_TECHNOLOGY_CODES['72']).toMatch(/Licensed-by-Rule/);
  });
});

describe('redaction', () => {
  it('removes credential values from operator-facing messages', () => {
    const msg = redactCredentials('auth failed for user@example.org with hash abc12345', [
      'user@example.org',
      'abc12345',
    ]);
    expect(msg).not.toContain('user@example.org');
    expect(msg).not.toContain('abc12345');
  });

  it('strips credential-looking query parameters', () => {
    expect(redactCredentials('GET /x?username=bob&hash_value=zzz', [])).toContain('username=[redacted]');
  });
});
