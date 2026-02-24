
-- =============================================
-- EMPLOYEE MOBILE MODULE — SCHEMA + RLS + FUNCTIONS
-- =============================================

-- 1. employee_profiles
CREATE TABLE public.employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'sales',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_profiles_user ON public.employee_profiles(user_id);
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own profile"
  ON public.employee_profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Admin can manage employee profiles"
  ON public.employee_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_employee_profiles_updated_at
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. incentive_rules (admin-managed lookup)
CREATE TABLE public.incentive_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  per_km_rate numeric NOT NULL DEFAULT 0,
  per_order_bonus numeric NOT NULL DEFAULT 0,
  min_km_threshold numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.incentive_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view incentive rules"
  ON public.incentive_rules FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage incentive rules"
  ON public.incentive_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. duty_sessions
CREATE TABLE public.duty_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  start_location jsonb,  -- {lat, lng}
  end_location jsonb,    -- {lat, lng}
  total_km numeric NOT NULL DEFAULT 0,
  total_duration_mins integer NOT NULL DEFAULT 0,
  incentive_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',  -- active, completed
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_duty_sessions_user ON public.duty_sessions(user_id);
CREATE INDEX idx_duty_sessions_date ON public.duty_sessions(start_time);
ALTER TABLE public.duty_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own sessions"
  ON public.duty_sessions FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Employees can insert own sessions"
  ON public.duty_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employees can update own active sessions"
  ON public.duty_sessions FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4. location_points
CREATE TABLE public.location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_session_id uuid NOT NULL REFERENCES public.duty_sessions(id),
  user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  source text DEFAULT 'gps'  -- gps, network, fused
);
CREATE INDEX idx_location_points_session ON public.location_points(duty_session_id, recorded_at);
CREATE INDEX idx_location_points_user ON public.location_points(user_id);
ALTER TABLE public.location_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own points"
  ON public.location_points FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Employees can insert own points"
  ON public.location_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. dealer_visits
CREATE TABLE public.dealer_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  duty_session_id uuid REFERENCES public.duty_sessions(id),
  checkin_time timestamptz NOT NULL DEFAULT now(),
  checkout_time timestamptz,
  checkin_latlng jsonb,   -- {lat, lng}
  checkout_latlng jsonb,  -- {lat, lng}
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dealer_visits_user ON public.dealer_visits(user_id);
CREATE INDEX idx_dealer_visits_session ON public.dealer_visits(duty_session_id);
ALTER TABLE public.dealer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own visits"
  ON public.dealer_visits FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Employees can insert own visits"
  ON public.dealer_visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employees can update own visits"
  ON public.dealer_visits FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. field_orders
CREATE TABLE public.field_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  duty_session_id uuid REFERENCES public.duty_sessions(id),
  status text NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, converted
  notes text,
  requested_delivery_date date,
  approved_order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_field_orders_user ON public.field_orders(created_by_user_id);
ALTER TABLE public.field_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own field orders"
  ON public.field_orders FOR SELECT
  USING (auth.uid() = created_by_user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Employees can insert own field orders"
  ON public.field_orders FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admin/sales can update field orders"
  ON public.field_orders FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR auth.uid() = created_by_user_id);

CREATE TRIGGER update_field_orders_updated_at
  BEFORE UPDATE ON public.field_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. field_order_items
CREATE TABLE public.field_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_order_id uuid NOT NULL REFERENCES public.field_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL,
  expected_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_field_order_items_order ON public.field_order_items(field_order_id);
ALTER TABLE public.field_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View field order items"
  ON public.field_order_items FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Insert field order items"
  ON public.field_order_items FOR INSERT
  WITH CHECK (has_any_role(auth.uid()));

-- 8. field_payments
CREATE TABLE public.field_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  amount numeric NOT NULL,
  mode text NOT NULL DEFAULT 'cash',  -- cash, upi, cheque, bank_transfer
  reference_no text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  attachment_url text,
  status text NOT NULL DEFAULT 'pending',  -- pending, verified, rejected
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_field_payments_user ON public.field_payments(created_by_user_id);
ALTER TABLE public.field_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own payments"
  ON public.field_payments FOR SELECT
  USING (auth.uid() = created_by_user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Employees can insert own payments"
  ON public.field_payments FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admin/accounts can update field payments"
  ON public.field_payments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- =============================================
-- SQL FUNCTIONS
-- =============================================

-- Calculate total km from location_points using Haversine formula
CREATE OR REPLACE FUNCTION public.compute_session_km(_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_distance numeric := 0;
  prev_lat double precision;
  prev_lng double precision;
  cur record;
BEGIN
  FOR cur IN
    SELECT lat, lng FROM public.location_points
    WHERE duty_session_id = _session_id
    ORDER BY recorded_at ASC
  LOOP
    IF prev_lat IS NOT NULL THEN
      -- Haversine formula
      total_distance := total_distance + (
        6371 * 2 * asin(sqrt(
          power(sin(radians(cur.lat - prev_lat) / 2), 2) +
          cos(radians(prev_lat)) * cos(radians(cur.lat)) *
          power(sin(radians(cur.lng - prev_lng) / 2), 2)
        ))
      );
    END IF;
    prev_lat := cur.lat;
    prev_lng := cur.lng;
  END LOOP;
  RETURN round(total_distance, 2);
END;
$$;

-- Compute incentive using active incentive_rules
CREATE OR REPLACE FUNCTION public.compute_incentive(_session_id uuid, _total_km numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule record;
  order_count integer;
  incentive numeric := 0;
BEGIN
  SELECT * INTO rule FROM public.incentive_rules
  WHERE effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC LIMIT 1;

  IF rule IS NULL THEN RETURN 0; END IF;

  -- KM-based incentive (only if above threshold)
  IF _total_km >= rule.min_km_threshold THEN
    incentive := _total_km * rule.per_km_rate;
  END IF;

  -- Per-order bonus
  SELECT count(*) INTO order_count FROM public.field_orders
  WHERE duty_session_id = _session_id AND status != 'rejected';
  incentive := incentive + (order_count * rule.per_order_bonus);

  RETURN round(incentive, 2);
END;
$$;

-- Finalize duty session: compute km, duration, incentive
CREATE OR REPLACE FUNCTION public.finalize_duty_session(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess record;
  km numeric;
  duration_mins integer;
  incentive numeric;
BEGIN
  SELECT * INTO sess FROM public.duty_sessions WHERE id = _session_id;
  IF sess IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;

  km := public.compute_session_km(_session_id);
  duration_mins := EXTRACT(EPOCH FROM (now() - sess.start_time))::integer / 60;
  incentive := public.compute_incentive(_session_id, km);

  UPDATE public.duty_sessions SET
    end_time = now(),
    total_km = km,
    total_duration_mins = duration_mins,
    incentive_amount = incentive,
    status = 'completed'
  WHERE id = _session_id;

  RETURN jsonb_build_object(
    'session_id', _session_id,
    'total_km', km,
    'total_duration_mins', duration_mins,
    'incentive_amount', incentive
  );
END;
$$;

-- Convert approved field_order into main orders pipeline
CREATE OR REPLACE FUNCTION public.approve_field_order(_field_order_id uuid, _order_number text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fo record;
  new_order_id uuid;
  item record;
  total numeric := 0;
BEGIN
  SELECT * INTO fo FROM public.field_orders WHERE id = _field_order_id;
  IF fo IS NULL THEN RAISE EXCEPTION 'Field order not found'; END IF;
  IF fo.status != 'pending' THEN RAISE EXCEPTION 'Field order is not pending'; END IF;

  -- Calculate total
  SELECT COALESCE(sum(qty * expected_rate), 0) INTO total
  FROM public.field_order_items WHERE field_order_id = _field_order_id;

  -- Create order in main pipeline
  INSERT INTO public.orders (order_number, dealer_id, order_date, total_amount, status, notes, created_by)
  VALUES (_order_number, fo.dealer_id, CURRENT_DATE, total, 'confirmed', 'From field order ' || _field_order_id, fo.created_by_user_id)
  RETURNING id INTO new_order_id;

  -- Copy items
  INSERT INTO public.order_items (order_id, product_id, qty, rate, amount)
  SELECT new_order_id, product_id, qty, expected_rate, qty * expected_rate
  FROM public.field_order_items WHERE field_order_id = _field_order_id;

  -- Update field order
  UPDATE public.field_orders SET status = 'converted', approved_order_id = new_order_id
  WHERE id = _field_order_id;

  RETURN new_order_id;
END;
$$;

-- Attach audit triggers
CREATE TRIGGER audit_employee_profiles AFTER INSERT OR UPDATE OR DELETE ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_duty_sessions AFTER INSERT OR UPDATE OR DELETE ON public.duty_sessions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_field_orders AFTER INSERT OR UPDATE OR DELETE ON public.field_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_field_payments AFTER INSERT OR UPDATE OR DELETE ON public.field_payments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
