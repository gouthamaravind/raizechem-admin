
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_dealer_id uuid,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_order_num text;
  v_order_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_year int;
BEGIN
  -- Lock company_settings to prevent concurrent order number race
  SELECT * INTO v_settings
  FROM public.company_settings
  LIMIT 1
  FOR UPDATE;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Company settings not configured';
  END IF;

  -- Calculate total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + ((v_item->>'qty')::numeric * (v_item->>'rate')::numeric);
  END LOOP;

  -- Generate order number using calendar year
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_order_num := 'ORD/' || v_year::text || '/' || lpad(v_settings.next_order_number::text, 3, '0');

  -- Create order
  INSERT INTO public.orders (
    order_number, dealer_id, total_amount, notes, created_by
  ) VALUES (
    v_order_num, p_dealer_id, v_total, p_notes, p_created_by
  ) RETURNING id INTO v_order_id;

  -- Increment order number
  UPDATE public.company_settings
  SET next_order_number = next_order_number + 1
  WHERE id = v_settings.id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, qty, rate, amount
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_num
  );
END;
$$;
