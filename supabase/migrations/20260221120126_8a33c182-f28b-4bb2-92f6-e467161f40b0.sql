
-- =============================================
-- PHASE 2: FINANCIAL YEAR MANAGEMENT
-- =============================================

-- 1. FINANCIAL YEARS TABLE
CREATE TABLE public.financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_code text NOT NULL UNIQUE,          -- e.g. "2025-26"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  closing_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view FYs" ON public.financial_years FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage FYs" ON public.financial_years FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_financial_years_updated_at BEFORE UPDATE ON public.financial_years FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. OPENING BALANCES TABLE
CREATE TABLE public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_id uuid NOT NULL REFERENCES public.financial_years(id),
  entity_type text NOT NULL DEFAULT 'dealer',  -- 'dealer' or 'supplier'
  entity_id uuid NOT NULL,                      -- dealer_id or supplier_id
  opening_debit numeric NOT NULL DEFAULT 0,
  opening_credit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fy_id, entity_type, entity_id)
);

ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view opening balances" ON public.opening_balances FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "Admin can manage opening balances" ON public.opening_balances FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
