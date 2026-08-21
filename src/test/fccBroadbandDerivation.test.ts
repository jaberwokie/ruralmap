/**
 * Phase 2A.1 — FCC county derivation contract.
 */
import { describe, it, expect } from 'vitest';
import {
  DERIVATION_VERSION,
  NEVADA_COUNTY_FIPS,
  deriveNevadaCounties,
  parseCsv,
  round1,
  splitCsvLine,
  toNormalizedRows,
  type CarriedRuralToolValues,
} from './helpers/fccBroadbandPorts';

const HEADER =
  'area_data_type,geography_type,geography_id,geography_desc,biz_res,technology,total_units,speed_25_3,speed_100_20';

const row = (
  fips: string,
  technology: string,
  s25: string,
  s100: string,
  units = '5000',
  area = 'Total',
  bizRes = 'R',
) => `${area},County,${fips},"Some County, NV",${bizRes},${technology},${units},${s25},${s100}`;

const fullCsv = (
  overrides: Record<string, { s25: string; s100: string }> = {},
  extra: string[] = [],
) => {
  const lines = [HEADER];
  for (const c of NEVADA_COUNTY_FIPS) {
    const o = overrides[c.fips] ?? { s25: '0.9', s100: '0.75' };
    lines.push(row(c.fips, 'All Terrestrial', o.s25, o.s100));
    lines.push(row(c.fips, 'Fiber', '0.4', '0.35'));
    lines.push(row(c.fips, 'Cable', '0.5', '0.45'));
    lines.push(row(c.fips, 'All Fixed Wireless', '0.3', '0.1'));
    lines.push(row(c.fips, 'All Satellite', '1', '0.2'));
  }
  return [...lines, ...extra].join('\n');
};

describe('CSV parsing', () => {
  it('handles quoted fields with embedded commas', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('rejects a payload missing required columns', () => {
    expect(() => parseCsv('geography_type,geography_id\nCounty,32001')).toThrow(/missing required columns/i);
  });
});

describe('deriveNevadaCounties', () => {
  it('derives all 17 Nevada counties with tiers that partition to 100', () => {
    const { metrics, summary } = deriveNevadaCounties(fullCsv());
    expect(metrics).toHaveLength(17);
    expect(summary.version).toBe(DERIVATION_VERSION);
    for (const m of metrics) {
      expect(round1(m.pct_100_20_plus + m.pct_25_3_to_100_20 + m.pct_below_25_3)).toBe(100);
    }
  });

  it('applies the documented formulas exactly', () => {
    const { metrics } = deriveNevadaCounties(fullCsv({ '32023': { s25: '0.812', s100: '0.554' } }));
    const nye = metrics.find((m) => m.county_name === 'Nye')!;
    expect(nye.pct_100_20_plus).toBe(55.4);
    expect(nye.pct_25_3_to_100_20).toBe(25.8);
    expect(nye.pct_below_25_3).toBe(18.8);
  });

  it('records the FCC denominator per county', () => {
    const { metrics, summary } = deriveNevadaCounties(fullCsv());
    expect(metrics[0].total_units).toBe(5000);
    expect(summary.denominator).toMatch(/Broadband Serviceable Location/i);
    expect(summary.grouping.biz_res).toMatch(/^R/);
  });

  it('keeps per-technology values as overlapping availability, not a 100% mix', () => {
    const { metrics, summary } = deriveNevadaCounties(fullCsv());
    const m = metrics[0];
    const sum =
      (m.fcc_fiber_availability ?? 0) +
      (m.fcc_cable_availability ?? 0) +
      (m.fcc_fixed_wireless_availability ?? 0) +
      (m.fcc_satellite_availability ?? 0);
    expect(sum).toBeGreaterThan(100);
    expect(summary.formulas.technology_availability).toMatch(/OVERLAPPING/);
  });

  it('excludes satellite from the speed-tier technology', () => {
    const { summary } = deriveNevadaCounties(fullCsv());
    expect(summary.technology_treatment.speed_tiers.excluded_codes).toEqual(['60', '61']);
    expect(summary.technology_treatment.speed_tiers.summary_technology).toBe('All Terrestrial');
  });

  it('fails when a Nevada county is absent from the release', () => {
    const csv = fullCsv()
      .split('\n')
      .filter((l) => !l.includes(',32023,'))
      .join('\n');
    expect(() => deriveNevadaCounties(csv)).toThrow(/Missing FIPS: 32023/);
  });

  it('fails rather than treating an empty percentage as zero', () => {
    const csv = fullCsv().replace(
      row('32001', 'All Terrestrial', '0.9', '0.75'),
      row('32001', 'All Terrestrial', '', '0.75'),
    );
    expect(() => deriveNevadaCounties(csv)).toThrow(/refusing to treat a missing value as 0/i);
  });

  it('fails when a denominator is missing', () => {
    const csv = fullCsv().replace(
      row('32001', 'All Terrestrial', '0.9', '0.75'),
      row('32001', 'All Terrestrial', '0.9', '0.75', '0'),
    );
    expect(() => deriveNevadaCounties(csv)).toThrow(/total_units denominator/i);
  });

  it('fails when the speed tiers are not nested', () => {
    expect(() => deriveNevadaCounties(fullCsv({ '32003': { s25: '0.5', s100: '0.8' } }))).toThrow(
      /not nested as documented/i,
    );
  });

  it('ignores non-county, non-total and business rows', () => {
    const extra = [
      'Total,State,32,"Nevada",R,All Terrestrial,900000,0.99,0.99',
      'Rural,County,32023,"Nye",R,All Terrestrial,100,0.1,0.1',
      'Total,County,32023,"Nye",B,All Terrestrial,100,0.1,0.1',
    ];
    const { metrics } = deriveNevadaCounties(fullCsv({}, extra));
    expect(metrics).toHaveLength(17);
    expect(metrics.find((m) => m.county_name === 'Nye')!.pct_100_20_plus).toBe(75);
  });

  it('rejects duplicate county/technology rows instead of double counting', () => {
    const dup = [row('32001', 'All Terrestrial', '0.5', '0.5')];
    expect(() => deriveNevadaCounties(fullCsv({}, dup))).toThrow(/Duplicate FCC row/i);
  });

  it('is deterministic for identical input', () => {
    const a = deriveNevadaCounties(fullCsv()).metrics;
    const b = deriveNevadaCounties(fullCsv()).metrics;
    expect(a).toEqual(b);
  });
});

describe('compatibility boundary', () => {
  const carried: CarriedRuralToolValues[] = NEVADA_COUNTY_FIPS.map((c) => ({
    county_key: c.name.toLowerCase().replace(/\s+/g, '_'),
    fiber_share: 10,
    cable_share: 20,
    fixed_wireless_share: 30,
    satellite_share: 40,
    coverage_unevenness: true,
    notes: 'carried',
  }));

  it('carries Rural Tool interpretation values instead of inventing shares', () => {
    const { metrics } = deriveNevadaCounties(fullCsv());
    const rows = toNormalizedRows(metrics, carried);
    expect(rows).toHaveLength(17);
    for (const r of rows) {
      expect(r.fiber_share).toBe(10);
      expect(r.satellite_share).toBe(40);
      expect(r.coverage_unevenness).toBe(true);
      expect(r.notes).toBe('carried');
    }
  });

  it('emits exactly the existing normalized contract keys', () => {
    const { metrics } = deriveNevadaCounties(fullCsv());
    const rows = toNormalizedRows(metrics, carried);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'cable_share',
        'county_key',
        'county_name',
        'coverage_unevenness',
        'fiber_share',
        'fixed_wireless_share',
        'notes',
        'pct_100_20_plus',
        'pct_25_3_to_100_20',
        'pct_below_25_3',
        'satellite_share',
      ].sort(),
    );
  });

  it('fails when interpretation values are unavailable for a county', () => {
    const { metrics } = deriveNevadaCounties(fullCsv());
    expect(() => toNormalizedRows(metrics, carried.slice(1))).toThrow(/refusing to invent share values/i);
  });
});
