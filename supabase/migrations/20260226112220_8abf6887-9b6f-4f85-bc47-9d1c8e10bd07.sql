
-- Add next_ar_number to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_ar_number integer NOT NULL DEFAULT 1;

-- Create advance_receipts table
CREATE TABLE public.advance_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id),
  receipt_number text NOT NULL UNIQUE,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text NOT NULL DEFAULT 'bank_transfer',
  reference_number text,
  gross_amount numeric NOT NULL,
  adjusted_amount numeric NOT NULL DEFAULT 0,
  balance_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  notes text,
  created_by uuid,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create advance_allocations table
CREATE TABLE public.advance_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_receipt_id uuid NOT NULL REFERENCES public.advance_receipts(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  allocated_amount numeric NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by uuid
);

-- Constraints
ALTER TABLE public.advance_receipts ADD CONSTRAINT chk_balance_non_negative CHECK (balance_amount >= 0);
ALTER TABLE public.advance_receipts ADD CONSTRAINT chk_adjusted_le_gross CHECK (adjusted_amount <= gross_amount);
ALTER TABLE public.advance_allocations ADD CONSTRAINT chk_alloc_positive CHECK (allocated_amount > 0);

-- Indexes
CREATE INDEX idx_advance_receipts_dealer ON public.advance_receipts(dealer_id);
CREATE INDEX idx_advance_receipts_date ON public.advance_receipts(receipt_date);
CREATE INDEX idx_advance_receipts_status ON public.advance_receipts(status);
CREATE INDEX idx_advance_allocations_invoice ON public.advance_allocations(invoice_id);

-- Enable RLS
ALTER TABLE public.advance_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for advance_receipts
CREATE POLICY "Any role can view advances" ON public.advance_receipts FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/accounts can insert advances" ON public.advance_receipts FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));
CREATE POLICY "Admin/accounts can update advances" ON public.advance_receipts FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- RLS policies for advance_allocations
CREATE POLICY "Any role can view advance allocs" ON public.advance_allocations FOR SELECT USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/accounts can insert advance allocs" ON public.advance_allocations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Audit triggers
CREATE TRIGGER audit_advance_receipts AFTER INSERT OR UPDATE OR DELETE ON public.advance_receipts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_advance_allocations AFTER INSERT OR UPDATE OR DELETE ON public.advance_allocations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ========== FUNCTION: create_advance_receipt_atomic ==========
CREATE OR REPLACE FUNCTION public.create_advance_receipt_atomic(
  p_dealer_id uuid,
  p_receipt_date date,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_settings record;
  v_ar_num text;
  v_ar_id uuid;
  v_fy text;
  v_year int;
BEGIN
  SELECT * INTO v_settings FROM public.company_settings LIMIT 1 FOR UPDATE;
  IF v_settings IS NULL THEN RAISE EXCEPTION 'Company settings not configured'; END IF;

  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  ELSE
    v_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int;
  END IF;
  v_fy := v_year::text;

  v_ar_num := 'AR/' || v_fy || '/' || lpad(v_settings.next_ar_number::text, 3, '0');

  INSERT INTO public.advance_receipts (
    receipt_number, dealer_id, receipt_date, payment_mode, reference_number,
    gross_amount, adjusted_amount, balance_amount, status, notes, created_by
  ) VALUES (
    v_ar_num, p_dealer_id, p_receipt_date, p_payment_mode, p_reference_number,
    p_amount, 0, p_amount, 'OPEN', p_notes, p_created_by
  ) RETURNING id INTO v_ar_id;

  UPDATE public.company_settings SET next_ar_number = next_ar_number + 1 WHERE id = v_settings.id;

  -- Ledger credit entry (advance received from dealer)
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    p_dealer_id, p_receipt_date, 'advance_receipt', v_ar_id,
    'Advance Receipt ' || v_ar_num || ' (' || p_payment_mode || ')' ||
      CASE WHEN p_reference_number IS NOT NULL THEN ' Ref: ' || p_reference_number ELSE '' END,
    0, p_amount
  );

  RETURN jsonb_build_object('advance_receipt_id', v_ar_id, 'receipt_number', v_ar_num);
END;
$$;

-- ========== FUNCTION: allocate_advance_to_invoice_atomic ==========
CREATE OR REPLACE FUNCTION public.allocate_advance_to_invoice_atomic(
  p_invoice_id uuid,
  p_dealer_id uuid,
  p_amount_to_allocate numeric,
  p_allocated_by uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_remaining numeric;
  v_ar record;
  v_apply numeric;
  v_inv record;
  v_allocations jsonb := '[]'::jsonb;
BEGIN
  -- Lock and validate invoice
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.dealer_id != p_dealer_id THEN RAISE EXCEPTION 'Invoice does not belong to this dealer'; END IF;
  IF v_inv.status = 'void' THEN RAISE EXCEPTION 'Cannot allocate to voided invoice'; END IF;

  v_remaining := p_amount_to_allocate;

  -- FIFO: oldest OPEN advances first
  FOR v_ar IN
    SELECT id, receipt_number, balance_amount
    FROM public.advance_receipts
    WHERE dealer_id = p_dealer_id AND status = 'OPEN' AND balance_amount > 0
    ORDER BY receipt_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := LEAST(v_remaining, v_ar.balance_amount);

    INSERT INTO public.advance_allocations (advance_receipt_id, invoice_id, allocated_amount, allocated_by)
    VALUES (v_ar.id, p_invoice_id, v_apply, p_allocated_by);

    UPDATE public.advance_receipts SET
      adjusted_amount = adjusted_amount + v_apply,
      balance_amount = balance_amount - v_apply,
      status = CASE WHEN balance_amount - v_apply <= 0 THEN 'ADJUSTED' ELSE 'OPEN' END
    WHERE id = v_ar.id;

    v_allocations := v_allocations || jsonb_build_object(
      'advance_receipt_id', v_ar.id,
      'receipt_number', v_ar.receipt_number,
      'allocated', v_apply
    );

    v_remaining := v_remaining - v_apply;
  END LOOP;

  -- Update invoice amount_paid
  IF p_amount_to_allocate - v_remaining > 0 THEN
    UPDATE public.invoices SET
      amount_paid = amount_paid + (p_amount_to_allocate - v_remaining),
      status = CASE
        WHEN amount_paid + (p_amount_to_allocate - v_remaining) >= total_amount THEN 'paid'
        ELSE 'partially_paid'
      END
    WHERE id = p_invoice_id;

    -- Ledger debit entry (advance adjusted against invoice)
    INSERT INTO public.ledger_entries (
      dealer_id, entry_date, entry_type, ref_id, description, debit, credit
    ) VALUES (
      p_dealer_id, CURRENT_DATE, 'advance_adjust', p_invoice_id,
      'Advance adjusted against Invoice ' || v_inv.invoice_number ||
        ' (₹' || (p_amount_to_allocate - v_remaining)::text || ')',
      p_amount_to_allocate - v_remaining, 0
    );
  END IF;

  RETURN jsonb_build_object(
    'allocated_total', p_amount_to_allocate - v_remaining,
    'unallocated', v_remaining,
    'allocations', v_allocations
  );
END;
$$;

-- ========== FUNCTION: void_advance_receipt_atomic ==========
CREATE OR REPLACE FUNCTION public.void_advance_receipt_atomic(
  p_receipt_id uuid,
  p_reason text,
  p_voided_by uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ar record;
  v_alloc record;
  v_inv record;
BEGIN
  SELECT * INTO v_ar FROM public.advance_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF v_ar IS NULL THEN RAISE EXCEPTION 'Advance receipt not found'; END IF;
  IF v_ar.status = 'VOID' THEN RAISE EXCEPTION 'Already voided'; END IF;

  -- Reverse any existing allocations
  FOR v_alloc IN
    SELECT * FROM public.advance_allocations WHERE advance_receipt_id = p_receipt_id
  LOOP
    SELECT * INTO v_inv FROM public.invoices WHERE id = v_alloc.invoice_id FOR UPDATE;
    IF v_inv IS NOT NULL AND v_inv.status != 'void' THEN
      UPDATE public.invoices SET
        amount_paid = GREATEST(0, amount_paid - v_alloc.allocated_amount),
        status = CASE
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) <= 0 THEN 'issued'
          WHEN GREATEST(0, amount_paid - v_alloc.allocated_amount) < total_amount THEN 'partially_paid'
          ELSE status
        END
      WHERE id = v_alloc.invoice_id;

      -- Reverse the allocation ledger entry
      INSERT INTO public.ledger_entries (
        dealer_id, entry_date, entry_type, ref_id, description, debit, credit
      ) VALUES (
        v_ar.dealer_id, CURRENT_DATE, 'void', v_alloc.invoice_id,
        'VOID reversal: Advance allocation against Invoice ' || v_inv.invoice_number,
        0, v_alloc.allocated_amount
      );
    END IF;
  END LOOP;

  DELETE FROM public.advance_allocations WHERE advance_receipt_id = p_receipt_id;

  -- Mark void
  UPDATE public.advance_receipts SET
    status = 'VOID',
    adjusted_amount = 0,
    balance_amount = 0,
    void_reason = p_reason,
    voided_at = now(),
    voided_by = p_voided_by
  WHERE id = p_receipt_id;

  -- Reverse original ledger credit
  INSERT INTO public.ledger_entries (
    dealer_id, entry_date, entry_type, ref_id, description, debit, credit
  ) VALUES (
    v_ar.dealer_id, CURRENT_DATE, 'void', p_receipt_id,
    'VOID: Advance Receipt ' || v_ar.receipt_number, v_ar.gross_amount, 0
  );
END;
$$;
