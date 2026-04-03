# Codex Development Guide — Raizechem Admin ERP

## Project Overview

This is a **React 18 + TypeScript + Vite** ERP application for a chemical distribution company. It has a web admin panel and a planned Android mobile app (Capacitor) for field staff.

**Backend:** Lovable Cloud (Supabase-managed) — Postgres, Auth, Edge Functions, Storage. The backend is remote and shared between web and mobile. **Do NOT create local backend servers.**

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS v3, shadcn/ui components |
| State | TanStack React Query v5 |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Maps | Leaflet + React-Leaflet |
| Mobile | Capacitor (Android) |
| Backend | Supabase (remote — Postgres, Auth, Edge Functions) |
| Export | xlsx.js, custom CSV |

---

## File Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui primitives (DO NOT modify these directly)
│   ├── dashboard/      # Dashboard-specific widgets
│   ├── finance/        # Finance module components
│   └── mobile/         # Mobile app components (MobileGuard, MobileLayout)
├── hooks/              # Custom hooks
│   ├── useAuth.tsx     # Auth context (session, user, roles)
│   ├── useBranch.tsx   # Multi-branch context
│   ├── usePagination.tsx
│   └── ...
├── pages/              # Route-level page components
│   ├── masters/        # Dealers, Products, Suppliers, Transporters, PriceLevels
│   ├── sales/          # Orders, Invoices, Returns, BranchTransfers
│   ├── purchase/       # PO, Purchase Invoices, Returns
│   ├── inventory/      # Batches, StockIn, Alerts, Warehouses, BOM
│   ├── finance/        # Payments, Ledger, Outstanding, Advances, Vouchers
│   ├── hr/             # Employees, Payroll, Payslips
│   ├── reports/        # All report pages (Sales/Purchase Register, GST, etc.)
│   ├── settings/       # Company, Users, AuditLogs, FinancialYears
│   ├── fieldops/       # Admin views for field operations
│   └── mobile/         # Mobile app pages (field staff)
├── lib/                # Utility functions
│   ├── gst.ts          # GST calculation (CGST/SGST/IGST split)
│   ├── csv-export.ts   # CSV export helper
│   ├── xlsx-export.ts  # Excel export helper
│   └── utils.ts        # cn() and general utils
├── types/
│   └── roles.ts        # AppRole type and MODULE_ACCESS map
└── integrations/
    └── supabase/
        ├── client.ts   # ⚠️ AUTO-GENERATED — never edit
        └── types.ts    # ⚠️ AUTO-GENERATED — never edit

supabase/
├── functions/          # Edge Functions (Deno/TypeScript)
│   ├── manage-users/   # Admin user/role management
│   ├── generate-pdf/   # Invoice/payslip PDF generation
│   ├── fieldops/       # Field operations API
│   ├── gstin-lookup/   # GST verification via Appyflow API
│   ├── verify-gst/     # GST number validation
│   ├── create-admin/   # Initial admin setup
│   └── location-cleanup/ # Prune old GPS data
└── config.toml         # Edge function config (verify_jwt settings)
```

---

## Critical Rules

### DO NOT Edit These Files
- `src/integrations/supabase/client.ts` — auto-generated
- `src/integrations/supabase/types.ts` — auto-generated
- `.env` — auto-managed, contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

### Supabase Client Usage
```typescript
import { supabase } from "@/integrations/supabase/client";

// Query example
const { data, error } = await supabase.from("dealers").select("*");

// RPC call example
const { data } = await supabase.rpc("create_invoice_atomic", { ... });

// Edge function call example
const { data } = await supabase.functions.invoke("gstin-lookup", {
  body: { gstin: "36AAACC7852K1ZE" }
});
```

### Styling Rules
- Use Tailwind semantic tokens from `index.css` — never hardcode colors
- Use `bg-primary`, `text-foreground`, `border-border`, etc.
- All colors are HSL-based via CSS variables
- Dark mode is supported via `next-themes`

### Role-Based Access
```typescript
// Roles: "admin" | "sales" | "warehouse" | "accounts" | "inventory" | "fieldops"
// Check MODULE_ACCESS in src/types/roles.ts for per-module permissions
// Auth hook: const { session, userRoles } = useAuth();
// Guard component: <RoleGuard module="sales">...</RoleGuard>
```

---

## Backend Architecture

### Database (50+ tables, all with RLS)
All critical operations use **atomic RPCs** (PL/pgSQL functions with `SECURITY DEFINER`):

| RPC | Purpose |
|-----|---------|
| `create_invoice_atomic` | Invoice + items + stock deduction + ledger entry |
| `record_payment_atomic` | Payment + FIFO allocation + ledger |
| `void_invoice_atomic` | Void + reverse stock + reverse ledger |
| `create_order_atomic` | Order + items + sequential number |
| `create_po_atomic` | Purchase order + items + sequential number |
| `create_credit_note_atomic` | Credit note + stock restore + dealer ledger |
| `create_debit_note_atomic` | Debit note + stock deduct + supplier ledger |
| `create_purchase_invoice_atomic` | PI + batch creation + stock-in + supplier ledger |
| `record_supplier_payment_atomic` | Supplier payment + FIFO allocation |
| `void_payment_atomic` | Void payment + reverse allocations |
| `void_purchase_invoice_atomic` | Void PI + reverse stock |
| `void_credit_note_atomic` | Void CN + reverse |
| `void_debit_note_atomic` | Void DN + reverse |
| `finalize_duty_session` | KM calc + incentive via Haversine |
| `create_advance_receipt_atomic` | Advance receipt + ledger |
| `allocate_advance_to_invoice_atomic` | FIFO advance allocation |

### Edge Functions (Deno runtime)
Located in `supabase/functions/<name>/index.ts`. These auto-deploy when pushed to GitHub.

### Database Changes
Database schema changes (new tables, columns, RLS policies, RPCs) are done via **migrations** managed through Lovable. Do not write raw SQL migration files manually.

---

## Multi-Branch Support

The app supports multiple branches. Key patterns:
- `useBranch()` hook provides `activeBranch`
- Most queries filter by `branch_id` when a branch is selected
- Each branch has independent sequential counters (invoice, order, etc.)
- Branches table: `branches` with own GST, address, bank details

---

## Key Patterns

### Data Fetching
```typescript
// All pages use TanStack React Query
const { data, isLoading } = useQuery({
  queryKey: ["dealers", activeBranch?.id],
  queryFn: async () => {
    let query = supabase.from("dealers").select("*");
    if (activeBranch) query = query.eq("branch_id", activeBranch.id);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});
```

### GST Calculation
```typescript
import { calculateGST } from "@/lib/gst";
// Returns { cgst, sgst, igst, totalGst, totalAmount }
// Handles intra-state (CGST+SGST) vs inter-state (IGST) automatically
```

### Toast Notifications
```typescript
import { toast } from "sonner";
toast.success("Invoice created");
toast.error("Something went wrong");
```

### Void Operations
All voids go through atomic RPCs — never delete records directly. Voids reverse stock, ledger entries, and payment allocations atomically.

---

## Mobile App (Capacitor)

### Config
- `capacitor.config.ts` — app config with server URL for hot-reload
- Mobile routes: `/m/*` (MobileHome, MobileDuty, MobileCheckin, etc.)
- Auth guard: `MobileGuard.tsx` redirects unauthenticated to `/m/login`

### Mobile Features
- Duty sessions (punch in/out with GPS)
- Dealer visits (check-in/out with location)
- Field orders (create → admin approval → main order)
- Field payments (collect with receipt)
- GPS breadcrumb tracking (`location_points` table)

### Build & Run
```bash
npm run build
npx cap sync
npx cap run android
```

---

## Environment

- **Node.js** required (use nvm)
- **Android Studio** required for mobile builds
- Backend is remote — no local server needed
- `npm run dev` starts Vite dev server on `localhost:5173`
- `npm run build` creates production build in `dist/`

---

## Known Limitations

- No server-side pagination (Supabase 1000-row default)
- No offline support for mobile yet
- No error boundaries (component crash = blank screen)
- Invoice/payment editing not supported (void + recreate by design)
- Some `as any` TypeScript casts in payment/inventory flows

---

## Auth

- Email/password only (restricted to `@raizechem.in` domain)
- No third-party OAuth
- Admin account: `admin@raizechem.in`
- Roles stored in `user_roles` table (never in profiles)
- Role check: `has_role()` / `has_any_role()` DB functions
