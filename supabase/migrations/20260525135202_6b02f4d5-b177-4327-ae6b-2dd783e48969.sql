DROP FUNCTION IF EXISTS public.create_order_atomic(uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.create_order_atomic(uuid, text, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.alter_order_atomic(uuid, uuid, text, jsonb, uuid, text);

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_dealer_id uuid,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_settings record;
  v_order_num text;
  v_order_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_year int;
BEGIN
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'qty')::numeric * (v_item->>'rate')::numeric);
  END LOOP;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_order_num := 'ORD/' || v_year::text || '/' || lpad(v_settings.next_order_number::text, 3, '0');

  INSERT INTO public.orders (order_number, dealer_id, order_date, status, total_amount, notes, created_by, branch_id)
  VALUES (v_order_num, p_dealer_id, CURRENT_DATE, 'draft', v_total, p_notes, p_created_by, p_branch_id)
  RETURNING id INTO v_order_id;

  UPDATE public.company_settings SET next_order_number = next_order_number + 1 WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, pack_id, qty, rate, amount, discount_pct, discount_amount)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      NULLIF(v_item->>'pack_id','')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_num, 'total_amount', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.alter_order_atomic(
  p_order_id uuid,
  p_dealer_id uuid,
  p_notes text,
  p_items jsonb,
  p_altered_by uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item jsonb;
  v_total numeric := 0;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Alter reason is required';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'qty')::numeric * (v_item->>'rate')::numeric);
  END LOOP;

  UPDATE public.orders
  SET dealer_id = p_dealer_id, notes = p_notes, total_amount = v_total, updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, pack_id, qty, rate, amount, discount_pct, discount_amount)
    VALUES (
      p_order_id,
      (v_item->>'product_id')::uuid,
      NULLIF(v_item->>'pack_id','')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0)
    );
  END LOOP;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, actor_user_id)
  VALUES ('orders', p_order_id, 'ALTER', jsonb_build_object('reason', p_reason, 'total_amount', v_total), p_altered_by);

  RETURN jsonb_build_object('order_id', p_order_id, 'total_amount', v_total);
END;
$function$;