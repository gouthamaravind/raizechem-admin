# Tally-Style Reports Suite — Build Plan

Goal: Match Tally Prime's "Display More Reports" experience — every voucher type has a Register; every Register supports Year → Month → Day → Voucher drill-down; central Gateway hub at `/reports`.

## Phase 1 — Foundations (DB + Reports Hub)

1. **`contra_vouchers` table** + atomic RPC `create_contra_atomic` (bank↔cash, bank↔bank). Auto-numbered `CV/{FY}/{seq}`, posts to ledger_entries (debit one account, credit other), branch-aware.
2. **`/reports` Gateway hub page** — Tally-style menu grouped as:
   - **Summary**: Cash/Bank Books, Ledger, Group Summary, Group Vouchers
   - **Registers**: Contra, Payment, Receipt, Sales, Purchase, Journal, Debit Note, Credit Note
   - **Statements**: Trial Balance, P&L, Balance Sheet, Outstanding, GST Summary
   - **Exception Reports**: Voucher Clarification (cancelled/void/unbalanced)
3. **Reusable `<RegisterDrillDown>` component** — accepts a data source + date field; renders Year → Month → Day → Voucher list with "Total Vouchers / Cancelled" columns matching the Tally screenshots.

## Phase 2 — Missing Register Pages

Build using the drill-down component:
4. `/reports/payment-register` — from `payments` table
5. `/reports/receipt-register` — from `payments` (receipt mode) + `advance_receipts`
6. `/reports/contra-register` — from new `contra_vouchers`
7. `/reports/journal-register` — from `vouchers` (journal type)
8. `/reports/credit-note-register` — from `credit_notes`
9. `/reports/debit-note-register` — from `debit_notes`

## Phase 3 — Refactor Existing Registers

10. Add drill-down mode toggle to `/reports/sales-register` and `/reports/purchase-register` — keep existing flat view + add Tally drill mode.

## Phase 4 — Account Books

11. **Cash/Bank Book** — `/reports/cash-bank-book`. Account picker (cash + bank ledgers) → date range → all entries with running balance.
12. **Group Summary** — `/reports/group-summary`. Chart-of-Accounts grouped totals (Assets/Liabilities/Income/Expense), drill to ledger.
13. **Group Vouchers** — `/reports/group-vouchers`. All vouchers under selected group with drill-down.

## Phase 5 — Exception Reports

14. **Voucher Clarification** — `/reports/voucher-clarification`. Lists cancelled/void/unbalanced vouchers across all types with reason and reverter info.

## Technical Notes

- All pages: branch-filtered via `useBranch`, CSV/XLSX export, glassmorphism design system
- Drill-down state managed in URL query params (`?year=2026&month=4&day=15`) so deep-links work
- Contra needs new `chart_of_accounts.account_type IN ('cash','bank')` filter for the picker
- `ledger_entries` already has the data — we mostly aggregate, no schema bloat
- Add all new routes to `App.tsx` + sidebar nav under "Reports"

## Sidebar reorganization

Add new "Reports Hub" parent in sidebar grouping all 14+ report pages under collapsible sections matching the Gateway layout.

---

I'll start with **Phase 1** (DB migration for contra + Reports hub + drill-down component) and pause for your review before Phase 2.