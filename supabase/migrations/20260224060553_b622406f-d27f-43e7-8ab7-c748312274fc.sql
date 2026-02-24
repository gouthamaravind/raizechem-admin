-- Add tracking_mode to duty_sessions
ALTER TABLE public.duty_sessions
ADD COLUMN tracking_mode text NOT NULL DEFAULT 'normal';

-- Add comment for documentation
COMMENT ON COLUMN public.duty_sessions.tracking_mode IS 'Location capture frequency: low (5min), normal (3min), high (1min)';