import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const CONFIDENCE_MAP: Record<string, string> = {
  ROOFTOP: 'rooftop',
  RANGE_INTERPOLATED: 'range',
  GEOMETRIC_CENTER: 'geometric',
  APPROXIMATE: 'approximate',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GOOGLE_GEOCODING_API_KEY');
    if (!apiKey) return json({ error: 'GOOGLE_GEOCODING_API_KEY not configured' }, 500);

    const body = await req.json().catch(() => null) as
      | { table?: string; id?: string; force?: boolean }
      | null;
    if (!body || !body.table || !body.id) {
      return json({ error: 'Missing required fields: table, id' }, 400);
    }
    const { table, id, force } = body;
    if (table !== 'facilities' && table !== 'staging_providers') {
      return json({ error: 'Invalid table. Must be "facilities" or "staging_providers"' }, 400);
    }

    const latCol = table === 'facilities' ? 'lat' : 'latitude';
    const lngCol = table === 'facilities' ? 'lng' : 'longitude';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: record, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return json({ error: `Lookup failed: ${fetchErr.message}` }, 500);
    if (!record) return json({ error: 'Record not found' }, 404);

    if (record.coordinate_locked && !force) {
      return json({
        success: true,
        locked: true,
        lat: record[latCol],
        lng: record[lngCol],
        confidence: record.coordinate_confidence,
        match_type: record.geocode_match_type,
      });
    }

    if (!record.street_address) {
      return json({ error: 'Record has no street_address' }, 400);
    }

    const addressParts = [
      record.street_address,
      record.city,
      record.state ?? 'NV',
      record.zip,
    ].filter(Boolean).join(', ');

    const url = `${GOOGLE_URL}?address=${encodeURIComponent(addressParts)}&components=administrative_area:NV|country:US&key=${apiKey}`;

    let googleData: any;
    try {
      const res = await fetch(url);
      googleData = await res.json();
    } catch (e) {
      return json({ error: `Google API request failed: ${String(e)}` }, 502);
    }

    if (googleData.status !== 'OK' || !googleData.results?.length) {
      await supabase
        .from(table)
        .update({
          coordinate_source: 'failed',
          geocode_provider: 'google',
          geocode_match_type: googleData.status ?? null,
          last_geocoded_at: new Date().toISOString(),
        })
        .eq('id', id);
      return json({
        error: `Google returned no results (status: ${googleData.status ?? 'unknown'})`,
        google_status: googleData.status,
      }, 422);
    }

    const result = googleData.results[0];
    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;
    const matchType = result.geometry?.location_type as string | undefined;
    const formattedAddress = result.formatted_address as string | undefined;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'Google result missing coordinates' }, 502);
    }

    const confidence = matchType ? (CONFIDENCE_MAP[matchType] ?? 'approximate') : 'approximate';

    const update: Record<string, unknown> = {
      geocoded_lat: lat,
      geocoded_lng: lng,
      coordinate_source: 'google',
      coordinate_confidence: confidence,
      geocode_provider: 'google',
      geocode_match_type: matchType ?? null,
      last_geocoded_at: new Date().toISOString(),
    };

    if (!record.coordinate_locked) {
      update[latCol] = lat;
      update[lngCol] = lng;
    }

    const { error: updateErr } = await supabase.from(table).update(update).eq('id', id);
    if (updateErr) return json({ error: `Update failed: ${updateErr.message}` }, 500);

    return json({
      success: true,
      lat,
      lng,
      confidence,
      match_type: matchType,
      formatted_address: formattedAddress,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
