
-- 1) View: enforce caller's permissions (security_invoker)
ALTER VIEW public.v_attendance_days SET (security_invoker = true);

-- 2) pgmq wrapper functions: pin search_path and revoke from anon/authenticated
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- 3) Remove broad public SELECT (listing) on company-assets bucket.
-- Direct public URLs continue to work via the public object endpoint.
DROP POLICY IF EXISTS "Public can read company assets" ON storage.objects;

-- 4) Restrict audit_logs INSERT to service_role only (was WITH CHECK true)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 5) api_rate_limits has RLS enabled but no policy — add explicit service_role policy
CREATE POLICY "Service role manages rate limits"
ON public.api_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
