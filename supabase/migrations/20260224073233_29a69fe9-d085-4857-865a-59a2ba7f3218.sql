
-- =====================================================
-- 1. Add sequential numbering columns to company_settings
-- =====================================================
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS next_order_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_po_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_cn_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_dn_number integer NOT NULL DEFAULT 1;

-- =====================================================
-- 2. Add PURCHASE_RETURN to inventory_txn_type enum
-- =====================================================
ALTER TYPE public.inventory_txn_type ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';

-- =====================================================
-- 3. Atomic Credit Note creation (Sales Return)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_credit_note_atomic(
  p_invoice_id uuid,
  p_reason text,
  p_created_by uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_inv record;
  v_cn_num text;
  v_cn_id uuid;
  v_item jsonb;
  v_batch record;
  v_subtotal numeric := 0;
  v_cgst_total numeric := 0;
  v_sgst_total numeric := 0;
  v_igst_total numeric := 0;
  v_total numeric := 0;
  v_fy text;
  v_year int;
BEGIN
  -- Lock company_settings
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  -- Get invoice info
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  -- Generate CN number
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int;
  END IF;
  v_fy := v_year::text;
  v_cn_num := 'CN/' || v_fy || '/' || lpad(v_settings.next_cn_number::text, 3, '0');

  -- Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'amount')::numeric;
    v_cgst_total := v_cgst_total + (v_item->>'cgst_amount')::numeric;
    v_sgst_total := v_sgst_total + (v_item->>'sgst_amount')::numeric;
    v_igst_total := v_igst_total + (v_item->>'igst_amount')::numeric;
  END LOOP;
  v_total := v_subtotal + v_cgst_total + v_sgst_total + v_igst_total;

  -- Validate and lock batches
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_batch FROM public.product_batches WHERE id = (v_item->>'batch_id')::uuid FOR UPDATE;
    IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch not found: %', v_item->>'batch_id'; END IF;
  END LOOP;

  -- Create credit note
  INSERT INTO public.credit_notes (
    credit_note_number, invoice_id, dealer_id, subtotal,
    cgst_total, sgst_total, igst_total, total_amount, reason, created_by
  ) VALUES (
    v_cn_num, p_invoice_id, v_inv.dealer_id, v_subtotal,
    v_cgst_total, v_sgst_total, v_igst_total, v_total, p_reason, p_created_by
  ) RETURNING id INTO v_cn_id;

  -- Increment CN number
  UPDATE public.company_settings SET next_cn_number = next_cn_number + 1 WHERE id = v_settings.id;

  -- Insert items, restore stock, create inventory txns
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.credit_note_items (
      credit_note_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_cn_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric
    );

    -- Restore batch stock
    UPDATE public.product_batches
    SET current_qty = current_qty + (v_item->>'qty')::numeric
    WHERE id = (v_item->>'batch_id')::uuid;

    -- Inventory transaction
    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by
    ) VALUES (
      'SALE_RETURN', 'credit_note', v_cn_id,
      (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      (v_item->>'qty')::numeric, 0, (v_item->>'rate')::numeric, p_created_by
    );
  END LOOP;

  -- Ledger entry (credit to dealer - reduces what they owe)
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_inv.dealer_id, CURRENT_DATE, 'credit_note', v_cn_id,
    'Credit Note ' || v_cn_num, 0, v_total
  );

  RETURN jsonb_build_object('credit_note_id', v_cn_id, 'credit_note_number', v_cn_num);
END;
$$;

-- =====================================================
-- 4. Atomic Debit Note creation (Purchase Return)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_debit_note_atomic(
  p_purchase_invoice_id uuid,
  p_reason text,
  p_created_by uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings record;
  v_pi record;
  v_dn_num text;
  v_dn_id uuid;
  v_item jsonb;
  v_batch record;
  v_subtotal numeric := 0;
  v_cgst_total numeric := 0;
  v_sgst_total numeric := 0;
  v_igst_total numeric := 0;
  v_total numeric := 0;
  v_fy text;
  v_year int;
BEGIN
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  SELECT * INTO v_pi FROM public.purchase_invoices WHERE id = p_purchase_invoice_id;
  IF v_pi IS NULL THEN RAISE EXCEPTION 'Purchase invoice not found'; END IF;

  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int;
  END IF;
  v_fy := v_year::text;
  v_dn_num := 'DN/' || v_fy || '/' || lpad(v_settings.next_dn_number::text, 3, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'amount')::numeric;
    v_cgst_total := v_cgst_total + (v_item->>'cgst_amount')::numeric;
    v_sgst_total := v_sgst_total + (v_item->>'sgst_amount')::numeric;
    v_igst_total := v_igst_total + (v_item->>'igst_amount')::numeric;
  END LOOP;
  v_total := v_subtotal + v_cgst_total + v_sgst_total + v_igst_total;

  -- Lock and validate batches
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_batch FROM public.product_batches WHERE id = (v_item->>'batch_id')::uuid FOR UPDATE;
    IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch not found: %', v_item->>'batch_id'; END IF;
    IF v_batch.current_qty < (v_item->>'qty')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for batch % (available: %, requested: %)',
        v_batch.batch_no, v_batch.current_qty, (v_item->>'qty')::numeric;
    END IF;
  END LOOP;

  INSERT INTO public.debit_notes (
    debit_note_number, purchase_invoice_id, supplier_id, subtotal,
    cgst_total, sgst_total, igst_total, total_amount, reason, created_by
  ) VALUES (
    v_dn_num, p_purchase_invoice_id, v_pi.supplier_id, v_subtotal,
    v_cgst_total, v_sgst_total, v_igst_total, v_total, p_reason, p_created_by
  ) RETURNING id INTO v_dn_id;

  UPDATE public.company_settings SET next_dn_number = next_dn_number + 1 WHERE id = v_settings.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.debit_note_items (
      debit_note_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_dn_id, (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric
    );

    -- Deduct stock (returning goods to supplier)
    UPDATE public.product_batches
    SET current_qty = current_qty - (v_item->>'qty')::numeric
    WHERE id = (v_item->>'batch_id')::uuid;

    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by, notes
    ) VALUES (
      'PURCHASE_RETURN', 'debit_note', v_dn_id,
      (v_item->>'product_id')::uuid, (v_item->>'batch_id')::uuid,
      0, (v_item->>'qty')::numeric, (v_item->>'rate')::numeric, p_created_by,
      'Purchase return - ' || v_dn_num
    );
  END LOOP;

  -- Supplier ledger entry (debit = supplier owes us for return)
  INSERT INTO public.supplier_ledger_entries (
    supplier_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_pi.supplier_id, CURRENT_DATE, 'debit_note', v_dn_id,
    'Debit Note ' || v_dn_num || ' (Purchase Return)', v_total, 0
  );

  RETURN jsonb_build_object('debit_note_id', v_dn_id, 'debit_note_number', v_dn_num);
END;
$$;

-- =====================================================
-- 5. Atomic void for Purchase Invoices
-- =====================================================
CREATE OR REPLACE FUNCTION public.void_purchase_invoice_atomic(
  p_pi_id uuid,
  p_reason text,
  p_voided_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pi record;
  v_item record;
BEGIN
  SELECT * INTO v_pi FROM public.purchase_invoices WHERE id = p_pi_id FOR UPDATE;
  IF v_pi IS NULL THEN RAISE EXCEPTION 'Purchase invoice not found'; END IF;
  IF v_pi.status = 'void' THEN RAISE EXCEPTION 'Already voided'; END IF;

  UPDATE public.purchase_invoices SET
    status = 'void', void_reason = p_reason, voided_at = now(),
    voided_by = p_voided_by, amount_paid = 0
  WHERE id = p_pi_id;

  -- Reversing supplier ledger entry
  INSERT INTO public.supplier_ledger_entries (
    supplier_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_pi.supplier_id, CURRENT_DATE, 'void', p_pi_id,
    'VOID: Purchase Invoice ' || v_pi.pi_number, v_pi.total_amount, 0
  );

  -- Reverse each item's stock
  FOR v_item IN SELECT * FROM public.purchase_invoice_items WHERE purchase_invoice_id = p_pi_id LOOP
    IF v_item.batch_id IS NOT NULL THEN
      UPDATE public.product_batches
      SET current_qty = GREATEST(0, current_qty - v_item.qty)
      WHERE id = v_item.batch_id;

      INSERT INTO public.inventory_txn (
        txn_type, ref_type, ref_id, product_id, batch_id,
        qty_in, qty_out, rate, created_by, notes
      ) VALUES (
        'ADJUSTMENT', 'void_purchase_invoice', p_pi_id,
        v_item.product_id, v_item.batch_id,
        0, v_item.qty, v_item.rate, p_voided_by,
        'VOID reversal: Purchase Invoice ' || v_pi.pi_number
      );
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- 6. Atomic void for Credit Notes
-- =====================================================
CREATE OR REPLACE FUNCTION public.void_credit_note_atomic(
  p_cn_id uuid,
  p_reason text,
  p_voided_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cn record;
  v_item record;
BEGIN
  SELECT * INTO v_cn FROM public.credit_notes WHERE id = p_cn_id FOR UPDATE;
  IF v_cn IS NULL THEN RAISE EXCEPTION 'Credit note not found'; END IF;
  IF v_cn.status = 'void' THEN RAISE EXCEPTION 'Already voided'; END IF;

  UPDATE public.credit_notes SET
    status = 'void', void_reason = p_reason, voided_at = now(), voided_by = p_voided_by
  WHERE id = p_cn_id;

  -- Reversing ledger entry (debit back what was credited)
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_cn.dealer_id, CURRENT_DATE, 'void', p_cn_id,
    'VOID: Credit Note ' || v_cn.credit_note_number, v_cn.total_amount, 0
  );

  -- Reverse stock (take back what was returned)
  FOR v_item IN SELECT * FROM public.credit_note_items WHERE credit_note_id = p_cn_id LOOP
    UPDATE public.product_batches
    SET current_qty = GREATEST(0, current_qty - v_item.qty)
    WHERE id = v_item.batch_id;

    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by, notes
    ) VALUES (
      'ADJUSTMENT', 'void_credit_note', p_cn_id,
      v_item.product_id, v_item.batch_id,
      0, v_item.qty, v_item.rate, p_voided_by,
      'VOID reversal: Credit Note ' || v_cn.credit_note_number
    );
  END LOOP;
END;
$$;

-- =====================================================
-- 7. Atomic void for Debit Notes
-- =====================================================
CREATE OR REPLACE FUNCTION public.void_debit_note_atomic(
  p_dn_id uuid,
  p_reason text,
  p_voided_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dn record;
  v_item record;
BEGIN
  SELECT * INTO v_dn FROM public.debit_notes WHERE id = p_dn_id FOR UPDATE;
  IF v_dn IS NULL THEN RAISE EXCEPTION 'Debit note not found'; END IF;
  IF v_dn.status = 'void' THEN RAISE EXCEPTION 'Already voided'; END IF;

  UPDATE public.debit_notes SET
    status = 'void', void_reason = p_reason, voided_at = now(), voided_by = p_voided_by
  WHERE id = p_dn_id;

  -- Reverse supplier ledger
  INSERT INTO public.supplier_ledger_entries (
    supplier_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_dn.supplier_id, CURRENT_DATE, 'void', p_dn_id,
    'VOID: Debit Note ' || v_dn.debit_note_number, 0, v_dn.total_amount
  );

  -- Restore stock (goods come back from supplier return)
  FOR v_item IN SELECT * FROM public.debit_note_items WHERE debit_note_id = p_dn_id LOOP
    UPDATE public.product_batches
    SET current_qty = current_qty + v_item.qty
    WHERE id = v_item.batch_id;

    INSERT INTO public.inventory_txn (
      txn_type, ref_type, ref_id, product_id, batch_id,
      qty_in, qty_out, rate, created_by, notes
    ) VALUES (
      'ADJUSTMENT', 'void_debit_note', p_dn_id,
      v_item.product_id, v_item.batch_id,
      v_item.qty, 0, v_item.rate, p_voided_by,
      'VOID reversal: Debit Note ' || v_dn.debit_note_number
    );
  END LOOP;
END;
$$;

-- =====================================================
-- 8. Atomic Purchase Invoice creation
-- =====================================================
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
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pi_id uuid;
  v_item jsonb;
  v_batch_id uuid;
BEGIN
  -- Create purchase invoice
  INSERT INTO public.purchase_invoices (
    pi_number, supplier_id, pi_date, subtotal,
    cgst_total, sgst_total, igst_total, total_amount, created_by
  ) VALUES (
    p_pi_number, p_supplier_id, p_pi_date, p_subtotal,
    p_cgst_total, p_sgst_total, p_igst_total, p_total_amount, p_created_by
  ) RETURNING id INTO v_pi_id;

  -- For each item: create batch, insert PI item, create inventory txn
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.product_batches (
      product_id, batch_no, current_qty, purchase_rate,
      mfg_date, exp_date, created_by
    ) VALUES (
      (v_item->>'product_id')::uuid,
      COALESCE(NULLIF(v_item->>'batch_no', ''), 'B-' || substr(md5(random()::text), 1, 8)),
      (v_item->>'qty')::numeric,
      (v_item->>'rate')::numeric,
      NULLIF(v_item->>'mfg_date', '')::date,
      NULLIF(v_item->>'exp_date', '')::date,
      p_created_by
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.purchase_invoice_items (
      purchase_invoice_id, product_id, batch_id, hsn_code, qty, rate, amount,
      gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_pi_id, (v_item->>'product_id')::uuid, v_batch_id,
      v_item->>'hsn_code', (v_item->>'qty')::numeric, (v_item->>'rate')::numeric,
      (v_item->>'amount')::numeric, (v_item->>'gst_rate')::numeric,
      (v_item->>'cgst_amount')::numeric, (v_item->>'sgst_amount')::numeric,
      (v_item->>'igst_amount')::numeric, (v_item->>'total_amount')::numeric
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
$$;

-- =====================================================
-- 9. Atomic Supplier Payment with FIFO allocation
-- =====================================================
CREATE OR REPLACE FUNCTION public.record_supplier_payment_atomic(
  p_supplier_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_mode text,
  p_reference_no text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining numeric;
  v_inv record;
  v_due numeric;
  v_apply numeric;
BEGIN
  -- Supplier ledger entry
  INSERT INTO public.supplier_ledger_entries (
    supplier_id, entry_date, entry_type, description, debit, credit
  ) VALUES (
    p_supplier_id, p_payment_date, 'payment',
    'Payment made (' || p_mode || ')' ||
      CASE WHEN p_reference_no IS NOT NULL THEN ' Ref: ' || p_reference_no ELSE '' END ||
      CASE WHEN p_notes IS NOT NULL THEN ' — ' || p_notes ELSE '' END,
    p_amount, 0
  );

  -- FIFO allocation to oldest unpaid purchase invoices
  v_remaining := p_amount;
  FOR v_inv IN
    SELECT id, total_amount, amount_paid
    FROM public.purchase_invoices
    WHERE supplier_id = p_supplier_id
      AND status NOT IN ('void', 'paid')
    ORDER BY pi_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_due := v_inv.total_amount - v_inv.amount_paid;
    IF v_due <= 0 THEN CONTINUE; END IF;
    v_apply := LEAST(v_remaining, v_due);

    UPDATE public.purchase_invoices
    SET amount_paid = amount_paid + v_apply,
        status = CASE
          WHEN amount_paid + v_apply >= total_amount THEN 'paid'
          ELSE 'partially_paid'
        END
    WHERE id = v_inv.id;

    v_remaining := v_remaining - v_apply;
  END LOOP;

  RETURN jsonb_build_object('unallocated', v_remaining);
END;
$$;
