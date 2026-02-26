
-- Create transporters table
CREATE TABLE public.transporters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  gst_number TEXT,
  gst_legal_name TEXT,
  gst_trade_name TEXT,
  gst_status TEXT,
  gst_last_verified_at TIMESTAMPTZ,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  state_code TEXT,
  pincode TEXT,
  vehicle_types TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add preferred_transporter_id to dealers
ALTER TABLE public.dealers ADD COLUMN preferred_transporter_id UUID REFERENCES public.transporters(id);

-- RLS
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage transporters" ON public.transporters
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Any role can view transporters" ON public.transporters
  FOR SELECT USING (has_any_role(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_transporters_updated_at
  BEFORE UPDATE ON public.transporters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
