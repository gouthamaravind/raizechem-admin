
-- =============================================
-- B) VOID/CANCEL FIELDS on transaction tables
-- =============================================

-- Add void fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- Add void fields to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- Add void fields to credit_notes
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- Add void fields to debit_notes
ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- Add void fields to purchase_invoices
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- =============================================
-- A) AUDIT TRAIL TABLE + TRIGGERS
-- =============================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  actor_user_id uuid,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast querying
CREATE INDEX idx_audit_logs_table ON public.audit_logs (table_name);
CREATE INDEX idx_audit_logs_record ON public.audit_logs (record_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_user_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
CREATE POLICY "Admin can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs (via trigger with security definer)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed on audit logs (immutable)

-- =============================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid;
  _actor_role text;
  _record_id uuid;
BEGIN
  -- Try to get current user
  BEGIN
    _actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    _actor_id := NULL;
  END;

  -- Try to get actor's role
  IF _actor_id IS NOT NULL THEN
    SELECT string_agg(role::text, ',') INTO _actor_role
    FROM public.user_roles WHERE user_id = _actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _record_id := NEW.id;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, actor_user_id, actor_role)
    VALUES (TG_TABLE_NAME, _record_id, 'INSERT', NULL, to_jsonb(NEW), _actor_id, _actor_role);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _record_id := NEW.id;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, actor_user_id, actor_role)
    VALUES (TG_TABLE_NAME, _record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), _actor_id, _actor_role);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    _record_id := OLD.id;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, actor_user_id, actor_role)
    VALUES (TG_TABLE_NAME, _record_id, 'DELETE', to_jsonb(OLD), NULL, _actor_id, _actor_role);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- =============================================
-- ATTACH TRIGGERS TO CRITICAL TABLES
-- =============================================
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_invoice_items
  AFTER INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ledger_entries
  AFTER INSERT OR UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_inventory_txn
  AFTER INSERT OR UPDATE ON public.inventory_txn
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_credit_notes
  AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_credit_note_items
  AFTER INSERT OR UPDATE ON public.credit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_purchase_invoices
  AFTER INSERT OR UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_purchase_invoice_items
  AFTER INSERT OR UPDATE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_debit_notes
  AFTER INSERT OR UPDATE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_product_batches
  AFTER INSERT OR UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_company_settings
  AFTER INSERT OR UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- =============================================
-- UPDATE POLICIES: Allow admin/accounts to update void fields
-- =============================================

-- Payments: add UPDATE policy for voiding
CREATE POLICY "Admin/accounts can update payments"
  ON public.payments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Credit notes: add UPDATE policy for voiding
CREATE POLICY "Admin/accounts can update credit notes"
  ON public.credit_notes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Debit notes: add UPDATE policy for voiding
CREATE POLICY "Admin/accounts can update debit notes"
  ON public.debit_notes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accounts'::app_role));

-- Purchase invoices already has update policy, invoices already has update policy
