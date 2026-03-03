
-- 1. Add pro-rata detail columns to payment_allocations
ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS days_elapsed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prorata_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prorata_discount numeric DEFAULT 0;

-- 2. Replace apply_prorata_credit with linear daily formula: days × 12/90
CREATE OR REPLACE FUNCTION public.apply_prorata_credit(p_payment_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_90day_pct numeric;
  v_alloc record;
  v_inv record;
  v_days integer;
  v_discount_pct numeric;
  v_discount_amt numeric;
  v_total_discount numeric := 0;
  v_payment record;
BEGIN
  -- Get pro rata base rate (12% for 90 days)
  SELECT prorata_90day_pct INTO v_90day_pct
  FROM company_settings LIMIT 1;

  IF v_90day_pct IS NULL OR v_90day_pct <= 0 THEN
    RETURN 0;
  END IF;

  -- Get payment info
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id AND status = 'active';
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Loop through allocations for this payment
  FOR v_alloc IN
    SELECT pa.id, pa.allocated_amount, pa.invoice_id
    FROM payment_allocations pa
    WHERE pa.payment_id = p_payment_id
  LOOP
    SELECT * INTO v_inv FROM invoices WHERE id = v_alloc.invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Calculate days between invoice date and payment date
    v_days := v_payment.payment_date - v_inv.invoice_date;

    -- Cap at 90 days max; no discount for negative or zero days
    IF v_days <= 0 THEN
      v_discount_pct := 0;
    ELSIF v_days >= 90 THEN
      v_discount_pct := v_90day_pct; -- full 12%
    ELSE
      -- Linear daily: days × (12/90)
      v_discount_pct := ROUND(v_days::numeric * v_90day_pct / 90, 4);
    END IF;

    -- Store pro-rata details on the allocation row
    UPDATE payment_allocations
    SET days_elapsed = v_days,
        prorata_rate = v_discount_pct,
        prorata_discount = CASE WHEN v_discount_pct > 0
          THEN ROUND(v_alloc.allocated_amount * v_discount_pct / 100, 2)
          ELSE 0 END
    WHERE id = v_alloc.id;

    IF v_discount_pct > 0 THEN
      v_discount_amt := ROUND(v_alloc.allocated_amount * v_discount_pct / 100, 2);
      v_total_discount := v_total_discount + v_discount_amt;

      -- Insert credit ledger entry
      INSERT INTO ledger_entries (dealer_id, entry_type, entry_date, credit, debit, description, ref_id)
      VALUES (
        v_payment.dealer_id,
        'prorata_credit',
        v_payment.payment_date,
        v_discount_amt,
        0,
        'Pro rata credit ' || v_discount_pct || '% on ' || v_inv.invoice_number || ' (' || v_days || ' days × ' || v_90day_pct || '%/90)',
        v_payment.id
      );

      -- Reduce invoice outstanding
      UPDATE invoices
      SET amount_paid = amount_paid + v_discount_amt,
          updated_at = now()
      WHERE id = v_alloc.invoice_id;
    END IF;
  END LOOP;

  RETURN v_total_discount;
END;
$function$;
