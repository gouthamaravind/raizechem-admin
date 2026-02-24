# Codebase & UI Audit Report

**Date:** 2026-02-24  
**Project:** Raizechem Admin ERP

---

## 1. Fully Implemented (Production-Ready)

| Module | Status | Notes |
|--------|--------|-------|
| **Authentication** | ✅ | Role-based (admin, sales, accounts, inventory, warehouse, fieldops) via `user_roles` + `has_role()` DB functions |
| **Dashboard** | ✅ | KPI cards, quick actions, recent orders/payments, overdue invoices, top products chart |
| **Dealers (Customers)** | ✅ | Full CRUD, GSTIN validation, state auto-fill, shipping address toggle |
| **Products** | ✅ | Full CRUD, GST preview, HSN validation, category/unit support |
| **Sales Invoices** | ✅ | Atomic creation via `create_invoice_atomic` RPC, batch-wise stock deduction, GST (CGST/SGST/IGST), void with stock reversal |
| **Invoice Printing** | ✅ | 3 templates (standard, thermal, detailed), PDF generation via edge function |
| **Dealer Payments** | ✅ | FIFO allocation, TDS/TCS support, void with reversal, ledger entries |
| **Dealer Ledger** | ✅ | Running balance, debit/credit entries, date filtering |
| **Outstanding** | ✅ | Dealer-wise outstanding with invoice drill-down |
| **Sales Orders** | ✅ | Full CRUD with line items |
| **Purchase Orders** | ✅ | Full CRUD with line items |
| **Purchase Invoices** | ✅ | Creation with batch/stock-in, GST handling |
| **Inventory Batches** | ✅ | Batch tracking, expiry dates, stock quantities |
| **Stock-In** | ✅ | Manual stock adjustments with inventory transactions |
| **Inventory Alerts** | ✅ | Low-stock alerts based on `min_stock_alert_qty` |
| **HR Employees** | ✅ | Full CRUD |
| **Payroll** | ✅ | Run creation, salary component calculation, payslip generation |
| **Salary Components** | ✅ | Earnings/deductions with percentage or fixed amounts |
| **Financial Years** | ✅ | Create, activate, close with notes |
| **Company Settings** | ✅ | Full company profile, bank details, invoice series |
| **User Management** | ✅ | Role assignment via edge function, admin-only |
| **Audit Logs** | ✅ | Action tracking with old/new data |
| **Mobile Field App** | ✅ | Duty sessions, dealer visits (check-in/out with GPS), field orders, field payments |
| **Reports** | ✅ | Sales Register, Purchase Register, GST Summary, GSTR-1/3B JSON export, TDS/TCS, Batch Stock, Outstanding Aging |
| **Export** | ✅ | CSV and Excel (.xlsx) on all report pages |

---

## 2. Incomplete / Scaffolded

### 2.1 Supplier Forms — Missing Validation Parity
- **Issue:** Dealer forms have GSTIN regex validation, state dropdown with auto-fill, pincode validation. Supplier forms lack all of these.
- **Impact:** Inconsistent data quality between dealer and supplier records.
- **Fix:** Port the validation logic from `Dealers.tsx` to `Suppliers.tsx`.

### 2.2 Purchase Invoice Void — Not Atomic
- **Issue:** Voiding a purchase invoice only updates the status field. It does NOT reverse:
  - Inventory transactions (stock-in remains)
  - Batch quantities (remain inflated)
  - Supplier ledger entries (if any)
- **Impact:** Stock and financial data becomes inconsistent after voiding.
- **Fix:** Create a `void_purchase_invoice_atomic` RPC similar to the existing `void_invoice_atomic`.

### 2.3 Credit Note Void — Not Atomic
- **Issue:** Credit note void updates status but doesn't reverse stock returns or ledger adjustments.
- **Impact:** Phantom stock and incorrect dealer balances.
- **Fix:** Create `void_credit_note_atomic` RPC.

### 2.4 Debit Note Void — Not Atomic
- **Issue:** Same as credit notes — status-only update without reversing supplier ledger or stock.
- **Fix:** Create `void_debit_note_atomic` RPC.

### 2.5 Sales Returns (Credit Notes) — Client-Side Logic
- **Issue:** Credit note creation inserts items and updates stock from the client. Race conditions possible under concurrent use.
- **Fix:** Wrap in a server-side RPC with transaction guarantees.

### 2.6 Purchase Returns (Debit Notes) — Client-Side Logic
- **Issue:** Same as sales returns — no atomic server-side transaction.
- **Fix:** Create `create_debit_note_atomic` RPC.

### 2.7 Order/PO Numbering — Timestamp-Based
- **Issue:** Orders use `ORD-{timestamp}` and POs use `PO-{timestamp}` instead of sequential numbering like invoices (`RC-00001`).
- **Impact:** Unprofessional, hard to reference, potential duplicates in high-concurrency.
- **Fix:** Add `next_order_number` and `next_po_number` to `company_settings` and use atomic increment.

---

## 3. Missing Features

### 3.1 No Pagination on Any Listing Page
- **Issue:** All tables use unbounded `.select()` queries. With 1000+ records, performance will degrade significantly. Supabase also has a default 1000-row limit.
- **Impact:** Data loss (rows beyond 1000 silently dropped), slow page loads.
- **Priority:** HIGH
- **Fix:** Add server-side pagination with `.range()` to all listing pages.

### 3.2 No Order → Invoice Conversion
- **Issue:** Orders exist but there's no "Convert to Invoice" workflow. Users must manually re-enter all line items.
- **Impact:** Major UX gap, data re-entry errors.
- **Fix:** Add conversion button that pre-fills invoice form from order data.

### 3.3 No PO → Purchase Invoice Conversion
- **Issue:** Same as above for purchase side.
- **Fix:** Add conversion workflow.

### 3.4 No Line-Level Discounts
- **Issue:** No discount field on invoice items, order items, or purchase items.
- **Impact:** Cannot offer item-specific discounts — common in B2B.
- **Fix:** Add `discount_percent` and `discount_amount` columns to item tables.

### 3.5 No Invoice/Payment Edit
- **Issue:** Only void is supported. If a user makes a small mistake, they must void and recreate.
- **Impact:** Poor UX for corrections.
- **Note:** This is by design for audit integrity but should at least support draft editing before finalization.

### 3.6 No Opening Balance Management UI
- **Issue:** `opening_balances` table exists with RLS policies, but there's no UI to manage it.
- **Impact:** Cannot initialize dealer/supplier balances at FY start.
- **Fix:** Create an Opening Balances page under Settings or Finance.

### 3.7 Supplier Ledger & Outstanding — Incomplete
- **Issue:** `SupplierLedger.tsx` and `SupplierOutstanding.tsx` exist but supplier payment allocation (FIFO) and ledger entry creation may not be wired the same way as dealer payments.
- **Needs verification:** Check if supplier payments create ledger entries and allocations.

### 3.8 No Search/Filter on Most Tables
- **Issue:** Most listing pages lack search bars or column filters.
- **Impact:** Unusable with moderate data volumes.
- **Fix:** Add search inputs and status/date filters to all listing pages.

---

## 4. Technical Debt

| Issue | Location | Severity |
|-------|----------|----------|
| Excessive `as any` casting | Payment allocation, inventory txn, invoice creation | Medium |
| No TypeScript interfaces for query results | Most page components use `(p: any)` | Medium |
| Large monolithic page components | `Invoices.tsx`, `Payments.tsx`, `Dealers.tsx` (300+ lines each) | Low |
| No error boundaries | App-wide — a single component crash shows blank screen | Medium |
| No loading skeletons on most pages | Only Dashboard has skeletons; others show plain "Loading..." text | Low |
| Mobile app has no offline support | Field ops requires connectivity; IndexedDB sync not implemented | Low |

---

## 5. Security Notes

- ✅ All tables have RLS enabled with role-based policies
- ✅ Restrictive policies (not permissive) used throughout
- ✅ Admin-only access for sensitive operations (user management, audit logs, payroll)
- ✅ Atomic RPCs use `SECURITY DEFINER` appropriately
- ⚠️ `profiles` table cannot INSERT — relies on trigger from `auth.users` (correct pattern)
- ⚠️ No rate limiting on edge functions

---

## 6. Recommended Priority Actions

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Add pagination to all listing pages | Prevents data loss & perf issues | Medium |
| 2 | Create atomic void RPCs (purchase invoice, credit/debit notes) | Data integrity | Medium |
| 3 | Add search/filter to all tables | Usability | Medium |
| 4 | Order → Invoice conversion workflow | Major UX improvement | Medium |
| 5 | Supplier form validation parity | Data quality | Low |
| 6 | Opening balance management UI | FY initialization | Low |
| 7 | Sequential order/PO numbering | Professionalism | Low |
| 8 | Error boundaries | Crash resilience | Low |
