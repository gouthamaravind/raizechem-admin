# Role-Aware Mobile Shells + Manager Role

## Goals
1. Add new role `manager` — approves field-ops orders before they become sales orders.
2. Reorganize mobile routes under `/m/{role}/...` with per-role bottom nav and feature surface.
3. Make admin/sales mobile experience usable (current `/dashboard` overflows on 390px — quick actions and sidebar layout break, as seen in screenshot).

---

## 1. New Role: `manager`

### DB migration
- Add `'manager'` to `app_role` enum.
- RLS: managers can `SELECT/UPDATE` `field_orders` (status: pending → approved/rejected). Approval promotes a field order into a regular sales `order` via existing RPC (new RPC `approve_field_order_atomic(p_field_order_id, p_notes)` — voids field-order draft + creates sales order with link).
- Add `manager_approval_status`, `approved_by`, `approved_at`, `rejected_reason` columns to `field_orders` if missing.

### Code
- `src/types/roles.ts`: add `'manager'` to `Role` union and `MODULE_ACCESS` (gets approvals, sales read-only, fieldops read-only, reports).
- `src/pages/settings/UserManagement.tsx`: include manager in role picker.

---

## 2. Role-Aware Mobile Shells

### New URL structure
```
/m/login                              (shared)
/m/fieldops/home, /duty, /dealers, /visits/*, /orders/*, /payments/*
/m/manager/home, /approvals, /orders, /dealers
/m/sales/home, /orders, /invoices, /dealers, /payments
/m/admin/home, /dashboard, /reports, /approvals, /settings
```

### Routing changes (`src/App.tsx`)
- Keep current `/m/home`, `/m/duty`, etc. as **redirects** to `/m/fieldops/*` (backwards compatible for installed Android app).
- Add new role-prefixed routes.
- Update `P` wrapper logic: on native, redirect each user to `/m/{primary_role}/home` based on their highest-priority role:
  - `admin` → `/m/admin/home`
  - `manager` → `/m/manager/home`
  - `sales` → `/m/sales/home`
  - `fieldops` → `/m/fieldops/home`
  - others (warehouse/accounts/inventory) → `/m/admin/home` (read-only-ish, reuses admin shell)

### New shell component
`src/components/mobile/MobileLayout.tsx` — refactor to accept `role` prop OR auto-detect from URL `/m/:role/...`, render role-specific `navItems`:

| Role | Bottom nav items |
|---|---|
| fieldops | Home, Duty, Dealers, Orders, Payments (current) |
| manager | Home, Approvals, Orders, Dealers, Reports |
| sales | Home, Orders, Invoices, Dealers, Payments |
| admin | Home, Dashboard, Approvals, Reports, More |

### New pages (lightweight, reuse existing data hooks)
- `src/pages/mobile/manager/ManagerHome.tsx` — KPIs: pending approvals count, today approvals, rejected.
- `src/pages/mobile/manager/ManagerApprovals.tsx` — list pending field orders; tap → approve/reject sheet using new RPC.
- `src/pages/mobile/sales/SalesHome.tsx` — sales KPIs (today invoices, pending orders, outstanding).
- `src/pages/mobile/sales/SalesOrders.tsx` & `SalesInvoices.tsx` — mobile-card list views (reuse queries from desktop pages, mobile-optimized rendering).
- `src/pages/mobile/admin/AdminHome.tsx` — mobile-friendly tiled overview (today sales, pending payments, low stock, pending approvals); replaces falling back to desktop `/dashboard`.
- `src/pages/mobile/admin/AdminMore.tsx` — accordion of all module links (Masters, Inventory, Finance, Reports, Settings) for full reach.

---

## 3. Mobile Dashboard Fix (admin on mobile)

The current behavior renders the desktop `Dashboard` with `DashboardLayout` (sidebar + 1400px container) on a 390px viewport — quick actions and KPI cards overflow horizontally (visible in screenshot).

Two parts:
- On native admin login → route to `/m/admin/home` (new mobile-first shell), not `/dashboard`.
- On non-native mobile web (responsive), keep desktop `/dashboard` but ensure the existing `QuickActions` row uses `flex-wrap` / horizontal scroll instead of overflow. (Quick win patch to `src/pages/Dashboard.tsx`.)

---

## 4. Implementation order

1. Migration: enum value + field_orders columns + RPC + RLS.
2. `roles.ts` update + UserManagement role list.
3. Refactor `MobileLayout` to role-aware nav (driven by URL prefix).
4. New mobile pages (admin/manager/sales home + key inner screens).
5. `App.tsx`: add `/m/:role/*` routes, add legacy redirects, update `P` redirect logic.
6. `Login.tsx` / `MobileLogin.tsx`: route to `/m/{role}/home` based on primary role.
7. Quick-action overflow fix on `Dashboard.tsx`.
8. Smoke-test each role's mobile shell at 390px.

---

## Technical notes

- Primary-role helper: add `getPrimaryRole(roles: Role[])` in `src/types/roles.ts` with priority `admin > manager > sales > warehouse > accounts > inventory > fieldops`.
- Field-order approval RPC must be atomic: insert sales order + items, link `field_orders.linked_order_id`, set status, write audit log.
- Reuse `useAuth().userRoles` for nav rendering — no extra fetches.
- Keep `MobileGuard` as-is; add `RoleMobileGuard` that also enforces URL role matches user's roles.

---

## Out of scope (this batch)
- Full feature parity for sales/admin mobile (only home + key list screens this round; "More" menu provides escape hatch).
- Push notifications for new approvals (future).
