
-- Phase 1: BOM pricing + Product Pricing Matrix

-- 1.1 Add pricing fields to BOM items
ALTER TABLE public.bom_items
  ADD COLUMN IF NOT EXISTS purchase_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packing_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheme_1 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheme_2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheme_3 numeric NOT NULL DEFAULT 0;

-- 1.2 BOM header rollup + versioning
ALTER TABLE public.bom_headers
  ADD COLUMN IF NOT EXISTS computed_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 1.3 Per-product pricing matrix (custom slabs per product)
CREATE TABLE IF NOT EXISTS public.product_pricing_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  slab_label text NOT NULL,                -- e.g. "0-1L", "Retail", "Distributor"
  slab_min numeric NOT NULL DEFAULT 0,     -- TO band lower bound (₹)
  slab_max numeric,                        -- nullable = open-ended top
  purchase_price numeric NOT NULL DEFAULT 0,
  packing_price numeric NOT NULL DEFAULT 0,
  scheme_1 numeric NOT NULL DEFAULT 0,
  scheme_2 numeric NOT NULL DEFAULT 0,
  scheme_3 numeric NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 0,   -- margin applied after schemes
  gst_rate numeric NOT NULL DEFAULT 18,
  ex_gst_price numeric NOT NULL DEFAULT 0, -- computed: (cost+margin)
  mrp numeric NOT NULL DEFAULT 0,          -- computed: ex_gst * (1+gst)
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_ppm_product ON public.product_pricing_matrix(product_id);

ALTER TABLE public.product_pricing_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view pricing matrix"
  ON public.product_pricing_matrix FOR SELECT
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/sales/inventory can insert pricing matrix"
  ON public.product_pricing_matrix FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'inventory'::app_role));

CREATE POLICY "Admin/sales/inventory can update pricing matrix"
  ON public.product_pricing_matrix FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'inventory'::app_role));

CREATE POLICY "Admin can delete pricing matrix"
  ON public.product_pricing_matrix FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_ppm_updated_at
  BEFORE UPDATE ON public.product_pricing_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 1.4 Bulk price update RPC (admin/HQ)
CREATE OR REPLACE FUNCTION public.bulk_update_pricing_matrix(p_updates jsonb, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_upd jsonb;
  v_count integer := 0;
BEGIN
  IF NOT has_role(p_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admin can bulk update pricing';
  END IF;

  FOR v_upd IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
    UPDATE public.product_pricing_matrix SET
      purchase_price = COALESCE((v_upd->>'purchase_price')::numeric, purchase_price),
      packing_price  = COALESCE((v_upd->>'packing_price')::numeric, packing_price),
      scheme_1       = COALESCE((v_upd->>'scheme_1')::numeric, scheme_1),
      scheme_2       = COALESCE((v_upd->>'scheme_2')::numeric, scheme_2),
      scheme_3       = COALESCE((v_upd->>'scheme_3')::numeric, scheme_3),
      margin_pct     = COALESCE((v_upd->>'margin_pct')::numeric, margin_pct),
      gst_rate       = COALESCE((v_upd->>'gst_rate')::numeric, gst_rate),
      ex_gst_price   = COALESCE((v_upd->>'ex_gst_price')::numeric, ex_gst_price),
      mrp            = COALESCE((v_upd->>'mrp')::numeric, mrp),
      updated_at     = now()
    WHERE id = (v_upd->>'id')::uuid AND is_locked = false;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('updated_count', v_count);
END;
$$;
