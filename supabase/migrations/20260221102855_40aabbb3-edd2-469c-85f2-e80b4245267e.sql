
-- Step 1: Add new roles to enum and new columns only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inventory';

-- Add e-way bill fields to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS vehicle_no text,
  ADD COLUMN IF NOT EXISTS dispatch_from text,
  ADD COLUMN IF NOT EXISTS delivery_to text,
  ADD COLUMN IF NOT EXISTS place_of_supply text;

-- Add next_invoice_number to company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS next_invoice_number integer NOT NULL DEFAULT 1;
