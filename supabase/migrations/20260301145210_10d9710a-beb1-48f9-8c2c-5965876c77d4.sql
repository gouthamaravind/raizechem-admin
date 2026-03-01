
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS prorata_sameday_pct numeric NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS prorata_90day_pct numeric NOT NULL DEFAULT 12;
