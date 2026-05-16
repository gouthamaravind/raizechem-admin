
-- Batch B: Alter RPCs for light/draft vouchers (admin-only)

CREATE OR REPLACE FUNCTION public.alter_order_atomic(
  p_order_id uuid,
  p_dealer_id uuid,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_altered_by uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order record;
  v_item jsonb;
  v_total numeric := 0;
BEGIN
  IF NOT has_role(p_altered_by, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admin can alter orders';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Cannot alter cancelled order'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'qty')::numeric * (v_item->>'rate')::numeric);
  END LOOP;

  UPDATE public.orders SET
    dealer_id = p_dealer_id,
    notes = p_notes,
    total_amount = v_total,
    updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, qty, rate, amount, discount_pct, discount_amount)
    VALUES (
      p_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0)
    );
  END LOOP;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, actor_user_id)
  VALUES ('orders', p_order_id, 'ALTER',
    jsonb_build_object('reason', p_reason, 'total_amount', v_total), p_altered_by);

  RETURN jsonb_build_object('order_id', p_order_id, 'total_amount', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.alter_po_atomic(
  p_po_id uuid,
  p_supplier_id uuid,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_altered_by uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_po record;
  v_item jsonb;
  v_total numeric := 0;
BEGIN
  IF NOT has_role(p_altered_by, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admin can alter purchase orders';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF v_po IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.status = 'cancelled' THEN RAISE EXCEPTION 'Cannot alter cancelled PO'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'qty')::numeric * (v_item->>'rate')::numeric);
  END LOOP;

  UPDATE public.purchase_orders SET
    supplier_id = p_supplier_id,
    notes = p_notes,
    total_amount = v_total,
    updated_at = now()
  WHERE id = p_po_id;

  DELETE FROM public.purchase_order_items WHERE purchase_order_id = p_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.purchase_order_items (purchase_order_id, product_id, qty, rate, amount)
    VALUES (
      p_po_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric
    );
  END LOOP;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, actor_user_id)
  VALUES ('purchase_orders', p_po_id, 'ALTER',
    jsonb_build_object('reason', p_reason, 'total_amount', v_total), p_altered_by);

  RETURN jsonb_build_object('purchase_order_id', p_po_id, 'total_amount', v_total);
END;
$$;
