
-- Add division to dealers
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS division text;
CREATE INDEX IF NOT EXISTS idx_dealers_division ON public.dealers(division);

-- Employee division coverage table (mirrors employee_pincodes pattern)
CREATE TABLE IF NOT EXISTS public.employee_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  division text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, division)
);

ALTER TABLE public.employee_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/sales can manage divisions"
  ON public.employee_divisions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Fieldops can read own divisions"
  ON public.employee_divisions FOR SELECT
  USING (has_role(auth.uid(), 'fieldops'::app_role) AND user_id = auth.uid());

CREATE POLICY "Any role can view divisions"
  ON public.employee_divisions FOR SELECT
  USING (has_any_role(auth.uid()));
