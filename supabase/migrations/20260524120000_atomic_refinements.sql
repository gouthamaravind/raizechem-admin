-- Atomic RPC Refinements & Fiscal Year Logic Fixes

-- 1. Refined create_order_atomic (Fix FY + persist discounts)
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_dealer_id uuid,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_branch_id uuid DEFAULT NULL,
  p_order_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_order_num text;
  v_order_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_fy text;
  v_year int;
  v_branch_id uuid;
BEGIN
  -- Lock company_settings to prevent concurrent order number race
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Company settings not configured';
  END IF;

  v_branch_id := p_branch_id;
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id FROM public.dealers WHERE id = p_dealer_id;
  END IF;

  -- Calculate total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + COALESCE((v_item->>'amount')::numeric, 0);
  END LOOP;

  -- FY calculation (April to March)
  IF EXTRACT(MONTH FROM p_order_date) >= 4 THEN
    v_year := EXTRACT(YEAR FROM p_order_date)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM p_order_date) - 1)::int;
  END IF;
  v_fy := v_year::text;
  
  v_order_num := 'ORD/' || v_fy || '/' || lpad(v_settings.next_order_number::text, 3, '0');

  INSERT INTO public.orders (
    order_number, dealer_id, order_date, total_amount, notes, created_by, branch_id, status
  ) VALUES (
    v_order_num, p_dealer_id, p_order_date, v_total, p_notes, p_created_by, v_branch_id, 'confirmed'
  ) RETURNING id INTO v_order_id;

  UPDATE public.company_settings
  SET next_order_number = next_order_number + 1
  WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, pack_id, qty, rate, amount,
      discount_pct, discount_amount
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'pack_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0)
    );
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_num);
END;
$function$;

-- 2. Refined create_po_atomic (Fix FY + add branch_id)
CREATE OR REPLACE FUNCTION public.create_po_atomic(
  p_supplier_id uuid,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_branch_id uuid DEFAULT NULL,
  p_po_date date DEFAULT CURRENT_DATE
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
  v_fy text;
  v_year int;
BEGIN
  -- Lock company_settings to prevent concurrent PO number race
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Company settings not configured';
  END IF;

  -- Calculate total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + COALESCE((v_item->>'amount')::numeric, 0);
  END LOOP;

  -- FY calculation (April to March)
  IF EXTRACT(MONTH FROM p_po_date) >= 4 THEN
    v_year := EXTRACT(YEAR FROM p_po_date)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM p_po_date) - 1)::int;
  END IF;
  v_fy := v_year::text;
  
  v_po_num := 'PO/' || v_fy || '/' || lpad(v_settings.next_po_number::text, 3, '0');

  INSERT INTO public.purchase_orders (
    po_number, supplier_id, po_date, total_amount, notes, created_by, branch_id, status
  ) VALUES (
    v_po_num, p_supplier_id, p_po_date, v_total, p_notes, p_created_by, p_branch_id, 'pending'
  ) RETURNING id INTO v_po_id;

  UPDATE public.company_settings
  SET next_po_number = next_po_number + 1
  WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.purchase_order_items (
      purchase_order_id, product_id, pack_id, qty, rate, amount
    ) VALUES (
      v_po_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'pack_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('po_id', v_po_id, 'po_number', v_po_num);
END;
$function$;

-- 3. Update create_invoice_atomic to persist discounts
CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_dealer_id uuid,
  p_invoice_date date,
  p_subtotal numeric,
  p_cgst_total numeric,
  p_sgst_total numeric,
  p_igst_total numeric,
  p_total_amount numeric,
  p_created_by uuid,
  p_transport_mode text DEFAULT NULL,
  p_vehicle_no text DEFAULT NULL,
  p_dispatch_from text DEFAULT NULL,
  p_delivery_to text DEFAULT NULL,
  p_place_of_supply text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_round_off numeric DEFAULT 0,
  p_order_id uuid DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings record;
  v_inv_num text;
  v_inv_id uuid;
  v_item jsonb;
  v_batch record;
  v_fy text;
  v_year int;
  v_rounded_total numeric;
  v_branch_id uuid;
BEGIN
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  v_branch_id := p_branch_id;
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id FROM public.dealers WHERE id = p_dealer_id;
  END IF;

  IF EXTRACT(MONTH FROM p_invoice_date) >= 4 THEN
    v_year := EXTRACT(YEAR FROM p_invoice_date)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM p_invoice_date) - 1)::int;
  END IF;
  v_fy := v_year::text;
  v_inv_num := COALESCE(v_settings.invoice_series, 'RC') || '/' || v_fy || '/' || lpad(v_settings.next_invoice_number::text, 3, '0');

  v_rounded_total := p_total_amount + p_round_off;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_batch FROM public.product_batches WHERE id = (v_item->>'batch_id')::uuid FOR UPDATE;
    IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch % not found', v_item->>'batch_id'; END IF;
    IF v_batch.current_qty < (v_item->>'qty')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for batch % (available: %, requested: %)', v_batch.batch_no, v_batch.current_qty, (v_item->>'qty')::numeric;
    END IF;
  END LOOP;

  INSERT INTO public.invoices (
    invoice_number, dealer_id, invoice_date, due_date,
    subtotal, cgst_total, sgst_total, igst_total, total_amount, round_off,
    created_by, transport_mode, vehicle_no, dispatch_from, delivery_to, place_of_supply,
    order_id, branch_id
  ) VALUES (
    v_inv_num, p_dealer_id, p_invoice_date, p_due_date,
    p_subtotal, p_cgst_total, p_sgst_total, p_igst_total, v_rounded_total, p_round_off,
    p_created_by, p_transport_mode, p_vehicle_no, p_dispatch_from, p_delivery_to, p_place_of_supply,
    p_order_id, v_branch_id
  ) RETURNING id INTO v_inv_id;

  UPDATE public.company_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount,
      discount_pct, discount_amount, pack_id
    ) VALUES (
      v_inv_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      (v_item->>'pack_id')::uuid
    );

    UPDATE public.product_batches SET current_qty = current_qty - (v_item->>'qty')::numeric WHERE id = (v_item->>'batch_id')::uuid;

    INSERT INTO public.inventory_txn (txn_type, ref_type, ref_id, product_id, batch_id, qty_in, qty_out, rate, created_by)
    VALUES ('SALE', 'invoice', v_inv_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid, 0, (v_item->>'qty')::numeric, (v_item->>'rate')::numeric, p_created_by);
  END LOOP;

  INSERT INTO public.ledger_entries (dealer_id, entry_date, entry_type, ref_id, description, debit, credit)
  VALUES (p_dealer_id, p_invoice_date, 'invoice', v_inv_id, 'Invoice ' || v_inv_num, v_rounded_total, 0);

  RETURN jsonb_build_object('invoice_id', v_inv_id, 'invoice_number', v_inv_num);
END;
$function$;

-- 4. Update create_purchase_invoice_atomic to persist discounts
CREATE OR REPLACE FUNCTION public.create_purchase_invoice_atomic(
  p_supplier_id uuid,
  p_pi_number text,
  p_pi_date date,
  p_subtotal numeric,
  p_cgst_total numeric,
  p_sgst_total numeric,
  p_igst_total numeric,
  p_total_amount numeric,
  p_created_by uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pi_id uuid;
  v_item jsonb;
  v_batch_id uuid;
BEGIN
  -- Create purchase invoice
  INSERT INTO public.purchase_invoices (
    pi_number, supplier_id, pi_date, subtotal,
    cgst_total, sgst_total, igst_total, total_amount, created_by, branch_id
  ) VALUES (
    p_pi_number, p_supplier_id, p_pi_date, p_subtotal,
    p_cgst_total, p_sgst_total, p_igst_total, p_total_amount, p_created_by, p_branch_id
  ) RETURNING id INTO v_pi_id;

  -- For each item: create batch, insert PI item, create inventory txn
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.product_batches (
      product_id, batch_no, current_qty, purchase_rate,
      mfg_date, exp_date, created_by, branch_id
    ) VALUES (
      (v_item->>'product_id')::uuid,
      COALESCE(NULLIF(v_item->>'batch_no', ''), 'B-' || substr(md5(random()::text), 1, 8)),
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      NULLIF(v_item->>'mfg_date', '')::date,
      NULLIF(v_item->>'exp_date', '')::date,
      p_created_by,
      p_branch_id
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.purchase_invoice_items (
      purchase_invoice_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount,
      discount_pct, discount_amount, pack_id
    ) VALUES (
      v_pi_id, (v_item->>'product_id')::uuid, v_batch_id,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric,
      COALESCE((v_item->>'discount_pct')::numeric, 0),
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      (v_item->>'pack_id')::uuid
    );

    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by
    ) VALUES (
      'PURCHASE', 'purchase_invoice', v_pi_id,
      (v_item->>'product_id')::uuid, v_batch_id,
      (v_item->>'qty')::numeric, 0, (v_item->>'rate')::numeric, p_created_by
    );
  END LOOP;

  -- Supplier ledger entry
  INSERT INTO public.supplier_ledger_entries (
    supplier_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    p_supplier_id, p_pi_date, 'purchase', v_pi_id,
    'Purchase Invoice ' || p_pi_number, 0, p_total_amount
  );

  RETURN jsonb_build_object('purchase_invoice_id', v_pi_id);
END;
$function$;
