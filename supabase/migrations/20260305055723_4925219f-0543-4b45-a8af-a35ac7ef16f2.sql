-- Add round_off column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0;

-- Also add to purchase_invoices for consistency
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0;

-- Recreate the create_invoice_atomic function with rounding support
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
  p_round_off numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_inv_num text;
  v_inv_id uuid;
  v_item jsonb;
  v_batch record;
  v_fy text;
  v_year int;
  v_rounded_total numeric;
BEGIN
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int;
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
    created_by, transport_mode, vehicle_no, dispatch_from, delivery_to, place_of_supply
  ) VALUES (
    v_inv_num, p_dealer_id, p_invoice_date, p_due_date,
    p_subtotal, p_cgst_total, p_sgst_total, p_igst_total, v_rounded_total, p_round_off,
    p_created_by, p_transport_mode, p_vehicle_no, p_dispatch_from, p_delivery_to, p_place_of_supply
  ) RETURNING id INTO v_inv_id;

  UPDATE public.company_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_inv_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric
    );

    UPDATE public.product_batches SET current_qty = current_qty - (v_item->>'qty')::numeric WHERE id = (v_item->>'batch_id')::uuid;

    INSERT INTO public.inventory_txn (txn_type, ref_type, ref_id, product_id, batch_id, qty_in, qty_out, rate, created_by)
    VALUES ('SALE', 'invoice', v_inv_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid, 0, (v_item->>'qty')::numeric, (v_item->>'rate')::numeric, p_created_by);
  END LOOP;

  INSERT INTO public.ledger_entries (dealer_id, entry_date, entry_type, ref_id, description, debit, credit)
  VALUES (p_dealer_id, p_invoice_date, 'invoice', v_inv_id, 'Invoice ' || v_inv_num, v_rounded_total, 0);

  RETURN jsonb_build_object('invoice_id', v_inv_id, 'invoice_number', v_inv_num);
END;
$$;