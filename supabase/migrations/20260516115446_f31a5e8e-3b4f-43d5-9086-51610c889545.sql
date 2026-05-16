
-- Waybill status enum
DO $$ BEGIN
  CREATE TYPE public.waybill_status AS ENUM ('pending','generated','cancelled','expired','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence column on branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS next_waybill_number integer NOT NULL DEFAULT 1;

-- Waybills table (master log of all e-way bills issued from any branch, against invoice or branch transfer)
CREATE TABLE IF NOT EXISTS public.waybills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number text NOT NULL UNIQUE,                -- our internal doc no e.g. EWB/TG/2526/0001
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  source_type text NOT NULL CHECK (source_type IN ('invoice','branch_transfer')),
  source_id uuid NOT NULL,
  source_number text NOT NULL,                    -- invoice_number or transfer_number
  ewb_number text,                                -- NIC-issued 12-digit EWB number
  status public.waybill_status NOT NULL DEFAULT 'pending',
  ewb_date timestamptz,
  valid_until timestamptz,
  distance_km integer,
  transport_mode text,
  transport_doc_no text,
  transport_doc_date date,
  vehicle_no text,
  vehicle_type text,
  transporter_name text,
  transporter_gstin text,
  from_gstin text,
  from_state_code text,
  to_gstin text,
  to_state_code text,
  doc_value numeric(14,2) NOT NULL DEFAULT 0,
  taxable_value numeric(14,2) NOT NULL DEFAULT 0,
  cgst_total numeric(14,2) NOT NULL DEFAULT 0,
  sgst_total numeric(14,2) NOT NULL DEFAULT 0,
  igst_total numeric(14,2) NOT NULL DEFAULT 0,
  gsp_request jsonb,
  gsp_response jsonb,
  error_msg text,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id),
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waybills_branch ON public.waybills(branch_id);
CREATE INDEX IF NOT EXISTS idx_waybills_source ON public.waybills(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_waybills_status ON public.waybills(status);
CREATE INDEX IF NOT EXISTS idx_waybills_date ON public.waybills(ewb_date DESC);

ALTER TABLE public.waybills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view waybills"
  ON public.waybills FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/sales/warehouse can manage waybills"
  ON public.waybills FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'sales'::app_role)
    OR has_role(auth.uid(),'warehouse'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'sales'::app_role)
    OR has_role(auth.uid(),'warehouse'::app_role)
  );

CREATE TRIGGER waybills_updated_at
  BEFORE UPDATE ON public.waybills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sequential waybill doc-number RPC: EWB/{branch_code}/{FY}/{NNNN}
CREATE OR REPLACE FUNCTION public.next_waybill_number(p_branch_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
  v_branch_code text;
  v_fy text;
  v_month int := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  IF v_month >= 4 THEN
    v_fy := lpad((v_year % 100)::text, 2, '0') || lpad(((v_year + 1) % 100)::text, 2, '0');
  ELSE
    v_fy := lpad(((v_year - 1) % 100)::text, 2, '0') || lpad((v_year % 100)::text, 2, '0');
  END IF;

  UPDATE public.branches
    SET next_waybill_number = next_waybill_number + 1
    WHERE id = p_branch_id
    RETURNING next_waybill_number - 1, branch_code INTO v_seq, v_branch_code;

  IF v_branch_code IS NULL THEN
    RAISE EXCEPTION 'Branch not found: %', p_branch_id;
  END IF;

  RETURN 'EWB/' || v_branch_code || '/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
END;
$$;

-- Convert branch transfer to a sale invoice on the FROM branch side.
-- Auto-creates a "self-transfer" dealer for the destination branch if missing.
CREATE OR REPLACE FUNCTION public.convert_branch_transfer_to_invoice(p_transfer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bt public.branch_transfers%ROWTYPE;
  v_from public.branches%ROWTYPE;
  v_to public.branches%ROWTYPE;
  v_dealer_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_seq int;
  v_fy text;
  v_month int := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_item RECORD;
  v_intra boolean;
  v_cgst numeric; v_sgst numeric; v_igst numeric; v_total numeric;
BEGIN
  SELECT * INTO v_bt FROM public.branch_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Branch transfer not found'; END IF;
  IF v_bt.status NOT IN ('draft','confirmed') THEN
    RAISE EXCEPTION 'Transfer status % cannot be converted', v_bt.status;
  END IF;
  IF v_bt.sale_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Transfer already converted (invoice %)', v_bt.sale_invoice_id;
  END IF;

  SELECT * INTO v_from FROM public.branches WHERE id = v_bt.from_branch_id;
  SELECT * INTO v_to   FROM public.branches WHERE id = v_bt.to_branch_id;

  -- Find or create self-transfer dealer for receiving branch
  SELECT id INTO v_dealer_id
    FROM public.dealers
    WHERE branch_id = v_to.id
      AND name = v_to.branch_name || ' [Self Transfer]'
    LIMIT 1;

  IF v_dealer_id IS NULL THEN
    INSERT INTO public.dealers (
      name, gst_number, state, state_code, address_line1, city, pincode,
      branch_id, status, division, gst_legal_name
    ) VALUES (
      v_to.branch_name || ' [Self Transfer]',
      v_to.gst_number, v_to.state, v_to.state_code,
      v_to.address_line1, v_to.city, v_to.pincode,
      v_to.id, 'active', 'INTERNAL', v_to.legal_name
    )
    RETURNING id INTO v_dealer_id;
  END IF;

  -- FY-based invoice number using existing column on FROM branch
  IF v_month >= 4 THEN
    v_fy := lpad((v_year % 100)::text,2,'0') || lpad(((v_year+1) % 100)::text,2,'0');
  ELSE
    v_fy := lpad(((v_year-1) % 100)::text,2,'0') || lpad((v_year % 100)::text,2,'0');
  END IF;

  UPDATE public.branches
    SET next_invoice_number = next_invoice_number + 1
    WHERE id = v_from.id
    RETURNING next_invoice_number - 1 INTO v_seq;

  v_invoice_number := 'INV/' || v_from.branch_code || '/' || v_fy || '/' || lpad(v_seq::text,4,'0');

  v_intra := (v_from.state_code = v_to.state_code);

  -- Header
  INSERT INTO public.invoices (
    invoice_number, dealer_id, branch_id, invoice_date,
    subtotal, cgst_total, sgst_total, igst_total, total_amount, status,
    place_of_supply, dispatch_from, delivery_to, notes, created_by
  ) VALUES (
    v_invoice_number, v_dealer_id, v_from.id, CURRENT_DATE,
    v_bt.subtotal, v_bt.cgst_total, v_bt.sgst_total, v_bt.igst_total, v_bt.total_amount, 'issued',
    v_to.state,
    coalesce(v_from.city,'') || ', ' || coalesce(v_from.state,''),
    coalesce(v_to.city,'')   || ', ' || coalesce(v_to.state,''),
    'Auto-generated from Branch Transfer ' || v_bt.transfer_number,
    auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Items
  FOR v_item IN
    SELECT product_id, qty, rate, amount, gst_rate, hsn_code
    FROM public.branch_transfer_items WHERE branch_transfer_id = v_bt.id
  LOOP
    IF v_intra THEN
      v_cgst := round((v_item.amount * v_item.gst_rate / 200.0)::numeric, 2);
      v_sgst := v_cgst;
      v_igst := 0;
    ELSE
      v_cgst := 0; v_sgst := 0;
      v_igst := round((v_item.amount * v_item.gst_rate / 100.0)::numeric, 2);
    END IF;
    v_total := v_item.amount + v_cgst + v_sgst + v_igst;

    INSERT INTO public.invoice_items (
      invoice_id, product_id, qty, rate, amount, gst_rate, hsn_code,
      cgst_amount, sgst_amount, igst_amount, total_amount
    ) VALUES (
      v_invoice_id, v_item.product_id, v_item.qty, v_item.rate, v_item.amount, v_item.gst_rate, v_item.hsn_code,
      v_cgst, v_sgst, v_igst, v_total
    );
  END LOOP;

  -- Link back
  UPDATE public.branch_transfers
    SET sale_invoice_id = v_invoice_id, status = 'invoiced', updated_at = now()
    WHERE id = v_bt.id;

  RETURN v_invoice_id;
END;
$$;
