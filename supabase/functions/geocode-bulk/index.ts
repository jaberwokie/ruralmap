import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const NV_VIEWBOX = '-120.0064,42.0022,-114.0396,35.0019';
const NV_BOUNDS = { minLat: 35.0019, maxLat: 42.0022, minLng: -120.0064, maxLng: -114.0396 };

const isInNevada = (lat: number, lng: number) =>
  lat >= NV_BOUNDS.minLat && lat <= NV_BOUNDS.maxLat &&
  lng >= NV_BOUNDS.minLng && lng <= NV_BOUNDS.maxLng;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const normalizeAddress = (street: string): string => {
  return street
    .replace(/\b(suite|ste\.?|unit|apt\.?|apartment|bldg\.?|building|room|rm\.?|#)\s*[\w-]*/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const geocodeAddress = async (streetAddress: string, city: string, state: string, zip: string | null): Promise<{ lat: number; lng: number; strategy: string } | null> => {
  const normalized = normalizeAddress(streetAddress ?? '');
  const parts = [normalized, city, state, zip].filter(Boolean).join(', ');
  if (!parts) return null;

  // Stage 1 — Nominatim bounded
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(parts)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=${NV_VIEWBOX}&bounded=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NovumHealth-RuralMap/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const hit = data.find((r: { lat: string; lon: string }) => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
      });
      if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), strategy: 'address_full' };
    }
  } catch { /* continue */ }

  await delay(500);

  // Stage 2 — Census Geocoder
  try {
    const censusUrl = `${CENSUS_URL}?address=${encodeURIComponent(parts)}&benchmark=2020&format=json`;
    const res = await fetch(censusUrl);
    if (res.ok) {
      const data = await res.json();
      const match = data?.result?.addressMatches?.[0];
      if (match) {
        const lat = match.coordinates?.y;
        const lng = match.coordinates?.x;
        if (Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng)) {
          return { lat, lng, strategy: 'census_onelineaddress' };
        }
      }
    }
  } catch { /* continue */ }

  await delay(500);

  // Stage 3 — Nominatim unbounded
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(parts)}&format=json&limit=5&addressdetails=1&countrycodes=us&viewbox=${NV_VIEWBOX}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NovumHealth-RuralMap/1.0' } });
    if (res.ok) {
      const data = await res.json();
      const hit = data.find((r: { lat: string; lon: string }) => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        return Number.isFinite(lat) && Number.isFinite(lng) && isInNevada(lat, lng);
      });
      if (hit) return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), strategy: 'city_county_fallback' };
    }
  } catch { /* continue */ }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { table } = await req.json();
    if (table !== 'facilities' && table !== 'rural_services') {
      return new Response(JSON.stringify({ error: 'invalid table' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rows } = await supabase.from(table).select('*');
    const targets = (rows ?? []).filter((r: any) => r.lat == null && r.lng == null);

    let geocoded = 0, failed = 0, skipped = 0;

    for (const row of targets) {
      if (!row.street_address) { skipped++; continue; }

      const result = await geocodeAddress(
        row.street_address,
        row.city ?? '',
        row.state ?? 'NV',
        row.zip ?? null,
      );

      const now = new Date().toISOString().slice(0, 10);

      if (result) {
        const confidence = result.strategy === 'address_full' ? 'high' : 'low';
        const tag = `[geocode:${result.strategy}|${confidence}|${now}]`;
        await supabase.from(table).update({
          lat: result.lat,
          lng: result.lng,
          access_notes: tag,
        }).eq('id', row.id);
        geocoded++;
      } else {
        const tag = `[geocode:failed|low|${now}]`;
        await supabase.from(table).update({ access_notes: tag }).eq('id', row.id);
        failed++;
      }

      await delay(1100);
    }

    return new Response(JSON.stringify({ geocoded, failed, skipped, total: targets.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
