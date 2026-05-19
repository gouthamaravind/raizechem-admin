-- Field-order approval columns
ALTER TABLE public.field_orders
  ADD COLUMN IF NOT EXISTS manager_approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

-- RLS: manager can read & update field orders
DROP POLICY IF EXISTS "Managers can view field orders" ON public.field_orders;
CREATE POLICY "Managers can view field orders" ON public.field_orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can update field orders" ON public.field_orders;
CREATE POLICY "Managers can update field orders" ON public.field_orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can view field order items" ON public.field_order_items;
CREATE POLICY "Managers can view field order items" ON public.field_order_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_any_role(auth.uid()));

-- RPC: approve field order -> create sales order
CREATE OR REPLACE FUNCTION public.approve_field_order_atomic(
  p_field_order_id uuid,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fo record;
  v_items jsonb;
  v_result jsonb;
  v_order_id uuid;
BEGIN
  IF NOT (has_role(v_uid, 'manager'::app_role) OR has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_fo FROM public.field_orders WHERE id = p_field_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Field order not found'; END IF;
  IF v_fo.manager_approval_status <> 'pending' THEN
    RAISE EXCEPTION 'Already decided: %', v_fo.manager_approval_status;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'pack_id', pack_id,
    'qty', qty,
    'rate', expected_rate
  )), '[]'::jsonb) INTO v_items
  FROM public.field_order_items WHERE field_order_id = p_field_order_id;

  v_result := public.create_order_atomic(
    p_dealer_id := v_fo.dealer_id,
    p_notes := COALESCE(p_notes, 'Approved from field order ' || p_field_order_id::text),
    p_created_by := v_uid,
    p_items := v_items,
    p_branch_id := v_fo.branch_id
  );
  v_order_id := (v_result->>'order_id')::uuid;

  UPDATE public.field_orders
     SET manager_approval_status = 'approved',
         approved_by = v_uid,
         approved_at = now(),
         approved_order_id = v_order_id,
         status = 'approved'
   WHERE id = p_field_order_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, payload)
  VALUES (v_uid, 'APPROVE', 'field_order', p_field_order_id,
          jsonb_build_object('order_id', v_order_id, 'notes', p_notes));

  RETURN jsonb_build_object('order_id', v_order_id, 'field_order_id', p_field_order_id);
END $$;

CREATE OR REPLACE FUNCTION public.reject_field_order(
  p_field_order_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_uid, 'manager'::app_role) OR has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.field_orders
     SET manager_approval_status = 'rejected',
         approved_by = v_uid,
         approved_at = now(),
         rejected_reason = p_reason,
         status = 'rejected'
   WHERE id = p_field_order_id AND manager_approval_status = 'pending';
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, payload)
  VALUES (v_uid, 'REJECT', 'field_order', p_field_order_id, jsonb_build_object('reason', p_reason));
END $$;