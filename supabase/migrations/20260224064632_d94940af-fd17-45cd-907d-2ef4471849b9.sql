
-- ============================================================
-- 1. UNIQUE CONSTRAINTS on document numbers
-- ============================================================
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);
ALTER TABLE public.credit_notes ADD CONSTRAINT credit_notes_number_unique UNIQUE (credit_note_number);
ALTER TABLE public.debit_notes ADD CONSTRAINT debit_notes_number_unique UNIQUE (debit_note_number);

-- ============================================================
-- 2. CHECK CONSTRAINT: prevent negative stock
-- ============================================================
ALTER TABLE public.product_batches ADD CONSTRAINT product_batches_qty_nonneg CHECK (current_qty >= 0);

-- ============================================================
-- 3. INDEXES for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices (invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_dealer ON public.invoices (dealer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON public.invoice_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON public.product_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_dealer ON public.ledger_entries (dealer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON public.ledger_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_product ON public.inventory_txn (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_batch ON public.inventory_txn (batch_id);
CREATE INDEX IF NOT EXISTS idx_payments_dealer ON public.payments (dealer_id);

-- ============================================================
-- 4. ATOMIC INVOICE CREATION FUNCTION
-- ============================================================
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
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_inv_num text;
  v_inv_id uuid;
  v_item jsonb;
  v_batch record;
  v_fy text;
  v_year int;
BEGIN
  -- Lock company_settings row to prevent concurrent invoice number race
  SELECT * INTO v_settings
  FROM public.company_settings
  LIMIT 1
  FOR UPDATE;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Company settings not configured';
  END IF;

  -- Generate financial year code
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int;
  END IF;
  v_fy := v_year::text;

  -- Build invoice number
  v_inv_num := COALESCE(v_settings.invoice_series, 'RC') || '/' || v_fy || '/' || lpad(v_settings.next_invoice_number::text, 3, '0');

  -- Validate and lock all batches first
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_batch
    FROM public.product_batches
    WHERE id = (v_item->>'batch_id')::uuid
    FOR UPDATE;

    IF v_batch IS NULL THEN
      RAISE EXCEPTION 'Batch % not found', v_item->>'batch_id';
    END IF;

    IF v_batch.current_qty < (v_item->>'qty')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for batch % (available: %, requested: %)',
        v_batch.batch_no, v_batch.current_qty, (v_item->>'qty')::numeric;
    END IF;
  END LOOP;

  -- Create invoice
  INSERT INTO public.invoices (
    invoice_number, dealer_id, invoice_date, due_date,
    subtotal, cgst_total, sgst_total, igst_total, total_amount,
    created_by, transport_mode, vehicle_no, dispatch_from, delivery_to, place_of_supply
  ) VALUES (
    v_inv_num, p_dealer_id, p_invoice_date, p_due_date,
    p_subtotal, p_cgst_total, p_sgst_total, p_igst_total, p_total_amount,
    p_created_by, p_transport_mode, p_vehicle_no, p_dispatch_from, p_delivery_to, p_place_of_supply
  ) RETURNING id INTO v_inv_id;

  -- Increment invoice number
  UPDATE public.company_settings
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = v_settings.id;

  -- Insert items, deduct stock, create inventory transactions
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert invoice item
    INSERT INTO public.invoice_items (
      invoice_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_inv_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'batch_id')::uuid,
      v_item->>'hsn_code',
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric,
      (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric,
      (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric,
      (v_item->>'total_amount')::numeric
    );

    -- Deduct batch stock (CHECK constraint will catch negative)
    UPDATE public.product_batches
    SET current_qty = current_qty - (v_item->>'qty')::numeric
    WHERE id = (v_item->>'batch_id')::uuid;

    -- Append-only inventory txn
    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by
    ) VALUES (
      'SALE', 'invoice', v_inv_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'batch_id')::uuid,
      0, (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      p_created_by
    );
  END LOOP;

  -- Create ledger entry
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    p_dealer_id, p_invoice_date, 'invoice', v_inv_id,
    'Invoice ' || v_inv_num, p_total_amount, 0
  );

  RETURN jsonb_build_object(
    'invoice_id', v_inv_id,
    'invoice_number', v_inv_num
  );
END;
$$;

-- ============================================================
-- 5. ATOMIC VOID INVOICE FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_invoice_atomic(
  p_invoice_id uuid,
  p_reason text,
  p_voided_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv record;
  v_item record;
BEGIN
  -- Lock and fetch invoice
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'void' THEN RAISE EXCEPTION 'Invoice already voided'; END IF;

  -- Mark void
  UPDATE public.invoices SET
    status = 'void',
    void_reason = p_reason,
    voided_at = now(),
    voided_by = p_voided_by,
    amount_paid = 0
  WHERE id = p_invoice_id;

  -- Reversing ledger entry
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_inv.dealer_id, CURRENT_DATE, 'void', p_invoice_id,
    'VOID: Invoice ' || v_inv.invoice_number, 0, v_inv.total_amount
  );

  -- Reverse each item's stock
  FOR v_item IN
    SELECT * FROM public.invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    -- Restore batch qty (lock batch row)
    UPDATE public.product_batches
    SET current_qty = current_qty + v_item.qty
    WHERE id = v_item.batch_id;

    -- Reversing inventory txn
    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by, notes
    ) VALUES (
      'ADJUSTMENT', 'void_invoice', p_invoice_id,
      v_item.product_id, v_item.batch_id,
      v_item.qty, 0, v_item.rate, p_voided_by,
      'VOID reversal: Invoice ' || v_inv.invoice_number
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 6. ATOMIC VOID PAYMENT with FIFO reversal
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_payment_atomic(
  p_payment_id uuid,
  p_reason text,
  p_voided_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pmt record;
  v_remaining numeric;
  v_inv record;
  v_apply numeric;
BEGIN
  -- Lock and fetch payment
  SELECT * INTO v_pmt
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_pmt IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pmt.status = 'void' THEN RAISE EXCEPTION 'Payment already voided'; END IF;

  -- Mark void
  UPDATE public.payments SET
    status = 'void',
    void_reason = p_reason,
    voided_at = now(),
    voided_by = p_voided_by
  WHERE id = p_payment_id;

  -- Reversing ledger entry
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_pmt.dealer_id, CURRENT_DATE, 'void', p_payment_id,
    'VOID: Payment ₹' || v_pmt.net_amount::text, v_pmt.net_amount, 0
  );

  -- FIFO reversal: reduce amount_paid on invoices that this payment was applied to.
  -- We reverse from the NEWEST paid invoices first (reverse FIFO).
  v_remaining := v_pmt.net_amount;

  FOR v_inv IN
    SELECT id, amount_paid, total_amount
    FROM public.invoices
    WHERE dealer_id = v_pmt.dealer_id
      AND status != 'void'
      AND amount_paid > 0
    ORDER BY invoice_date DESC, created_at DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := LEAST(v_inv.amount_paid, v_remaining);

    UPDATE public.invoices
    SET amount_paid = amount_paid - v_apply,
        status = CASE
          WHEN amount_paid - v_apply <= 0 THEN 'issued'
          WHEN amount_paid - v_apply < total_amount THEN 'partial'
          ELSE status
        END
    WHERE id = v_inv.id;

    v_remaining := v_remaining - v_apply;
  END LOOP;
END;
$$;
