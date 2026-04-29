CREATE TABLE IF NOT EXISTS public.employee_pincodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pincode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pincode)
);

ALTER TABLE public.employee_pincodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/sales can manage pincodes" ON public.employee_pincodes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Fieldops can read own pincodes" ON public.employee_pincodes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'fieldops'::app_role) AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_active_duty_locations()
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  full_name text,
  start_time timestamptz,
  total_km numeric,
  last_point jsonb
) SECURITY DEFINER LANGUAGE sql SET search_path = public AS $$
  SELECT ds.id AS session_id,
         ds.user_id,
         COALESCE(p.full_name, ep.name, ds.user_id::text) AS full_name,
         ds.start_time,
         ds.total_km,
         jsonb_build_object(
           'lat', lp.lat,
           'lng', lp.lng,
           'accuracy', lp.accuracy,
           'recorded_at', lp.recorded_at
         ) AS last_point
  FROM duty_sessions ds
  LEFT JOIN LATERAL (
    SELECT lp.lat, lp.lng, lp.accuracy, lp.recorded_at
    FROM location_points lp
    WHERE lp.duty_session_id = ds.id
    ORDER BY lp.recorded_at DESC
    LIMIT 1
  ) lp ON true
  LEFT JOIN profiles p ON p.id = ds.user_id
  LEFT JOIN employee_profiles ep ON ep.user_id = ds.user_id
  WHERE ds.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_recent_visits(p_since timestamptz DEFAULT now() - interval '8 hours')
RETURNS TABLE (
  visit_id uuid,
  dealer_id uuid,
  dealer_name text,
  user_id uuid,
  full_name text,
  checkin jsonb,
  checkout jsonb
) SECURITY DEFINER LANGUAGE sql SET search_path = public AS $$
  SELECT v.id,
         v.dealer_id,
         d.name AS dealer_name,
         v.user_id,
         COALESCE(p.full_name, 'User') AS full_name,
         jsonb_build_object('time', v.checkin_time, 'latlng', v.checkin_latlng) AS checkin,
         jsonb_build_object('time', v.checkout_time, 'latlng', v.checkout_latlng) AS checkout
  FROM dealer_visits v
  LEFT JOIN dealers d ON d.id = v.dealer_id
  LEFT JOIN profiles p ON p.id = v.user_id
  WHERE v.checkin_time >= p_since
  ORDER BY v.checkin_time DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_pincode_assignees(p_pincode text)
RETURNS TABLE (user_id uuid, full_name text, pincode text)
SECURITY DEFINER LANGUAGE sql SET search_path = public AS $$
  SELECT ep.user_id, COALESCE(p.full_name, 'User') AS full_name, ep.pincode
  FROM employee_pincodes ep
  LEFT JOIN profiles p ON p.id = ep.user_id
  WHERE ep.pincode = p_pincode;
$$;
