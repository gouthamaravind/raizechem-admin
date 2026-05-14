
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_ref text,
  requested_by uuid NOT NULL,
  approver_role text NOT NULL DEFAULT 'admin',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requester ON public.approval_requests(requested_by);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Any role can view approvals" ON public.approval_requests;
CREATE POLICY "Any role can view approvals"
  ON public.approval_requests FOR SELECT
  USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Roles can request approvals" ON public.approval_requests;
CREATE POLICY "Roles can request approvals"
  ON public.approval_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sales'::app_role)
      OR public.has_role(auth.uid(), 'accounts'::app_role)
      OR public.has_role(auth.uid(), 'inventory'::app_role)
      OR public.has_role(auth.uid(), 'warehouse'::app_role)
    )
  );

DROP POLICY IF EXISTS "Admin or matching approver can decide" ON public.approval_requests;
CREATE POLICY "Admin or matching approver can decide"
  ON public.approval_requests FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), approver_role::app_role)
  );

DROP TRIGGER IF EXISTS trg_approval_requests_updated ON public.approval_requests;
CREATE TRIGGER trg_approval_requests_updated
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.dealer_visits
  ADD COLUMN IF NOT EXISTS activity_type text NOT NULL DEFAULT 'visit',
  ADD COLUMN IF NOT EXISTS is_photo_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_visit_photo_verified()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_url IS NOT NULL AND NEW.checkout_time IS NOT NULL THEN
    NEW.is_photo_verified := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_photo_verify ON public.dealer_visits;
CREATE TRIGGER trg_visit_photo_verify
  BEFORE INSERT OR UPDATE ON public.dealer_visits
  FOR EACH ROW EXECUTE FUNCTION public.mark_visit_photo_verified();
