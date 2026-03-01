
-- BOM (Bill of Materials) tables
CREATE TABLE public.bom_headers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id),
  bom_name text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bom_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id uuid NOT NULL REFERENCES public.bom_headers(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric NOT NULL DEFAULT 1,
  unit text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for BOM
ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/inventory can manage BOM headers" ON public.bom_headers FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory'));

CREATE POLICY "Any role can view BOM headers" ON public.bom_headers FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/inventory can manage BOM items" ON public.bom_items FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'inventory'));

CREATE POLICY "Any role can view BOM items" ON public.bom_items FOR SELECT
  USING (has_any_role(auth.uid()));

-- Line-level discounts on invoice_items and order_items
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
