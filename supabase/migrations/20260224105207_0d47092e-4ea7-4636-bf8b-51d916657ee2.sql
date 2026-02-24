
-- Price levels (e.g., Dealer, Distributor, Special, Retail)
CREATE TABLE public.price_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view price levels" ON public.price_levels
  FOR SELECT USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can manage price levels" ON public.price_levels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Product prices per level
CREATE TABLE public.product_price_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_level_id uuid NOT NULL REFERENCES public.price_levels(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, price_level_id)
);

ALTER TABLE public.product_price_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any role can view product price levels" ON public.product_price_levels
  FOR SELECT USING (has_any_role(auth.uid()));

CREATE POLICY "Admin/sales can manage product price levels" ON public.product_price_levels
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

-- Add price_level_id to dealers
ALTER TABLE public.dealers ADD COLUMN price_level_id uuid REFERENCES public.price_levels(id);

-- Seed default price levels
INSERT INTO public.price_levels (name, description, is_default, sort_order) VALUES
  ('Retail', 'Standard retail pricing', true, 1),
  ('Dealer', 'Dealer/wholesale pricing', false, 2),
  ('Distributor', 'Distributor bulk pricing', false, 3),
  ('Special', 'Special/VIP customer pricing', false, 4);
