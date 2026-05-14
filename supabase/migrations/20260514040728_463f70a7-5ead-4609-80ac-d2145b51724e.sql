
CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  recipient TEXT,
  total_outstanding NUMERIC,
  max_days_overdue INTEGER,
  invoice_count INTEGER,
  tier TEXT,
  triggered_by UUID,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminder_log_dealer ON public.reminder_log(dealer_id, sent_at DESC);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/accounts view reminders" ON public.reminder_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accounts'));

CREATE POLICY "Admins/accounts/sales insert reminders" ON public.reminder_log FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'accounts')
  OR public.has_role(auth.uid(), 'sales')
);
