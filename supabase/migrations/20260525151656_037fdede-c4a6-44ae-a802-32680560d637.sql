
-- Revoke EXECUTE from anon for ALL SECURITY DEFINER functions in public.
-- Authenticated users retain access (RPCs perform internal role checks).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- Revoke EXECUTE from authenticated for trigger-only functions
DO $$
DECLARE r record;
  trig_funcs text[] := ARRAY[
    'handle_new_user','audit_trigger_func','cleanup_old_rate_limits',
    'update_updated_at','auto_dispatch_order_on_waybill','touch_updated_at',
    'mark_visit_photo_verified'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(trig_funcs)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;
