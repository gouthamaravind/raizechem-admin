
-- Create supplier_ledger_entries table (mirrors ledger_entries but for suppliers)
CREATE TABLE public.supplier_ledger_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type text NOT NULL,
  ref_id uuid,
  description text,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies matching dealer ledger pattern
CREATE POLICY "Any role can view supplier ledger"
  ON public.supplier_ledger_entries FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/inventory/accounts can insert supplier ledger"
  ON public.supplier_ledger_entries FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'inventory'::app_role) OR
    has_role(auth.uid(), 'accounts'::app_role)
  );

-- No UPDATE or DELETE (append-only ledger)

-- Attach audit trigger
CREATE TRIGGER audit_supplier_ledger_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Create supplier_opening_balances support: allow entity_type='supplier' in opening_balances (already has entity_type column)

-- Index for performance
CREATE INDEX idx_supplier_ledger_supplier_id ON public.supplier_ledger_entries(supplier_id);
CREATE INDEX idx_supplier_ledger_entry_date ON public.supplier_ledger_entries(entry_date);
