
-- Add GST verification columns to dealers
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS gst_legal_name text,
  ADD COLUMN IF NOT EXISTS gst_trade_name text,
  ADD COLUMN IF NOT EXISTS gst_status text,
  ADD COLUMN IF NOT EXISTS gst_registration_date date,
  ADD COLUMN IF NOT EXISTS gst_address jsonb,
  ADD COLUMN IF NOT EXISTS gst_last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS gst_verification_source text DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS gst_verification_ref text;

-- Rate limiting table for API calls
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only the system (edge functions via service role) writes to this table
CREATE POLICY "Service role manages rate limits"
  ON public.api_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup old rate limit records (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_rate_limits WHERE called_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_rate_limits
  AFTER INSERT ON public.api_rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_rate_limits();
