
CREATE TABLE public.gstr2b_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_period text NOT NULL,
  supplier_gstin text NOT NULL,
  supplier_name text,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  invoice_value numeric NOT NULL DEFAULT 0,
  taxable_value numeric NOT NULL DEFAULT 0,
  igst numeric NOT NULL DEFAULT 0,
  cgst numeric NOT NULL DEFAULT 0,
  sgst numeric NOT NULL DEFAULT 0,
  cess numeric NOT NULL DEFAULT 0,
  place_of_supply text,
  reverse_charge boolean NOT NULL DEFAULT false,
  itc_availability text DEFAULT 'Yes',
  doc_type text DEFAULT 'Invoices',
  match_status text NOT NULL DEFAULT 'pending',
  matched_pi_id uuid REFERENCES public.purchase_invoices(id),
  mismatch_reasons jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gstr2b_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounts can manage gstr2b" ON public.gstr2b_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

CREATE POLICY "Any role can view gstr2b" ON public.gstr2b_entries
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE INDEX idx_gstr2b_period ON public.gstr2b_entries(return_period);
CREATE INDEX idx_gstr2b_gstin ON public.gstr2b_entries(supplier_gstin);
