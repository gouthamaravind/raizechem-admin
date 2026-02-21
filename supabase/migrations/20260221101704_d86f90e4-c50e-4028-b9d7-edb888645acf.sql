
-- New enums
CREATE TYPE public.inventory_txn_type AS ENUM ('PURCHASE', 'SALE', 'SALE_RETURN', 'ADJUSTMENT');
CREATE TYPE public.order_status AS ENUM ('draft', 'confirmed', 'dispatched', 'delivered', 'cancelled');

-- ALTER dealers: add state_code, payment_terms, shipping address
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS state_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_pincode TEXT;

-- ALTER products: add slug, prices, min_stock
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_price_default NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_alert_qty NUMERIC(12,2) DEFAULT 0;

-- ALTER company_settings: add invoice_series, legal_name
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS invoice_series TEXT DEFAULT 'RC',
  ADD COLUMN IF NOT EXISTS legal_name TEXT;

-- product_batches
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_no TEXT NOT NULL,
  mfg_date DATE,
  exp_date DATE,
  purchase_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, batch_no)
);

-- inventory_txn (append-only ledger)
CREATE TABLE public.inventory_txn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type inventory_txn_type NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  qty_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  qty_out NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status order_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- order_items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoice_items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  hsn_code TEXT,
  qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  cgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_notes
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_note_items
CREATE TABLE public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id),
  hsn_code TEXT,
  qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18,
  cgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ledger_entries
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL,
  ref_id UUID,
  description TEXT,
  debit NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_txn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for all new tables (using existing has_any_role/has_role)

-- product_batches
CREATE POLICY "Any role can view batches" ON public.product_batches FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Any role can insert batches" ON public.product_batches FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Any role can update batches" ON public.product_batches FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid()));

-- inventory_txn (append-only)
CREATE POLICY "Any role can view txn" ON public.inventory_txn FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Any role can insert txn" ON public.inventory_txn FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));

-- orders
CREATE POLICY "Any role can view orders" ON public.orders FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));
CREATE POLICY "Admin/sales can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));
CREATE POLICY "Admin can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- order_items
CREATE POLICY "Any role can view order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can manage order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));
CREATE POLICY "Admin/sales can update order items" ON public.order_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));
CREATE POLICY "Admin/sales can delete order items" ON public.order_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- invoices
CREATE POLICY "Any role can view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));
CREATE POLICY "Admin/sales can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- invoice_items
CREATE POLICY "Any role can view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- credit_notes
CREATE POLICY "Any role can view credit notes" ON public.credit_notes FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert credit notes" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- credit_note_items
CREATE POLICY "Any role can view cn items" ON public.credit_note_items FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert cn items" ON public.credit_note_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- ledger_entries
CREATE POLICY "Any role can view ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Any role can insert ledger" ON public.ledger_entries FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));

-- payments
CREATE POLICY "Any role can view payments" ON public.payments FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- updated_at triggers
CREATE TRIGGER product_batches_updated_at BEFORE UPDATE ON public.product_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
