
## Audit Fixes — Completed

### 1. ✅ MobileGuard Auth Bypass (CRITICAL SECURITY)
- **File:** `src/components/mobile/MobileGuard.tsx`
- Restored `session` and `loading` checks; unauthenticated users now redirect to `/m/login`

### 2. ✅ Render-Phase setState in Returns (React Anti-Pattern)
- **Files:** `src/pages/sales/Returns.tsx`, `src/pages/purchase/Returns.tsx`
- Moved `setItems()` from render body into `useEffect` to prevent infinite re-render loops

### 3. ✅ GST Rounding Precision
- **File:** `src/lib/gst.ts`
- Fixed split rounding: CGST uses `Math.floor`, SGST gets remainder, guaranteeing `cgst + sgst === totalGst`

### 4. ✅ Outstanding Void Filter
- **File:** `src/pages/finance/Outstanding.tsx`
- Added `.neq("status", "void")` to exclude voided invoices from outstanding calculations

### 5. ✅ Login Page Robustness
- **File:** `src/pages/Login.tsx`
- Already had try/catch/finally and `<Navigate>` — confirmed correct

---

## Remaining Items (Not Yet Fixed)

### Non-Atomic Order/PO Creation (Race Condition)
- `src/pages/sales/Orders.tsx` reads `next_order_number` and increments it in two separate queries
- Should be refactored into a server-side RPC like `create_order_atomic`
- Same issue in Purchase Orders

### Order → Invoice Conversion (UI-Only)
- `Orders.tsx` navigates to `/sales/invoices` with `state.convertOrder` but `Invoices.tsx` doesn't consume it

### Unbounded Queries (No Pagination)
- All listing pages fetch without `LIMIT`; will hit the 1000-row default

### 6. ✅ Hardcoded State Code
- Added `state_code` column to `company_settings` (default `'36'`)
- `calculateGST()` now accepts optional `companyStateCode` param
- `InvoicePrint` and `EwayBillPrint` read state code from company settings dynamically
