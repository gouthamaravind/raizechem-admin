## Mega Plan — Raizechem Admin v2 (Inventory, Pricing, Compliance, Dealer Lifecycle)

This plan groups your 6 sections into **shippable phases**. Each phase is independently usable so you can sign off in chunks instead of waiting for one giant release.

---

### Phase 1 — Inventory & Pricing Engine

**1.1 BOM upgrade**
- Add `unit` (kg/L/g/pcs/...) at item level (already partially there → enforce dropdown).
- Add **pricing block** to each BOM item: `purchase_rate`, `packing_rate`, `scheme_1/2/3` (% or flat), and computed `effective_cost`.
- Add **BOM cost rollup** on header: total raw cost, total packing, total schemes, computed cost/unit of finished product.
- Recipe versioning (mark old `is_active=false`, new revision auto-created).

**1.2 Pricing Matrix (per product)**
New table `product_pricing_matrix` with stack:
```
purchase_price + packing + scheme1 + scheme2 + scheme3
       → TO (turnover/target slab)
       → margin %
       → ex-GST price
       → +GST → MRP
```
- Multi-tier slabs (TO bands: 0–1L, 1–5L, 5L+ each with own margin).
- Live calculator UI showing every step (so accounts team can audit).
- "Lock MRP" button → writes to `products.mrp` + audit log.

**1.3 CRUD + Bulk ops (HQ)**
- Standardize CRUD on Products, Dealers, Suppliers, BOM, Pricing.
- **Bulk update screen** (HQ-only): select rows → edit price/margin/scheme inline → preview diff → commit (single audit entry per batch).
- CSV import/export for all masters (already exists for some — extend).

---

### Phase 2 — Supply Chain: Branch Transfer & E-Way Bill

**2.1 Sales → Branch Transfer flow**
- Existing `BranchTransfers` page → add "Convert to Invoice" → on invoice create, **auto-generate Waybill record** (linked 1:1).
- BT invoice numbering separate series (e.g. `BT/FY/001`).

**2.2 Warehouse role + login**
- New role `warehouse_ops` (already have `warehouse` — extend permissions).
- Dedicated `/warehouse` landing: today's dispatches, pending eway bills, stock movement log.
- Eway bill generation button per invoice/BT (dry-run first; real GSP integration deferred until WhiteBooks/Masters India creds added — ETA Phase 6).

**2.3 Master Waybill Log (Super Admin)**
- New page `/sales/waybills` — filterable by branch, date, status (pending/generated/cancelled), GSP response code.
- Export CSV / re-print.

---

### Phase 3 — Workflow Approvals & Field Ops

**3.1 Approval engine** (generic, reusable)
- New table `approval_requests` (entity_type, entity_id, requested_by, approver_role, status, notes).
- Wire into:
  - Sales Order → needs Manager approval before "Ready to Invoice"
  - Invoice alteration (any edit on issued invoice) → Admin approval + batch dependency check
  - Manager → Admin escalation chain
- Notifications popover surfaces pending approvals.

**3.2 Field Ops tracking enhancements**
- FA/DA visit screen: mandatory **photo upload** (Capacitor camera) before checkout (already partially built — make required, not optional).
- Activity log per visit: order taken / collection / complaint / demo (dropdown).
- Admin dashboard: live FA map + activity heatmap (already partially built via LiveTracking).

---

### Phase 4 — Accounts, Ledgers & New Registers

**4.1 Ledger downloads (global)**
- "Download Ledger" button on every dealer/supplier ledger page → PDF + Excel.
- HQ-level: bulk ledger export (zip per dealer).

**4.2 Voucher controls**
- Add `is_unique_lock` flag — once a voucher (Invoice/Purchase/Receipt) is created, **alter requires admin approval** (ties to Phase 3).
- **Cancelled Vouchers Register** (new report) → marked as `[Exception Report]`, separate from void/active.
- Daybook page: chronological feed of every entry across all modules per day.

**4.3 New Registers** (sidebar additions)
- ✅ Payments Register (exists)
- ✅ Receipt Register (exists)
- ➕ **Journal Register** — extend to include Delivery Notes & Purchase Orders rows
- ✅ Debit Note Register (exists)
- ➕ **Cancelled/Exception Vouchers Register** (new)

---

### Phase 5 — Dealer Management & Policy

**5.1 Dealer ops**
- CSV bulk upload for Dealers (validation: GSTIN, pincode, duplicates).
- "Alter Dealer" with audit (existing edit, just enforce trigger).
- HQ override flag (`hq_override` boolean) for special pricing/credit beyond policy defaults.
- "Convert/Delete Retail" option on dealer profile (toggle dealer_type).

**5.2 Credit aging policy**
- Configurable thresholds in `company_settings`:
  - `credit_aging_days` default **90**
  - `early_warning_days` default **15** (yellow)
  - `critical_warning_days` default **7** (red, escalate to admin)
- Dashboard widget: dealers crossing each tier.

**5.3 GST Reports + variance**
- Existing GST Summary → add CGST-specific drill-down.
- Mandatory **Reason input** when posting variance/adjustment entry → stored in `variance_reasons` table for audit.

---

### Phase 6 — Security Deposit & Dealership Closure

**6.1 Security Deposit profile**
- Add `security_deposit_amount`, `sd_received_date`, `sd_mode` to dealers.
- Mandatory at onboarding (form validation).
- Dedicated SD ledger view per dealer.

**6.2 Closure workflow**
New `/finance/dealer-closure` flow:
1. Select dealer → snapshot outstanding (invoices, advances, SD balance).
2. Compute **pro-rata adjustments**:
   - Same-day discount logic
   - Pro-rata discount: e.g. ₹100,000 → ₹10,000 credit using existing `apply_prorata_credit` function (extend for closure context, capped 12%/90 days from memory).
3. Auto-adjust SD against dues → generate net payable/receivable.
4. Generate closure statement PDF.
5. Mark dealer `is_active=false`, freeze all transactions.

**6.3 Account Statements & Reminders**
- One-click **Account Statement PDF** per dealer → filename `{dealer_name}.pdf`.
- "Remind Please" button → triggers reminder workflow.
- **Automated reminder letters** (cron via edge function):
  - Email + SMS to dealer for overdue (15/7-day tiers above)
  - Templated, with running balance + ageing breakup
  - Log in `reminder_log` table (sent_at, channel, status)
- Requires email infra (Lovable Emails) + SMS gateway (Twilio/MSG91 — ask later).

---

## Technical / Schema Changes

```
+ bom_items.unit, .purchase_rate, .packing_rate, .scheme_1..3
+ bom_headers.computed_cost, .version
+ product_pricing_matrix (product_id, slab_min, slab_max, margin_pct, ex_gst, mrp, locked_at)
+ waybills (invoice_id, eway_no, gsp_status, vehicle, valid_until, ...)
+ approval_requests (entity_type, entity_id, status, approver_role, notes)
+ variance_reasons (voucher_id, reason, posted_by)
+ reminder_log (dealer_id, channel, status, sent_at)
+ dealers.security_deposit_amount, .sd_received_date, .sd_mode, .hq_override
+ company_settings.credit_aging_days, .early_warning_days, .critical_warning_days
```

Plus RLS, audit triggers (existing pattern), and atomic RPCs for closure & bulk price updates.

---

## Suggested Build Order (so you can ship fast)

| Sprint | Phase | Why first |
|---|---|---|
| 1 | **Phase 1** (BOM pricing + Matrix + Bulk) | Unlocks accurate MRP across the catalog |
| 2 | **Phase 4** (Registers + Daybook + Ledger DL) | Quick wins, mostly UI on existing data |
| 3 | **Phase 3** (Approval engine) | Foundation other phases depend on |
| 4 | **Phase 5** (Dealer policy + bulk upload) | Cleans master data before closures |
| 5 | **Phase 6** (SD + Closure + Reminders) | Needs Phases 1/3/5 in place |
| 6 | **Phase 2** (BT + E-way) | Park until GSP creds finalized |

---

## What I need from you to start

1. **Confirm sprint order** above (or reshuffle).
2. **Pricing matrix slabs** — do you want fixed bands (e.g. 0–1L, 1–5L, 5L+) or fully custom per product?
3. **Reminder channels for Phase 6** — Email only first, or Email + SMS together? (SMS needs gateway choice.)
4. **GSP for Phase 2** — final call: WhiteBooks ₹15k or Masters India free tier first?

Once you OK this, I'll start **Sprint 1 (BOM + Pricing Matrix + Bulk Update)** in the next message.
