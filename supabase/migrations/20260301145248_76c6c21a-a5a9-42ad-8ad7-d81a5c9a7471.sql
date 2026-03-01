
CREATE OR REPLACE FUNCTION public.apply_prorata_credit(p_payment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sameday_pct numeric;
  v_90day_pct numeric;
  v_alloc record;
  v_inv record;
  v_days integer;
  v_discount_pct numeric;
  v_discount_amt numeric;
  v_total_discount numeric := 0;
  v_payment record;
BEGIN
  -- Get pro rata settings
  SELECT prorata_sameday_pct, prorata_90day_pct INTO v_sameday_pct, v_90day_pct
  FROM company_settings LIMIT 1;

  IF v_sameday_pct IS NULL AND v_90day_pct IS NULL THEN
    RETURN 0;
  END IF;

  -- Get payment info
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id AND status = 'active';
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Loop through allocations
  FOR v_alloc IN
    SELECT pa.id, pa.allocated_amount, pa.invoice_id
    FROM payment_allocations pa
    WHERE pa.payment_id = p_payment_id
  LOOP
    SELECT * INTO v_inv FROM invoices WHERE id = v_alloc.invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_days := v_payment.payment_date - v_inv.invoice_date;

    IF v_days = 0 AND v_sameday_pct > 0 THEN
      v_discount_pct := v_sameday_pct;
    ELSIF v_days <= 90 AND v_90day_pct > 0 THEN
      v_discount_pct := v_90day_pct;
    ELSE
      v_discount_pct := 0;
    END IF;

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
        'Pro rata credit ' || v_discount_pct || '% on ' || v_inv.invoice_number || ' (paid in ' || v_days || ' days)',
        v_payment.id
      );

      -- Reduce invoice outstanding by updating amount_paid
      UPDATE invoices
      SET amount_paid = amount_paid + v_discount_amt,
          updated_at = now()
      WHERE id = v_alloc.invoice_id;
    END IF;
  END LOOP;

  RETURN v_total_discount;
END;
$$;
