
-- Fix overly permissive RLS on api_rate_limits
-- Only service role (edge functions) should access this table
-- Regular users should have no access
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.api_rate_limits;

-- No policies = only service role can access (RLS is enabled but no policies grant access to anon/authenticated)
