
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'audit_logs',
    'location_pings',
    'field_payments',
    'field_orders',
    'dealer_visits',
    'duty_sessions',
    'advance_allocations',
    'advance_receipts',
    'payment_allocations',
    'payments',
    'credit_note_items',
    'credit_notes',
    'invoice_items',
    'invoices',
    'order_items',
    'orders',
    'purchase_invoice_items',
    'purchase_invoices',
    'purchase_order_items',
    'purchase_orders',
    'stock_transfer_items',
    'stock_transfers',
    'waybills',
    'voucher_entries',
    'vouchers',
    'ledger_entries',
    'supplier_ledger_entries',
    'inventory_txn',
    'product_batches',
    'product_price_levels',
    'product_pricing_matrix',
    'product_packs',
    'products'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

UPDATE public.company_settings
SET next_invoice_number = 1,
    next_order_number   = 1,
    next_po_number      = 1,
    next_cn_number      = 1,
    next_ar_number      = 1;
