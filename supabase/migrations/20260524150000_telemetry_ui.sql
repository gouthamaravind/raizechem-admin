-- Update get_active_duty_locations to include device info
CREATE OR REPLACE FUNCTION get_active_duty_locations()
RETURNS TABLE (
    session_id UUID,
    user_id UUID,
    full_name TEXT,
    start_time TIMESTAMPTZ,
    total_km NUMERIC,
    last_point JSONB,
    battery_level NUMERIC,
    last_device TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id as session_id,
        ds.user_id,
        COALESCE(p.full_name, ep.name, ds.user_id::text) as full_name,
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
        COALESCE(ds.last_battery, p.last_battery) as battery_level,
        ds.last_device
    FROM duty_sessions ds
    JOIN profiles p ON p.id = ds.user_id
    LEFT JOIN employee_profiles ep ON ep.user_id = ds.user_id
    WHERE ds.status = 'active';
END;
$$;
