-- Add battery tracking to location points
ALTER TABLE public.location_points ADD COLUMN IF NOT EXISTS battery_level NUMERIC;

-- Add battery tracking to duty sessions
ALTER TABLE public.duty_sessions ADD COLUMN IF NOT EXISTS start_battery NUMERIC;
ALTER TABLE public.duty_sessions ADD COLUMN IF NOT EXISTS end_battery NUMERIC;

-- Add live status tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_battery NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_location_lat NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_location_lng NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ping_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN DEFAULT false;

-- Update the view for live tracking to include battery
CREATE OR REPLACE FUNCTION get_active_duty_locations()
RETURNS TABLE (
    session_id UUID,
    user_id UUID,
    full_name TEXT,
    start_time TIMESTAMPTZ,
    total_km NUMERIC,
    last_point JSONB,
    battery_level NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id as session_id,
        ds.user_id,
        p.full_name,
        ds.start_time,
        ds.total_km,
        (
            SELECT jsonb_build_object(
                'lat', lp.lat,
                'lng', lp.lng,
                'accuracy', lp.accuracy,
                'recorded_at', lp.recorded_at
            )
            FROM location_points lp
            WHERE lp.duty_session_id = ds.id
            ORDER BY lp.recorded_at DESC
            LIMIT 1
        ) as last_point,
        p.last_battery as battery_level
    FROM duty_sessions ds
    JOIN profiles p ON p.id = ds.user_id
    WHERE ds.status = 'active';
END;
$$;
