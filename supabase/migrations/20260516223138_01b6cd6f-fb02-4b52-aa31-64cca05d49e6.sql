CREATE TABLE public.dealer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, user_id)
);

CREATE INDEX idx_dealer_assignments_user ON public.dealer_assignments(user_id);
CREATE INDEX idx_dealer_assignments_dealer ON public.dealer_assignments(dealer_id);

ALTER TABLE public.dealer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/sales can manage dealer assignments"
  ON public.dealer_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Any role can view dealer assignments"
  ON public.dealer_assignments FOR SELECT
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Fieldops can view own assignments"
  ON public.dealer_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'fieldops'::app_role) AND user_id = auth.uid());