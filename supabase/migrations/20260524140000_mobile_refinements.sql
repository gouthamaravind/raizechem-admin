-- Mobile Refinements & GPS Jitter Filter

-- 1. Refine compute_session_km with jitter filtering
-- We ignore movements less than 20 meters to prevent stationary distance accumulation
CREATE OR REPLACE FUNCTION public.compute_session_km(_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_distance numeric := 0;
  prev_lat double precision;
  prev_lng double precision;
  cur_dist numeric := 0;
  cur record;
BEGIN
  FOR cur IN
    SELECT lat, lng FROM public.location_points
    WHERE duty_session_id = _session_id
    ORDER BY recorded_at ASC
  LOOP
    IF prev_lat IS NOT NULL THEN
      -- Haversine formula
      cur_dist := (
        6371 * 2 * asin(sqrt(
          power(sin(radians(cur.lat - prev_lat) / 2), 2) +
          cos(radians(prev_lat)) * cos(radians(cur.lat)) *
          power(sin(radians(cur.lng - prev_lng) / 2), 2)
        ))
      );
      
      -- Jitter Filter: Only add if distance > 0.02 km (20 meters)
      IF cur_dist > 0.02 THEN
        total_distance := total_distance + cur_dist;
        prev_lat := cur.lat;
        prev_lng := cur.lng;
      END IF;
    ELSE
      prev_lat := cur.lat;
      prev_lng := cur.lng;
    END IF;
  END LOOP;
  RETURN round(total_distance, 2);
END;
$$;

-- 2. Ensure finalize_duty_session also recalculates before closing
CREATE OR REPLACE FUNCTION public.finalize_duty_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess record;
  km numeric;
  duration_mins integer;
  incentive numeric;
BEGIN
  SELECT * INTO sess FROM public.duty_sessions WHERE id = _session_id;
  IF sess IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;

  -- Use the refined compute_session_km
  km := public.compute_session_km(_session_id);
  duration_mins := EXTRACT(EPOCH FROM (now() - sess.start_time))::integer / 60;
  incentive := public.compute_incentive(_session_id, km);

  UPDATE public.duty_sessions SET
    end_time = now(),
    total_km = km,
    total_duration_mins = duration_mins,
    incentive_amount = incentive,
    status = 'completed'
  WHERE id = _session_id;

  RETURN jsonb_build_object(
    'session_id', _session_id,
    'total_km', km,
    'total_duration_mins', duration_mins,
    'incentive_amount', incentive
  );
END;
$$;
