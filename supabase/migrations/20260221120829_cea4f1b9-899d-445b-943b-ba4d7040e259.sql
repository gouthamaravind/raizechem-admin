
ALTER TABLE public.payments
  ADD COLUMN tds_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN tds_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN tcs_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN tcs_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN net_amount numeric NOT NULL DEFAULT 0;
