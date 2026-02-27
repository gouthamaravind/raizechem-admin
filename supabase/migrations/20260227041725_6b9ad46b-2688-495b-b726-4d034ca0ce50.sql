
CREATE OR REPLACE FUNCTION public.create_po_atomic(
  p_supplier_id uuid,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_po_num text;
  v_po_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_year int;
BEGIN
  -- Lock company_settings to prevent concurrent PO number race
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

  -- Generate PO number
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_po_num := 'PO/' || v_year::text || '/' || lpad(v_settings.next_po_number::text, 3, '0');

  -- Create purchase order
  INSERT INTO public.purchase_orders (
    po_number, supplier_id, total_amount, notes, created_by
  ) VALUES (
    v_po_num, p_supplier_id, v_total, p_notes, p_created_by
  ) RETURNING id INTO v_po_id;

  -- Increment PO number
  UPDATE public.company_settings
  SET next_po_number = next_po_number + 1
  WHERE id = v_settings.id;

  -- Insert PO items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.purchase_order_items (
      purchase_order_id, product_id, qty, rate, amount
    ) VALUES (
      v_po_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'rate')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'purchase_order_id', v_po_id,
    'po_number', v_po_num
  );
END;
$function$;
