/**
 * Phase 2A — application read path: normalized dataset with static fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dbResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: async () => dbResult }),
  },
}));

const rawCounty = (name: string, over: Record<string, unknown> = {}) => ({
  countyName: name,
  pct_100_20_plus: 60,
  pct_25_3_to_100_20: 20,
  pct_below_25_3: 20,
  fiberShare: 10,
  cableShare: 20,
  fixedWirelessShare: 30,
  satelliteShare: 40,
  coverageUnevenness: false,
  notes: 'static',
  ...over,
});

const dbRow = (name: string, over: Record<string, unknown> = {}) => ({
  county_name: name,
  pct_100_20_plus: 90,
  pct_25_3_to_100_20: 5,
  pct_below_25_3: 5,
  fiber_share: 50,
  cable_share: 30,
  fixed_wireless_share: 10,
  satellite_share: 10,
  coverage_unevenness: true,
  notes: 'normalized',
  ...over,
});

const staticPayload = [rawCounty('Nye'), rawCounty('Elko')];

let staticFetchOk = true;

const importModule = async () => {
  vi.resetModules();
  return import('@/data/broadband-coverage');
};

beforeEach(() => {
  dbResult.data = null;
  dbResult.error = null;
  staticFetchOk = true;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: staticFetchOk,
    status: staticFetchOk ? 200 : 404,
    json: async () => staticPayload,
  })) as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('broadband application read path', () => {
  it('uses the normalized database dataset when valid', async () => {
    dbResult.data = [dbRow('Nye'), dbRow('Elko')];
    const mod = await importModule();
    expect(await mod.loadBroadbandData()).toBe(true);
    expect(mod.COUNTY_BROADBAND_DATA).toHaveLength(2);
    expect(mod.getCountyBroadband('Nye')?.notes).toBe('normalized');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to static JSON when the database request fails', async () => {
    dbResult.error = { message: 'permission denied' };
    const mod = await importModule();
    expect(await mod.loadBroadbandData()).toBe(true);
    expect(mod.getCountyBroadband('Nye')?.notes).toBe('static');
  });

  it('falls back to static JSON when the database response is empty', async () => {
    dbResult.data = [];
    const mod = await importModule();
    expect(await mod.loadBroadbandData()).toBe(true);
    expect(mod.getCountyBroadband('Elko')?.notes).toBe('static');
  });

  it('falls back to static JSON when the database response fails validation', async () => {
    dbResult.data = [dbRow('Nye', { pct_100_20_plus: null })];
    const mod = await importModule();
    expect(await mod.loadBroadbandData()).toBe(true);
    expect(mod.getCountyBroadband('Nye')?.notes).toBe('static');
  });

  it('reports failure only when both paths are unusable', async () => {
    dbResult.error = { message: 'offline' };
    staticFetchOk = false;
    const mod = await importModule();
    expect(await mod.loadBroadbandData()).toBe(false);
    expect(mod.COUNTY_BROADBAND_DATA).toHaveLength(0);
  });

  it('keeps the existing exported contract for consumers', async () => {
    dbResult.data = [dbRow('Nye')];
    const mod = await importModule();
    await mod.loadBroadbandData();
    const record = mod.getCountyBroadband('Nye County');
    expect(record).toBeDefined();
    expect(record).toMatchObject({
      countyName: 'Nye',
      operationalReadiness: expect.any(String),
      broadbandStatus: expect.any(String),
      dominantTechnology: expect.any(String),
      servedPercent: 90,
      underservedPercent: 5,
      unservedPercent: 5,
    });
  });
});
