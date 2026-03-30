
-- MULTI-BRANCH / MULTI-GSTIN SUPPORT

-- 1. Branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code text NOT NULL UNIQUE,
  branch_name text NOT NULL,
  gst_number text,
  legal_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  state_code text,
  pincode text,
  phone text,
  email text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  next_order_number integer NOT NULL DEFAULT 1,
  next_invoice_number integer NOT NULL DEFAULT 1,
  next_po_number integer NOT NULL DEFAULT 1,
  next_cn_number integer NOT NULL DEFAULT 1,
  next_dn_number integer NOT NULL DEFAULT 1,
  next_ar_number integer NOT NULL DEFAULT 1,
  next_transfer_number integer NOT NULL DEFAULT 1,
  next_journal_number integer NOT NULL DEFAULT 1,
  next_contra_number integer NOT NULL DEFAULT 1,
  next_receipt_voucher_number integer NOT NULL DEFAULT 1,
  next_payment_voucher_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. User-branch access mapping
CREATE TABLE public.user_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- 3. Inter-branch transfers
CREATE TABLE public.branch_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  from_branch_id uuid NOT NULL REFERENCES public.branches(id),
  to_branch_id uuid NOT NULL REFERENCES public.branches(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric NOT NULL DEFAULT 0,
  cgst_total numeric NOT NULL DEFAULT 0,
  sgst_total numeric NOT NULL DEFAULT 0,
  igst_total numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  sale_invoice_id uuid,
  purchase_invoice_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.branch_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_transfer_id uuid NOT NULL REFERENCES public.branch_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  gst_rate numeric NOT NULL DEFAULT 18,
  hsn_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_transfer_items ENABLE ROW LEVEL SECURITY;

-- 5. Security definer function for branch access
CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_user_id uuid, p_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    has_role(p_user_id, 'admin'::app_role) 
    OR EXISTS (
      SELECT 1 FROM public.user_branches 
      WHERE user_id = p_user_id AND branch_id = p_branch_id
    );
$$;

-- 6. RLS policies for branches
CREATE POLICY "Any authenticated can view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage branches" ON public.branches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. RLS policies for user_branches
CREATE POLICY "Users can view own branch assignments" ON public.user_branches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage user branches" ON public.user_branches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 8. RLS policies for branch_transfers
CREATE POLICY "Any role can view branch transfers" ON public.branch_transfers
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can manage branch transfers" ON public.branch_transfers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Any role can view branch transfer items" ON public.branch_transfer_items
  FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin/sales can manage branch transfer items" ON public.branch_transfer_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

-- 9. Add branch_id to all master + transactional tables
ALTER TABLE public.dealers ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.products ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.suppliers ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.transporters ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.price_levels ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.product_price_levels ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.warehouses ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.orders ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.invoices ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.payments ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.ledger_entries ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.inventory_txn ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.product_batches ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.credit_notes ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.debit_notes ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.purchase_invoices ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.purchase_orders ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.advance_receipts ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.vouchers ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.gstr2b_entries ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.field_orders ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.field_payments ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.stock_transfers ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.supplier_ledger_entries ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.opening_balances ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.bom_headers ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- 10. Seed TG branch
INSERT INTO public.branches (
  branch_code, branch_name, state, state_code, is_default,
  next_order_number, next_invoice_number, next_po_number,
  next_cn_number, next_dn_number, next_ar_number,
  next_transfer_number, next_journal_number, next_contra_number,
  next_receipt_voucher_number, next_payment_voucher_number
)
SELECT 
  'TG', 'Telangana', 'Telangana', '36', true,
  next_order_number, next_invoice_number, next_po_number,
  next_cn_number, next_dn_number, next_ar_number,
  next_transfer_number, next_journal_number, next_contra_number,
  next_receipt_voucher_number, next_payment_voucher_number
FROM public.company_settings LIMIT 1;

-- 11. Seed AP branch
INSERT INTO public.branches (
  branch_code, branch_name, state, state_code, is_default
) VALUES ('AP', 'Andhra Pradesh', 'Andhra Pradesh', '37', false);

-- 12. Set all existing data to TG branch
DO $$
DECLARE
  tg_id uuid;
BEGIN
  SELECT id INTO tg_id FROM public.branches WHERE branch_code = 'TG';
  UPDATE public.dealers SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.products SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.suppliers SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.transporters SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.price_levels SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.warehouses SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.orders SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.invoices SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.payments SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.ledger_entries SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.inventory_txn SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.product_batches SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.credit_notes SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.debit_notes SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.purchase_invoices SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.purchase_orders SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.advance_receipts SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.vouchers SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.gstr2b_entries SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.field_orders SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.field_payments SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.stock_transfers SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.supplier_ledger_entries SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.opening_balances SET branch_id = tg_id WHERE branch_id IS NULL;
  UPDATE public.bom_headers SET branch_id = tg_id WHERE branch_id IS NULL;
END $$;

-- 13. Indexes on branch_id
CREATE INDEX idx_orders_branch ON public.orders(branch_id);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);
CREATE INDEX idx_payments_branch ON public.payments(branch_id);
CREATE INDEX idx_dealers_branch ON public.dealers(branch_id);
CREATE INDEX idx_products_branch ON public.products(branch_id);
CREATE INDEX idx_inventory_txn_branch ON public.inventory_txn(branch_id);
CREATE INDEX idx_ledger_entries_branch ON public.ledger_entries(branch_id);
CREATE INDEX idx_purchase_invoices_branch ON public.purchase_invoices(branch_id);
