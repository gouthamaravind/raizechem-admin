ALTER TABLE public.location_points
ADD COLUMN IF NOT EXISTS battery_level integer;

NOTIFY pgrst, 'reload schema';