
-- duty_sessions telemetry
ALTER TABLE public.duty_sessions
  ADD COLUMN IF NOT EXISTS start_battery int,
  ADD COLUMN IF NOT EXISTS end_battery int,
  ADD COLUMN IF NOT EXISTS last_battery int,
  ADD COLUMN IF NOT EXISTS start_ip text,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS start_device text,
  ADD COLUMN IF NOT EXISTS last_device text;

-- profiles live status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_on_duty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_battery int,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS last_device text,
  ADD COLUMN IF NOT EXISTS last_location_lat double precision,
  ADD COLUMN IF NOT EXISTS last_location_lng double precision,
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz;

-- Attendance view (IST). Caps each session's contribution to its IST day window.
CREATE OR REPLACE VIEW public.v_attendance_days AS
WITH s AS (
  SELECT
    user_id,
    ((COALESCE(end_time, now())) AT TIME ZONE 'Asia/Kolkata')::date AS ist_date,
    start_time,
    COALESCE(end_time, now()) AS end_time
  FROM public.duty_sessions
)
SELECT
  user_id,
  ist_date,
  ROUND(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0)::numeric, 2) AS total_minutes,
  ROUND((SUM(EXTRACT(EPOCH FROM (end_time - start_time))) / 3600.0)::numeric, 2) AS total_hours,
  (SUM(EXTRACT(EPOCH FROM (end_time - start_time))) >= 7 * 3600) AS is_present
FROM s
GROUP BY user_id, ist_date;

GRANT SELECT ON public.v_attendance_days TO authenticated;
