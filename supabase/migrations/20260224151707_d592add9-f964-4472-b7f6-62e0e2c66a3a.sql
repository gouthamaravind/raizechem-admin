
-- Create GST verification logs table
CREATE TABLE public.gst_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gst_no text NOT NULL,
  verified_by uuid REFERENCES auth.users(id),
  status text NOT NULL,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gst_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view GST logs"
ON public.gst_verification_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authorized roles can insert GST logs"
ON public.gst_verification_logs FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'sales'::app_role) OR
  public.has_role(auth.uid(), 'accounts'::app_role)
);
