
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;

CREATE TABLE IF NOT EXISTS public.product_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pack_label text NOT NULL,
  units_per_case numeric NOT NULL DEFAULT 1,
  unit_size numeric,
  unit_uom text,
  purchase_price numeric NOT NULL DEFAULT 0,
  packing_cost numeric NOT NULL DEFAULT 0,
  price_finished_goods numeric NOT NULL DEFAULT 0,
  scheme_1 numeric NOT NULL DEFAULT 0,
  scheme_2 numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  basic_price numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  price_inclusive_gst numeric NOT NULL DEFAULT 0,
  mrp numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, pack_label)
);

CREATE INDEX IF NOT EXISTS idx_product_packs_product ON public.product_packs(product_id);

ALTER TABLE public.product_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view product packs"
  ON public.product_packs FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/sales/inventory can manage product packs"
  ON public.product_packs FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'inventory'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'inventory'::app_role));

CREATE TRIGGER trg_product_packs_updated
  BEFORE UPDATE ON public.product_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.invoice_items          ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.order_items            ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.purchase_order_items   ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.purchase_invoice_items ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.credit_note_items      ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.debit_note_items       ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.branch_transfer_items  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);
ALTER TABLE public.field_order_items      ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.product_packs(id);

INSERT INTO public.product_packs (product_id, pack_label, units_per_case, basic_price, gst_amount, price_inclusive_gst, mrp, sort_order)
SELECT
  p.id, 'Default', 1,
  COALESCE(p.sale_price, 0),
  ROUND(COALESCE(p.sale_price, 0) * COALESCE(p.gst_rate, 18) / 100, 2),
  ROUND(COALESCE(p.sale_price, 0) * (1 + COALESCE(p.gst_rate, 18) / 100), 2),
  COALESCE(p.sale_price, 0), 0
FROM public.products p
WHERE NOT EXISTS (SELECT 1 FROM public.product_packs pk WHERE pk.product_id = p.id);
