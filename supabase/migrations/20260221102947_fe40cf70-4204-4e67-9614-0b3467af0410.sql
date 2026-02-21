
-- Update RLS policies for new roles
-- Payments: allow accounts role
DROP POLICY IF EXISTS "Admin/sales can insert payments" ON public.payments;
CREATE POLICY "Admin/sales/accounts can insert payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Ledger: allow accounts role
DROP POLICY IF EXISTS "Any role can insert ledger" ON public.ledger_entries;
CREATE POLICY "Admin/sales/accounts can insert ledger" ON public.ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Inventory txn: allow inventory role
DROP POLICY IF EXISTS "Any role can insert txn" ON public.inventory_txn;
CREATE POLICY "Admin/inventory/warehouse can insert txn" ON public.inventory_txn
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));

-- Product batches: allow inventory role
DROP POLICY IF EXISTS "Any role can insert batches" ON public.product_batches;
CREATE POLICY "Admin/inventory/warehouse can insert batches" ON public.product_batches
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));

DROP POLICY IF EXISTS "Any role can update batches" ON public.product_batches;
CREATE POLICY "Admin/inventory/warehouse can update batches" ON public.product_batches
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'inventory'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));
