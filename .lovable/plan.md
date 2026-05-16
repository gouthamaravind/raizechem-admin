## Goal

Add Tally-style **Create** + **Alter** across every master, voucher and config screen. Admin-only Alter. For posted vouchers, Alter performs an atomic reverse-and-replay so ledger, stock and allocations stay correct (full Tally behavior).

## Approach

### 1. Shared UI primitives (build once, reuse everywhere)

- `TallyActions` toolbar component → renders `Create` button (role-checked) + optional `Alter` icon per row (admin-only via `useAuth().isAdmin`).
- `EntityFormDialog` wrapper → standard Create/Alter dialog shell with title, submit/cancel, pending state, toast.
- `useAlterGuard` hook → confirms destructive alters with a typed reason ("Why are you altering INV/2025/042?") that gets written into `audit_logs.new_data.alter_reason`.

### 2. Masters — straight upsert pattern (low risk)

For each: add Create dialog (already exists in most) + Alter dialog (admin) that updates the row in place. Audit trigger already captures diffs.

- Dealers, Suppliers, Products, Transporters, Price Levels, Warehouses, Bins, Employees, BOM, Branches, Financial Years, Company Settings, Chart of Accounts, Pricing Matrix rows.

### 3. Vouchers — atomic alter RPCs (high risk, needs migrations)

For every posted voucher type, add `alter_*_atomic(p_id, p_new_payload, p_altered_by, p_reason)` RPC that inside a single transaction:

1. Calls the existing `void_*_atomic` logic (reverses ledger, restores stock, deletes allocations) **but keeps the original row + document number**.
2. Re-applies the new payload using the same logic as `create_*_atomic` (re-deducts stock, re-posts ledger, re-creates items).
3. Writes an `audit_logs` entry tagged `action='ALTER'` with old/new payloads and the alter reason.

RPCs to add:
- `alter_invoice_atomic`
- `alter_purchase_invoice_atomic`
- `alter_credit_note_atomic`
- `alter_debit_note_atomic`
- `alter_payment_atomic`
- `alter_advance_receipt_atomic`
- `alter_order_atomic`, `alter_po_atomic` (simpler — no ledger)
- `alter_branch_transfer_atomic`
- `alter_stock_transfer_atomic` (only when status='draft' to avoid cross-warehouse re-shuffle)
- `alter_voucher_atomic` (journal/contra/receipt/payment voucher — re-validates Dr=Cr)

Guards inside each RPC:
- `IF NOT has_role(p_altered_by, 'admin') THEN RAISE EXCEPTION 'Admin only'`
- Block if the document's financial year is closed (`financial_years.is_closed`).
- Block alter on voided documents.
- For invoices with payment allocations: reject alter unless caller passes `p_force=true`, and on force, unallocate payments first and surface unallocated balance.

### 4. Page-level wiring

Each list page gets:
- Replace "New X" button with `Create` (same behaviour, renamed for consistency).
- Add `Alter` action in the row menu (admin only). Clicking it opens the same form as Create but pre-loaded and pointed at `alter_*_atomic`.
- Where a print/detail page exists (e.g. InvoicePrint), add `Alter` in the header toolbar too.

### 5. Audit + visibility

- Audit logs page (`/settings/audit-logs`) already exists — add an "Altered" filter chip so admin can review every alter with old/new diff and reason.
- Add a small `Altered` badge on rows whose latest audit entry is `ALTER`.

## Technical details

### File changes (frontend)

- New: `src/components/tally/TallyActions.tsx`, `src/components/tally/EntityFormDialog.tsx`, `src/components/tally/AlterReasonDialog.tsx`, `src/hooks/useAlter.ts`.
- Edit ~25 list/detail pages under `src/pages/masters/**`, `src/pages/sales/**`, `src/pages/purchase/**`, `src/pages/finance/**`, `src/pages/inventory/**`, `src/pages/settings/**` to wire the shared components in.
- Each voucher page gains an `Alter` mutation that calls the matching RPC.

### Migrations

- One migration per alter RPC (10 RPCs total). Each follows the same skeleton: SECURITY DEFINER, admin check, FY-closed check, void-replay-audit.
- Add `alter_reason text` column to `audit_logs` (or keep inside `new_data` jsonb — chosen: jsonb, no schema change).
- Add helper view `v_latest_audit_per_record` so the frontend can show the "Altered" badge cheaply.

### Risks / non-goals

- Altering an invoice whose batches no longer have enough stock (because stock has moved on) will fail with a clear error — admin must adjust stock first. This is intentional and matches Tally.
- Pro-rata credits already issued against a payment are **reversed and recomputed** when the payment is altered.
- GSTR-2B matched entries: if an invoice is altered, its `gstr2b_entries.match_status` resets to `pending`.
- Mobile field-ops screens are out of scope for Alter (field reps create only).
- E-way bills already pushed to NIC are NOT auto-cancelled — admin sees a warning to cancel manually on the NIC portal before altering.

## Rollout

Because of the size, I'll ship in 3 PR-sized batches and pause for your check after each:

1. **Batch A — Masters** (Dealers, Suppliers, Products, Transporters, Warehouses, Price Levels, Employees, BOM, Branches, FYs, Company Settings, Chart of Accounts). No new RPCs. Lowest risk.
2. **Batch B — Light vouchers** (Sales Orders, Purchase Orders, Stock Transfers (draft only), Branch Transfers, Journal/Contra Vouchers). New RPCs without inventory/ledger replay or with simple replay.
3. **Batch C — Heavy vouchers** (Sales Invoices, Purchase Invoices, Credit Notes, Debit Notes, Payments, Receipts, Advance Receipts). Full void-and-replay RPCs.

Confirm and I'll start with **Batch A**.