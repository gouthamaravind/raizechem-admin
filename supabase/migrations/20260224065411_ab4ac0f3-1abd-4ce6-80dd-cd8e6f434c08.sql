
-- ============================================================
-- 1. payment_allocations table
-- ============================================================
CREATE TABLE public.payment_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  allocated_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view allocations"
  ON public.payment_allocations FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/accounts can insert allocations"
  ON public.payment_allocations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Admin/accounts can delete allocations"
  ON public.payment_allocations FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Indexes
CREATE INDEX idx_payment_allocations_payment ON public.payment_allocations (payment_id);
CREATE INDEX idx_payment_allocations_invoice ON public.payment_allocations (invoice_id);

-- ============================================================
-- 2. Atomic record-payment with FIFO allocation
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_dealer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_tds_rate numeric DEFAULT 0,
  p_tds_amount numeric DEFAULT 0,
  p_tcs_rate numeric DEFAULT 0,
  p_tcs_amount numeric DEFAULT 0,
  p_net_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment_id uuid;
  v_remaining numeric;
  v_inv record;
  v_due numeric;
  v_apply numeric;
  v_allocations jsonb := '[]'::jsonb;
BEGIN
  -- Insert payment
  INSERT INTO public.payments (
    dealer_id, payment_date, amount, payment_mode, reference_number, notes,
    created_by, tds_rate, tds_amount, tcs_rate, tcs_amount, net_amount
  ) VALUES (
    p_dealer_id, p_payment_date, p_amount, p_payment_mode, p_reference_number, p_notes,
    p_created_by, p_tds_rate, p_tds_amount, p_tcs_rate, p_tcs_amount, p_net_amount
  ) RETURNING id INTO v_payment_id;

  -- Ledger entry
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    p_dealer_id, p_payment_date, 'payment', v_payment_id,
    'Payment received (' || p_payment_mode || ')' ||
      CASE WHEN p_reference_number IS NOT NULL THEN ' Ref: ' || p_reference_number ELSE '' END ||
      CASE WHEN p_tds_amount > 0 THEN ' TDS: ₹' || p_tds_amount::text ELSE '' END ||
      CASE WHEN p_tcs_amount > 0 THEN ' TCS: ₹' || p_tcs_amount::text ELSE '' END,
    0, p_amount
  );

  -- FIFO allocation: oldest unpaid invoices first
  v_remaining := p_amount;

  FOR v_inv IN
    SELECT id, invoice_number, total_amount, amount_paid
    FROM public.invoices
    WHERE dealer_id = p_dealer_id
      AND status NOT IN ('void', 'paid')
    ORDER BY invoice_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_due := v_inv.total_amount - v_inv.amount_paid;
    IF v_due <= 0 THEN CONTINUE; END IF;

    v_apply := LEAST(v_remaining, v_due);

    -- Record allocation
    INSERT INTO public.payment_allocations (payment_id, invoice_id, allocated_amount)
    VALUES (v_payment_id, v_inv.id, v_apply);

    -- Update invoice
    UPDATE public.invoices
    SET amount_paid = amount_paid + v_apply,
        status = CASE
          WHEN amount_paid + v_apply >= total_amount THEN 'paid'
          ELSE 'partially_paid'
        END
    WHERE id = v_inv.id;

    v_allocations := v_allocations || jsonb_build_object(
      'invoice_id', v_inv.id,
      'invoice_number', v_inv.invoice_number,
      'allocated', v_apply
    );

    v_remaining := v_remaining - v_apply;
  END LOOP;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'allocations', v_allocations,
    'unallocated', v_remaining
  );
END;
$$;

-- ============================================================
-- 3. Updated void_payment_atomic with exact allocation reversal
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
  v_alloc record;
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

  -- Exact reversal using payment_allocations
  FOR v_alloc IN
    SELECT pa.*, i.total_amount, i.amount_paid
    FROM public.payment_allocations pa
    JOIN public.invoices i ON i.id = pa.invoice_id
    WHERE pa.payment_id = p_payment_id
    FOR UPDATE OF i
  LOOP
    UPDATE public.invoices
    SET amount_paid = GREATEST(0, amount_paid - v_alloc.allocated_amount),
        status = CASE
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) <= 0 THEN 'issued'
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) < total_amount THEN 'partially_paid'
          ELSE status
        END
    WHERE id = v_alloc.invoice_id;
  END LOOP;

  -- Delete allocation records
  DELETE FROM public.payment_allocations WHERE payment_id = p_payment_id;
END;
$$;
