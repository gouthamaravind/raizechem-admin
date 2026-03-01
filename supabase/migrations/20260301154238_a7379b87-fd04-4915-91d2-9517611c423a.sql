
-- ============================================================
-- WAREHOUSES / GODOWNS
-- ============================================================
CREATE TABLE public.warehouses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/inventory/warehouse can manage warehouses"
  ON public.warehouses FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'));

CREATE POLICY "Any role can view warehouses"
  ON public.warehouses FOR SELECT
  USING (has_any_role(auth.uid()));

-- ============================================================
-- WAREHOUSE BINS
-- ============================================================
CREATE TABLE public.warehouse_bins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  bin_code text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, bin_code)
);

ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/inventory/warehouse can manage bins"
  ON public.warehouse_bins FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'));

CREATE POLICY "Any role can view bins"
  ON public.warehouse_bins FOR SELECT
  USING (has_any_role(auth.uid()));

-- ============================================================
-- ADD warehouse_id TO product_batches (nullable for existing data)
-- ============================================================
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);
ALTER TABLE public.product_batches ADD COLUMN IF NOT EXISTS bin_id uuid REFERENCES public.warehouse_bins(id);

-- ============================================================
-- STOCK TRANSFERS
-- ============================================================
CREATE TABLE public.stock_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number text NOT NULL UNIQUE,
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  received_by uuid,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/inventory/warehouse can manage transfers"
  ON public.stock_transfers FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'));

CREATE POLICY "Any role can view transfers"
  ON public.stock_transfers FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE TABLE public.stock_transfer_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  batch_id uuid NOT NULL REFERENCES public.product_batches(id),
  qty numeric NOT NULL,
  from_bin_id uuid REFERENCES public.warehouse_bins(id),
  to_bin_id uuid REFERENCES public.warehouse_bins(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/inventory/warehouse can manage transfer items"
  ON public.stock_transfer_items FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory') OR has_role(auth.uid(), 'warehouse'));

CREATE POLICY "Any role can view transfer items"
  ON public.stock_transfer_items FOR SELECT
  USING (has_any_role(auth.uid()));

-- ============================================================
-- LEDGER ACCOUNTS (Chart of Accounts for vouchers)
-- ============================================================
CREATE TABLE public.ledger_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  account_type text NOT NULL DEFAULT 'general',
  parent_type text NOT NULL DEFAULT 'asset',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounts can manage ledger accounts"
  ON public.ledger_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'));

CREATE POLICY "Any role can view ledger accounts"
  ON public.ledger_accounts FOR SELECT
  USING (has_any_role(auth.uid()));

-- Seed default accounts
INSERT INTO public.ledger_accounts (name, code, account_type, parent_type, is_system) VALUES
  ('Cash', 'CASH', 'cash', 'asset', true),
  ('Bank Account', 'BANK', 'bank', 'asset', true),
  ('Sales', 'SALES', 'income', 'income', true),
  ('Purchase', 'PURCHASE', 'expense', 'expense', true),
  ('Sundry Debtors', 'DEBTORS', 'dealer', 'asset', true),
  ('Sundry Creditors', 'CREDITORS', 'supplier', 'liability', true),
  ('Round Off', 'ROUNDOFF', 'general', 'expense', true),
  ('Discount Allowed', 'DISC_ALLOWED', 'general', 'expense', true),
  ('Discount Received', 'DISC_RECEIVED', 'general', 'income', true),
  ('Interest Paid', 'INT_PAID', 'general', 'expense', true),
  ('Interest Received', 'INT_RECEIVED', 'general', 'income', true),
  ('Miscellaneous Expense', 'MISC_EXP', 'general', 'expense', true),
  ('Miscellaneous Income', 'MISC_INC', 'general', 'income', true);

-- ============================================================
-- VOUCHERS
-- ============================================================
CREATE TABLE public.vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_number text NOT NULL UNIQUE,
  voucher_type text NOT NULL,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  narration text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounts can manage vouchers"
  ON public.vouchers FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'));

CREATE POLICY "Any role can view vouchers"
  ON public.vouchers FOR SELECT
  USING (has_any_role(auth.uid()));

-- ============================================================
-- VOUCHER LINES (double-entry debit/credit)
-- ============================================================
CREATE TABLE public.voucher_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  dealer_id uuid REFERENCES public.dealers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  narration text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voucher_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/accounts can manage voucher lines"
  ON public.voucher_lines FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'accounts'));

CREATE POLICY "Any role can view voucher lines"
  ON public.voucher_lines FOR SELECT
  USING (has_any_role(auth.uid()));

-- Add next counters to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_transfer_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_journal_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_contra_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_receipt_voucher_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS next_payment_voucher_number integer NOT NULL DEFAULT 1;

-- Stock transfer execution RPC
CREATE OR REPLACE FUNCTION public.execute_stock_transfer(p_transfer_id uuid, p_action text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transfer record;
  v_item record;
  v_batch record;
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_transfer IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  IF p_action = 'approve' THEN
    IF v_transfer.status != 'draft' THEN RAISE EXCEPTION 'Only draft transfers can be approved'; END IF;
    
    -- Validate stock availability and lock batches
    FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
      SELECT * INTO v_batch FROM product_batches WHERE id = v_item.batch_id FOR UPDATE;
      IF v_batch IS NULL THEN RAISE EXCEPTION 'Batch not found'; END IF;
      IF v_batch.current_qty < v_item.qty THEN
        RAISE EXCEPTION 'Insufficient stock for batch % (available: %, requested: %)',
          v_batch.batch_no, v_batch.current_qty, v_item.qty;
      END IF;
      
      -- Deduct from source
      UPDATE product_batches SET current_qty = current_qty - v_item.qty WHERE id = v_item.batch_id;
      
      -- Inventory txn out
      INSERT INTO inventory_txn (txn_type, ref_type, ref_id, product_id, batch_id, qty_in, qty_out, rate, created_by, notes)
      VALUES ('ADJUSTMENT', 'stock_transfer_out', p_transfer_id, v_item.product_id, v_item.batch_id, 0, v_item.qty, v_batch.purchase_rate, p_user_id,
        'Stock Transfer ' || v_transfer.transfer_number || ' - Out');
    END LOOP;
    
    UPDATE stock_transfers SET status = 'in_transit', approved_by = p_user_id, approved_at = now() WHERE id = p_transfer_id;
    
  ELSIF p_action = 'receive' THEN
    IF v_transfer.status != 'in_transit' THEN RAISE EXCEPTION 'Only in-transit transfers can be received'; END IF;
    
    -- Create new batches at destination warehouse or add qty
    FOR v_item IN 
      SELECT sti.*, pb.batch_no, pb.purchase_rate, pb.mfg_date, pb.exp_date, pb.product_id as bp_product_id
      FROM stock_transfer_items sti
      JOIN product_batches pb ON pb.id = sti.batch_id
      WHERE sti.transfer_id = p_transfer_id
    LOOP
      -- Create a new batch at destination warehouse
      INSERT INTO product_batches (product_id, batch_no, current_qty, purchase_rate, mfg_date, exp_date, warehouse_id, bin_id, created_by)
      VALUES (v_item.product_id, v_item.batch_no || '-T', v_item.qty, v_item.purchase_rate, v_item.mfg_date, v_item.exp_date, 
        v_transfer.to_warehouse_id, v_item.to_bin_id, p_user_id);
      
      -- Inventory txn in
      INSERT INTO inventory_txn (txn_type, ref_type, ref_id, product_id, batch_id, qty_in, qty_out, rate, created_by, notes)
      VALUES ('ADJUSTMENT', 'stock_transfer_in', p_transfer_id, v_item.product_id, v_item.batch_id, v_item.qty, 0, v_item.purchase_rate, p_user_id,
        'Stock Transfer ' || v_transfer.transfer_number || ' - In');
    END LOOP;
    
    UPDATE stock_transfers SET status = 'received', received_by = p_user_id, received_at = now() WHERE id = p_transfer_id;
    
  ELSIF p_action = 'cancel' THEN
    IF v_transfer.status NOT IN ('draft', 'in_transit') THEN RAISE EXCEPTION 'Cannot cancel completed transfer'; END IF;
    
    -- If in transit, restore source stock
    IF v_transfer.status = 'in_transit' THEN
      FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        UPDATE product_batches SET current_qty = current_qty + v_item.qty WHERE id = v_item.batch_id;
        
        INSERT INTO inventory_txn (txn_type, ref_type, ref_id, product_id, batch_id, qty_in, qty_out, rate, created_by, notes)
        VALUES ('ADJUSTMENT', 'stock_transfer_cancel', p_transfer_id, v_item.product_id, v_item.batch_id, v_item.qty, 0, 0, p_user_id,
          'Cancel: Stock Transfer ' || v_transfer.transfer_number);
      END LOOP;
    END IF;
    
    UPDATE stock_transfers SET status = 'cancelled' WHERE id = p_transfer_id;
  END IF;
END;
$$;
