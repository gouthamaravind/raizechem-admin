# E-Way Bill End-to-End: Transporter Picker + Branch Pincode

## Problem

1. Both branches (TG, AP) have **no pincode and no GSTIN** in the DB → `fromPincode: 0` → NIC rejects.
2. The "New E-Way Bill" dialog only takes a plain text transporter — no GSTIN captured → `transporterId: []` → NIC rejects.
3. Invoices have no transporter linkage, so even when you know who's transporting, it isn't carried forward.

## What to build

### 1. Database (migration)
- Add `invoices.transporter_id uuid` (nullable, FK → `transporters.id`).

### 2. Branch Settings page (`src/pages/settings/CompanySettings.tsx` or Branches admin)
- Ensure **Pincode** and **GSTIN** fields are visible and editable per branch.
- Add an **"Auto-fill from GSTIN"** button: calls `gstin-lookup` edge function → fills legal name, address, state code, **and pincode** (extracted from `pradr.addr.pncd`).
- Also extend the `gstin-lookup` edge function response to expose `pincode` as a top-level field (currently only embedded in `address`).

### 3. Invoice create / alter form (`src/pages/sales/Invoices.tsx`)
- New row near "Dispatch From": **Transporter** combobox
  - Options: existing active transporters from `transporters` table (label = "Name — GSTIN").
  - Inline button **"+ Add via GSTIN"** → small dialog: paste 15-char GSTIN → calls `gstin-lookup` → creates a `transporters` row → auto-selects it.
- Save `transporter_id` on invoice insert and on alter-replacement insert.

### 4. WaybillLog "New E-Way Bill" dialog (`src/pages/warehouse/WaybillLog.tsx`)
- Replace the free-text Transporter field with the same Transporter combobox + "Add via GSTIN" flow.
- When `sourceType=invoice` and the picked invoice has a `transporter_id`, **prefill** the selector with that transporter.
- On save, persist both `transporter_name` and `transporter_gstin` on the waybill row.
- Show an inline warning banner if the current branch is missing `pincode` or `gst_number`, with a link to Branch Settings.

### 5. Edge function pre-validation (`supabase/functions/whitebooks-ewaybill/index.ts`)
- Before constructing the NIC payload, add:
  - `fromPincode >= 100000` → friendly error: *"Your branch pincode is missing. Open Settings → Branches and fill it (or use Auto-fill from GSTIN)."*
  - If `transporter_gstin` is set, it must match the 15-char GSTIN regex, else error *"Transporter GSTIN is invalid (must be 15 chars). Update the transporter master."*
  - If `transporter_gstin` is empty AND distance ≥ 50 km, log a warning but still send (NIC allows it as long as vehicleNo is given).

## Out of scope

- Transporter master CRUD page already exists at `/masters/transporters` — no changes there.
- Bill-To/Ship-To (`transactionType` 2/3/4) flows — keep current default of 1.

## Verification

1. After migration, set branch pincode + GSTIN in Settings (or Auto-fill).
2. Create a transporter via the new "+ Add via GSTIN" flow.
3. Create an invoice with that transporter selected.
4. From the invoice row, click the Truck icon → New EWB dialog prefills transporter → submit → NIC accepts (no 108, no JSON validation errors).
