

# Comprehensive Feature Roadmap: Tally/MyBill Parity

This is a large set of features. Below is a phased implementation plan, built one feature at a time in logical order (dependencies first).

---

## Phase 1: Purchase Module (Foundation -- needed by many other features)

Currently you only have the **sales side**. The purchase module mirrors it for the buy side.

### New Database Tables
- **`suppliers`** -- name, GSTIN, address, state_code, contact, payment terms, status
- **`purchase_orders`** -- supplier_id, po_number, po_date, status, total, items
- **`purchase_order_items`** -- product_id, qty, rate, amount
- **`purchase_invoices`** -- supplier_id, pi_number, pi_date, subtotal, CGST/SGST/IGST totals, total, amount_paid, status
- **`purchase_invoice_items`** -- product_id, batch_id, hsn_code, qty, rate, gst breakup
- **`debit_notes`** + **`debit_note_items`** -- purchase returns (mirrors credit_notes)

### New Pages
- `/masters/suppliers` -- CRUD for suppliers (similar to Dealers page)
- `/purchase/orders` -- Create/manage purchase orders
- `/purchase/invoices` -- Purchase invoices with GST, auto stock-in via batch creation
- `/purchase/returns` -- Debit notes for purchase returns

### Sidebar Update
- Add "Purchase" group with Orders, Invoices, Returns
- Add Suppliers under Masters

### Business Logic
- Purchase invoices auto-create `product_batches` (stock-in) and `inventory_txn` (type: PURCHASE)
- Debit notes reverse stock and create supplier credit ledger entries
- Supplier ledger entries (credit on purchase, debit on payment to supplier)

---

## Phase 2: Financial Year Management

### New Database Table
- **`financial_years`** -- fy_code (e.g. "2025-26"), start_date, end_date, is_active, is_closed, closing_notes

### New Database Table
- **`opening_balances`** -- fy_id, dealer_id/supplier_id, opening_debit, opening_credit (carry-forward balances)

### New Page
- `/settings/financial-years` -- List FYs, create new FY, close current FY
- Year closing process: calculates all dealer/supplier balances and writes them as opening balances for the next FY
- Ledger page updated to show opening balance row at top when filtered by FY

---

## Phase 3: GSTR-1 / GSTR-3B JSON Export

### Updates to GST Summary Page
- Add "Export GSTR-1 JSON" button -- generates JSON in the exact format accepted by the GST portal (B2B, B2CS, HSN, CDNR sections)
- Add "GSTR-3B Summary" tab -- auto-calculates Table 3.1 (outward supplies), Table 3.2 (inter-state), Table 4 (eligible ITC from purchases -- requires Phase 1)
- Export as JSON and Excel

### Technical Details
- Client-side JSON generation from existing invoice/credit note data
- Uses the GSTN JSON schema format
- Purchase data (Phase 1) feeds into ITC (Input Tax Credit) calculations

---

## Phase 4: TDS/TCS Tracking

### New Database Tables
- **`tds_sections`** -- section code (194C, 194H, etc.), description, rate
- **`tds_deductions`** -- payment_id, dealer_id/supplier_id, section, tds_rate, tds_amount, tds_date, challan_no

### Updates
- Payments page: optional TDS deduction field (section + rate + amount auto-calculated)
- Net payment = amount - TDS
- TDS report page: quarterly summary for TDS return filing (26Q format)
- TCS on sales (if applicable): option on invoice to add TCS

---

## Phase 5: Multi-Warehouse / Godown Support

### New Database Tables
- **`warehouses`** -- name, code, address, is_default
- **`stock_transfers`** -- from_warehouse, to_warehouse, transfer_date, status
- **`stock_transfer_items`** -- product_id, batch_id, qty

### Updates
- Add `warehouse_id` column to `product_batches` and `inventory_txn`
- Stock-in, invoices, and purchase invoices select warehouse
- New page: `/inventory/transfers` -- create transfers between warehouses
- Batch stock report filterable by warehouse

---

## Phase 6: Receipt & Payment Vouchers + Bank Reconciliation

### New Database Tables
- **`vouchers`** -- voucher_number, voucher_type (receipt/payment/contra/journal), date, narration, amount
- **`voucher_entries`** -- voucher_id, account_head, debit, credit (double-entry)
- **`bank_statements`** -- upload_id, date, description, debit, credit, balance, matched_voucher_id, status (matched/unmatched)

### New Pages
- `/finance/vouchers` -- Create receipt/payment/journal vouchers
- `/finance/bank-reconciliation` -- Upload bank statement CSV, auto-match with ledger entries, manual match for unmatched items
- BRS (Bank Reconciliation Statement) report

---

## Phase 7: Barcode/QR on Invoices

### Updates to Invoice Print Page
- Generate GST-compliant QR code containing: supplier GSTIN, invoice number, invoice date, total, SGST/CGST/IGST amounts
- Add QR code to invoice print template using a client-side QR library

---

## Phase 8: Bulk Import/Export

### New Page
- `/settings/bulk-import` -- Tabbed interface for Dealers, Products, Suppliers, Opening Stock
- CSV template download for each type
- Upload CSV, validate rows, show preview with errors highlighted
- Confirm to insert valid rows

---

## Phase 9: Audit Trail / Activity Log

### New Database Table
- **`audit_logs`** -- user_id, table_name, record_id, action (INSERT/UPDATE/DELETE), old_values (JSONB), new_values (JSONB), created_at

### Implementation
- Database trigger on key tables (invoices, orders, payments, dealers, products, etc.) that logs changes automatically
- New page: `/settings/audit-log` -- searchable, filterable log viewer

---

## Phase 10: Recurring Invoices

### New Database Table
- **`recurring_invoices`** -- dealer_id, frequency (monthly/quarterly), next_run_date, template_items (JSONB), is_active

### Implementation
- Settings page to create recurring invoice templates
- Scheduled backend function (cron) that auto-generates invoices on next_run_date
- Dashboard shows upcoming recurring invoices

---

## Phase 11: E-Invoice / E-Way Bill API Integration

### Implementation
- Edge function that calls the NIC E-Invoice API (requires GSP credentials)
- Generate IRN (Invoice Reference Number) and signed QR
- E-Way Bill generation via the same API
- Store IRN, signed QR, and acknowledgement number on invoice record
- Requires: GSP API credentials (will need user to provide)

---

## Phase 12: Employee Payroll

### New Database Tables
- **`employees`** -- name, designation, department, date_of_joining, basic_salary, bank_account, PAN, UAN (PF number)
- **`salary_components`** -- name (Basic, HRA, DA, PF, ESI, PT), type (earning/deduction), is_percentage, value
- **`payroll_runs`** -- month, year, status (draft/processed/paid), total_gross, total_deductions, total_net
- **`payslips`** -- payroll_run_id, employee_id, gross, deductions breakdown (JSONB), net_pay, payment_status

### New Pages
- `/hr/employees` -- Employee master CRUD
- `/hr/salary-components` -- Configure salary structure
- `/hr/payroll` -- Monthly payroll processing: select month, auto-calculate all employees, review, approve, mark paid
- `/hr/payslips` -- View/print individual payslips

### Sidebar Update
- Add "HR & Payroll" group

---

## Phase 13: Custom Invoice Templates

### Implementation
- 2-3 built-in templates (Standard, Retail, Export)
- Template selector in Company Settings
- Invoice print page renders based on selected template

---

## Build Order Summary

| Step | Feature | Depends On |
|------|---------|-----------|
| 1 | Purchase Module (suppliers, POs, purchase invoices, debit notes) | -- |
| 2 | Financial Year Management | -- |
| 3 | GSTR-1/3B JSON Export | Step 1 (for ITC) |
| 4 | TDS/TCS Tracking | Step 1 |
| 5 | Multi-Warehouse | -- |
| 6 | Vouchers + Bank Reconciliation | -- |
| 7 | QR Code on Invoices | -- |
| 8 | Bulk Import/Export | Step 1 (suppliers) |
| 9 | Audit Trail | -- |
| 10 | Recurring Invoices | -- |
| 11 | E-Invoice API | User provides GSP credentials |
| 12 | Employee Payroll | -- |
| 13 | Custom Invoice Templates | -- |

I will build these **one at a time**, starting with **Phase 1: Purchase Module** (suppliers + purchase orders + purchase invoices + debit notes).

