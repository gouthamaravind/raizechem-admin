ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS credit_block_overdue_days integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS credit_grace_days integer NOT NULL DEFAULT 0;