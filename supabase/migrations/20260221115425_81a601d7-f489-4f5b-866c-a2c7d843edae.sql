
-- =============================================
-- PHASE 1: PURCHASE MODULE - DATABASE SCHEMA
-- =============================================

-- 1. SUPPLIERS TABLE (mirrors dealers)
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gst_number text,
  state_code text,
  contact_person text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  payment_terms_days integer DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin/inventory can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  po_number text NOT NULL,
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view POs" ON public.purchase_orders FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert POs" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin/inventory can update POs" ON public.purchase_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin can delete POs" ON public.purchase_orders FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. PURCHASE ORDER ITEMS
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view PO items" ON public.purchase_order_items FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert PO items" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin/inventory can update PO items" ON public.purchase_order_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin/inventory can delete PO items" ON public.purchase_order_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));

-- 4. PURCHASE INVOICES
CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  pi_number text NOT NULL,
  pi_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric NOT NULL DEFAULT 0,
  cgst_total numeric NOT NULL DEFAULT 0,
  sgst_total numeric NOT NULL DEFAULT 0,
  igst_total numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view purchase invoices" ON public.purchase_invoices FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert purchase invoices" ON public.purchase_invoices FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
CREATE POLICY "Admin/inventory can update purchase invoices" ON public.purchase_invoices FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));

CREATE TRIGGER set_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. PURCHASE INVOICE ITEMS
CREATE TABLE public.purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid REFERENCES public.product_batches(id),
  hsn_code text,
  qty numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  gst_rate numeric NOT NULL DEFAULT 18,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view PI items" ON public.purchase_invoice_items FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert PI items" ON public.purchase_invoice_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));

-- 6. DEBIT NOTES (purchase returns, mirrors credit_notes)
CREATE TABLE public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  debit_note_number text NOT NULL,
  debit_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  cgst_total numeric NOT NULL DEFAULT 0,
  sgst_total numeric NOT NULL DEFAULT 0,
  igst_total numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view debit notes" ON public.debit_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert debit notes" ON public.debit_notes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));

-- 7. DEBIT NOTE ITEMS
CREATE TABLE public.debit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_id uuid NOT NULL REFERENCES public.debit_notes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid NOT NULL REFERENCES public.product_batches(id),
  hsn_code text,
  qty numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  gst_rate numeric NOT NULL DEFAULT 18,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view DN items" ON public.debit_note_items FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/inventory can insert DN items" ON public.debit_note_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role));
