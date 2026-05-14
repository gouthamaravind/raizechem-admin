
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS security_deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sd_received_date date,
  ADD COLUMN IF NOT EXISTS sd_mode text,
  ADD COLUMN IF NOT EXISTS sd_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closure_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_notes text;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_closure_status_chk CHECK (closure_status IN ('open','closed'));

CREATE TABLE public.closure_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  closure_date date NOT NULL DEFAULT CURRENT_DATE,
  total_outstanding numeric NOT NULL DEFAULT 0,
  advance_balance numeric NOT NULL DEFAULT 0,
  sd_balance numeric NOT NULL DEFAULT 0,
  prorata_credit numeric NOT NULL DEFAULT 0,
  sd_applied numeric NOT NULL DEFAULT 0,
  net_settlement numeric NOT NULL DEFAULT 0,
  notes text,
  snapshot jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_closure_statements_dealer ON public.closure_statements(dealer_id, closure_date DESC);

ALTER TABLE public.closure_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounts view closure statements" ON public.closure_statements
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounts'));

CREATE POLICY "Admin/accounts insert closure statements" ON public.closure_statements
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounts'));

CREATE OR REPLACE FUNCTION public.close_dealer_atomic(
  p_dealer_id uuid,
  p_closure_date date,
  p_apply_sd boolean,
  p_notes text,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dealer record;
  v_outstanding numeric := 0;
  v_advance numeric := 0;
  v_sd numeric := 0;
  v_sd_apply numeric := 0;
  v_net numeric := 0;
  v_snapshot jsonb;
  v_closure_id uuid;
  v_invoices jsonb;
  v_advances jsonb;
BEGIN
  IF NOT (has_role(p_user_id, 'admin'::app_role) OR has_role(p_user_id, 'accounts'::app_role)) THEN
    RAISE EXCEPTION 'Only admin or accounts users can close a dealership';
  END IF;

  SELECT * INTO v_dealer FROM public.dealers WHERE id = p_dealer_id FOR UPDATE;
  IF v_dealer IS NULL THEN RAISE EXCEPTION 'Dealer not found'; END IF;
  IF v_dealer.closure_status = 'closed' THEN RAISE EXCEPTION 'Dealer already closed'; END IF;

  -- Outstanding from open invoices
  SELECT COALESCE(SUM(total_amount - amount_paid), 0)
    INTO v_outstanding
    FROM public.invoices
   WHERE dealer_id = p_dealer_id AND status NOT IN ('paid', 'void');

  -- Advance balance
  SELECT COALESCE(SUM(balance_amount), 0)
    INTO v_advance
    FROM public.advance_receipts
   WHERE dealer_id = p_dealer_id AND status = 'OPEN';

  v_sd := COALESCE(v_dealer.sd_balance, 0);

  -- Snapshot of open invoices and advances
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'invoice_number', invoice_number,
    'invoice_date', invoice_date,
    'total_amount', total_amount,
    'amount_paid', amount_paid,
    'outstanding', total_amount - amount_paid
  )), '[]'::jsonb) INTO v_invoices
  FROM public.invoices
  WHERE dealer_id = p_dealer_id AND status NOT IN ('paid','void');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'receipt_number', receipt_number,
    'receipt_date', receipt_date,
    'balance_amount', balance_amount
  )), '[]'::jsonb) INTO v_advances
  FROM public.advance_receipts
  WHERE dealer_id = p_dealer_id AND status = 'OPEN';

  -- Apply SD against outstanding (after netting advances)
  IF p_apply_sd THEN
    v_sd_apply := LEAST(v_sd, GREATEST(v_outstanding - v_advance, 0));
  END IF;

  v_net := v_outstanding - v_advance - v_sd_apply;

  -- Post SD adjustment ledger entry if any
  IF v_sd_apply > 0 THEN
    INSERT INTO public.ledger_entries (dealer_id, entry_date, entry_type, ref_id, description, debit, credit)
    VALUES (p_dealer_id, p_closure_date, 'sd_adjust', p_dealer_id,
      'Closure: Security Deposit applied (₹' || v_sd_apply::text || ')', 0, v_sd_apply);

    UPDATE public.dealers SET sd_balance = sd_balance - v_sd_apply WHERE id = p_dealer_id;
  END IF;

  v_snapshot := jsonb_build_object(
    'dealer', jsonb_build_object(
      'id', v_dealer.id, 'name', v_dealer.name, 'gst', v_dealer.gst_number,
      'credit_limit', v_dealer.credit_limit
    ),
    'invoices', v_invoices,
    'advances', v_advances
  );

  INSERT INTO public.closure_statements (
    dealer_id, closure_date, total_outstanding, advance_balance, sd_balance,
    sd_applied, net_settlement, notes, snapshot, created_by
  ) VALUES (
    p_dealer_id, p_closure_date, v_outstanding, v_advance, v_sd,
    v_sd_apply, v_net, p_notes, v_snapshot, p_user_id
  ) RETURNING id INTO v_closure_id;

  -- Freeze dealer
  UPDATE public.dealers SET
    closure_status = 'closed',
    closed_at = now(),
    closure_notes = p_notes,
    status = 'inactive'
  WHERE id = p_dealer_id;

  RETURN jsonb_build_object(
    'closure_id', v_closure_id,
    'total_outstanding', v_outstanding,
    'advance_balance', v_advance,
    'sd_applied', v_sd_apply,
    'net_settlement', v_net
  );
END;
$$;
