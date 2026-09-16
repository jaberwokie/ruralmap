CREATE TABLE public.tiger_street_ranges (
  id bigserial PRIMARY KEY,
  vintage text NOT NULL,
  county_fips text NOT NULL,
  tlid text NOT NULL,
  side text NOT NULL CHECK (side IN ('L','R')),
  fullname text NOT NULL,
  street_key text NOT NULL,
  street_core text NOT NULL,
  from_hn integer NOT NULL,
  to_hn integer NOT NULL,
  lo_hn integer GENERATED ALWAYS AS (LEAST(from_hn, to_hn)) STORED,
  hi_hn integer GENERATED ALWAYS AS (GREATEST(from_hn, to_hn)) STORED,
  parity text,
  zip text,
  geom jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tiger_street_ranges IS
  'Public U.S. Census TIGER/Line ADDRFEAT street address ranges, Nevada only. PUBLIC REFERENCE DATA ONLY: no member-submitted address is ever stored here.';

GRANT ALL ON public.tiger_street_ranges TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tiger_street_ranges_id_seq TO service_role;
ALTER TABLE public.tiger_street_ranges ENABLE ROW LEVEL SECURITY;

CREATE INDEX tiger_street_ranges_key_zip_idx ON public.tiger_street_ranges (street_key, zip, lo_hn, hi_hn);
CREATE INDEX tiger_street_ranges_core_zip_idx ON public.tiger_street_ranges (street_core, zip, lo_hn, hi_hn);
CREATE INDEX tiger_street_ranges_key_county_idx ON public.tiger_street_ranges (street_key, county_fips);

-- Interpolate a point along a TIGER line segment at a 0..1 fraction of its
-- length. Longitude degrees are scaled by cos(latitude) so the fraction
-- reflects real distance rather than degree distance.
CREATE OR REPLACE FUNCTION public.tiger_interpolate_point(_geom jsonb, _frac double precision)
RETURNS double precision[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n integer;
  i integer;
  x1 double precision; y1 double precision;
  x2 double precision; y2 double precision;
  seg double precision;
  total double precision := 0;
  target double precision;
  acc double precision := 0;
  k double precision;
  f double precision := LEAST(GREATEST(COALESCE(_frac, 0.5), 0), 1);
BEGIN
  n := jsonb_array_length(_geom);
  IF n IS NULL OR n = 0 THEN RETURN NULL; END IF;
  IF n = 1 THEN
    RETURN ARRAY[(_geom->0->>1)::double precision, (_geom->0->>0)::double precision];
  END IF;

  FOR i IN 0..(n - 2) LOOP
    x1 := (_geom->i->>0)::double precision;      y1 := (_geom->i->>1)::double precision;
    x2 := (_geom->(i+1)->>0)::double precision;  y2 := (_geom->(i+1)->>1)::double precision;
    k := cos(radians((y1 + y2) / 2));
    total := total + sqrt(power((x2 - x1) * k, 2) + power(y2 - y1, 2));
  END LOOP;

  IF total = 0 THEN
    RETURN ARRAY[(_geom->0->>1)::double precision, (_geom->0->>0)::double precision];
  END IF;

  target := total * f;
  FOR i IN 0..(n - 2) LOOP
    x1 := (_geom->i->>0)::double precision;      y1 := (_geom->i->>1)::double precision;
    x2 := (_geom->(i+1)->>0)::double precision;  y2 := (_geom->(i+1)->>1)::double precision;
    k := cos(radians((y1 + y2) / 2));
    seg := sqrt(power((x2 - x1) * k, 2) + power(y2 - y1, 2));
    IF acc + seg >= target OR i = n - 2 THEN
      IF seg = 0 THEN
        RETURN ARRAY[y1, x1];
      END IF;
      RETURN ARRAY[
        y1 + (y2 - y1) * ((target - acc) / seg),
        x1 + (x2 - x1) * ((target - acc) / seg)
      ];
    END IF;
    acc := acc + seg;
  END LOOP;

  RETURN ARRAY[(_geom->(n-1)->>1)::double precision, (_geom->(n-1)->>0)::double precision];
END;
$$;

-- Deterministic candidate lookup for the internal member-address geocoder.
-- Returns candidate street segments whose address range contains the house
-- number, with an interpolated point. Ambiguity decisions are made by the
-- caller, never here.
CREATE OR REPLACE FUNCTION public.tiger_match_address(
  _house integer,
  _street_key text,
  _street_core text DEFAULT NULL,
  _zip text DEFAULT NULL,
  _county_fips text DEFAULT NULL
)
RETURNS TABLE (
  street_key text,
  street_core text,
  fullname text,
  county_fips text,
  tlid text,
  side text,
  zip text,
  from_hn integer,
  to_hn integer,
  parity text,
  exact_key boolean,
  zip_match boolean,
  lat double precision,
  lng double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _house IS NULL OR _street_key IS NULL OR length(_street_key) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.*,
      (r.street_key = _street_key) AS is_exact_key,
      (_zip IS NOT NULL AND r.zip = _zip) AS is_zip_match,
      CASE
        WHEN r.to_hn = r.from_hn THEN 0.5
        ELSE (_house - r.from_hn)::double precision / (r.to_hn - r.from_hn)::double precision
      END AS frac
    FROM public.tiger_street_ranges r
    WHERE (
        r.street_key = _street_key
        OR (_street_core IS NOT NULL AND length(_street_core) > 0 AND r.street_core = _street_core)
      )
      AND _house BETWEEN r.lo_hn AND r.hi_hn
      AND (
        r.parity IS NULL
        OR r.parity NOT IN ('O','E')
        OR (r.parity = 'O' AND _house % 2 = 1)
        OR (r.parity = 'E' AND _house % 2 = 0)
      )
      AND (_county_fips IS NULL OR r.county_fips = _county_fips)
    LIMIT 200
  )
  SELECT
    c.street_key, c.street_core, c.fullname, c.county_fips, c.tlid, c.side, c.zip,
    c.from_hn, c.to_hn, c.parity, c.is_exact_key, c.is_zip_match,
    (public.tiger_interpolate_point(c.geom, c.frac))[1],
    (public.tiger_interpolate_point(c.geom, c.frac))[2]
  FROM candidates c
  ORDER BY c.is_exact_key DESC, c.is_zip_match DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.tiger_match_address(integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tiger_match_address(integer, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.tiger_match_address(integer, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tiger_match_address(integer, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.tiger_interpolate_point(jsonb, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiger_interpolate_point(jsonb, double precision) TO service_role;