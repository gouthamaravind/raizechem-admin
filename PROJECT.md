# Raizechem Admin Panel

> Enterprise-grade ERP for chemical distribution — sales, purchase, inventory, finance, HR, and field operations management.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Modules](#modules)
4. [Database Schema](#database-schema)
5. [Atomic RPCs](#atomic-rpcs)
6. [Edge Functions](#edge-functions)
7. [Authentication & Roles](#authentication--roles)
8. [Mobile Field App](#mobile-field-app)
9. [GST Compliance](#gst-compliance)
10. [Setup & Deployment](#setup--deployment)
11. [API Reference](#api-reference)

---

## Overview

Raizechem Admin Panel is a full-stack ERP system built for **B2B chemical distribution**. It manages the complete order-to-cash and procure-to-pay cycles with Indian GST compliance, field sales tracking, and HR/payroll.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Sales Pipeline** | Orders → Invoices → Payments with auto FIFO allocation |
| **Purchase Pipeline** | PO → Purchase Invoice → Debit Notes |
| **Inventory** | Batch-tracked, FIFO stock with min-alert thresholds |
| **Finance** | Dealer/Supplier ledgers, outstanding aging, TDS/TCS |
| **Field Operations** | GPS-tracked duty sessions, dealer visits, field orders/payments |
| **HR & Payroll** | Employee management, salary components, payroll runs, payslips |
| **GST Compliance** | CGST/SGST/IGST auto-calc, HSN codes, GSTR export-ready |
| **Reporting** | Sales/Purchase registers, GST summary, aging reports, batch stock |
| **Audit Trail** | Full audit logging on all critical tables |

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI |
| **State** | TanStack React Query (server state), React useState (local) |
| **Charts** | Recharts |
| **Backend** | Lovable Cloud (Supabase) — PostgreSQL, Edge Functions |
| **Auth** | Supabase Auth with RBAC via `user_roles` table |
| **Exports** | CSV (custom), XLSX (SheetJS) |

### Design Tokens

All colors use HSL CSS variables defined in `src/index.css`:
- Primary: `--primary` (green teal, `161 93% 30%`)
- Success/Warning/Destructive semantic tokens
- Fonts: Work Sans (body), Lora (serif), Inconsolata (mono)

### Project Structure

```
src/
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui primitives
│   ├── mobile/          # Mobile-specific layout components
│   ├── AppSidebar.tsx   # Main navigation sidebar
│   ├── DashboardLayout.tsx
│   ├── TopBar.tsx
│   ├── ProtectedRoute.tsx
│   ├── RoleGuard.tsx
│   └── VoidDialog.tsx
├── hooks/               # Custom hooks
│   ├── useAuth.tsx       # Auth context + RBAC
│   ├── useFieldOps.tsx   # Field operations logic
│   └── useVoidTransaction.tsx
├── lib/                 # Utilities
│   ├── gst.ts           # GST calculation engine
│   ├── gstr-export.ts   # GSTR-1 export helpers
│   ├── csv-export.ts    # CSV export utility
│   └── xlsx-export.ts   # Excel export utility
├── pages/
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── masters/         # Dealers, Products, Suppliers
│   ├── sales/           # Orders, Invoices, Returns
│   ├── purchase/        # PO, Purchase Invoices, Debit Notes
│   ├── inventory/       # Batches, Stock In, Alerts
│   ├── finance/         # Ledger, Outstanding, Payments (dealer + supplier)
│   ├── reports/         # Sales/Purchase registers, GST, Aging, TDS/TCS
│   ├── hr/              # Employees, Salary, Payroll, Payslips
│   ├── fieldops/        # Admin view of field data
│   ├── mobile/          # Mobile field app pages
│   └── settings/        # Company, Users, FY, Audit Logs
├── types/
│   └── roles.ts         # AppRole type + MODULE_ACCESS map
└── integrations/
    └── supabase/        # Auto-generated client + types
supabase/
├── functions/           # Edge functions
│   ├── create-admin/    # Bootstrap first admin user
│   ├── fieldops/        # Field operations API
│   ├── generate-pdf/    # Invoice PDF generation
│   ├── location-cleanup/# GPS data retention cleanup
│   └── manage-users/    # User management (admin)
└── migrations/          # Database migrations (read-only)
```

---

## Modules

### 1. Masters

| Page | Route | Purpose |
|------|-------|---------|
| Dealers | `/masters/dealers` | Customer/distributor management with billing + shipping addresses, GSTIN, credit limits |
| Suppliers | `/masters/suppliers` | Vendor management for purchases |
| Products | `/masters/products` | Product catalog with HSN, GST rate, sale/purchase prices, min stock alerts |

### 2. Sales

| Page | Route | Purpose |
|------|-------|---------|
| Orders | `/sales/orders` | Sales order creation with sequential numbering (`ORD/YYYY/NNN`), Convert to Invoice workflow |
| Invoices | `/sales/invoices` | GST invoice creation via `create_invoice_atomic` RPC — auto-numbers, stock deduction, ledger entries |
| Returns | `/sales/returns` | Credit notes via `create_credit_note_atomic` RPC — atomic stock restoration + ledger |

### 3. Purchase

| Page | Route | Purpose |
|------|-------|---------|
| Orders | `/purchase/orders` | Purchase order management with sequential numbering (`PO/YYYY/NNN`), Convert to Purchase Invoice workflow |
| Invoices | `/purchase/invoices` | Purchase invoice via `create_purchase_invoice_atomic` RPC — batch creation, stock-in, supplier ledger |
| Returns | `/purchase/returns` | Debit notes via `create_debit_note_atomic` RPC — atomic stock deduction + supplier ledger |

### 4. Inventory

| Page | Route | Purpose |
|------|-------|---------|
| Batches | `/inventory/batches` | Batch-wise stock with MFG/EXP dates |
| Stock In | `/inventory/stock-in` | Manual stock adjustments |
| Alerts | `/inventory/alerts` | Low stock alerts based on `min_stock_alert_qty` |

### 5. Finance

| Page | Route | Purpose |
|------|-------|---------|
| Dealer Ledger | `/finance/ledger` | Complete transaction history per dealer |
| Dealer Outstanding | `/finance/outstanding` | Unpaid invoice tracking |
| Dealer Payments | `/finance/payments` | Payment recording via `record_payment_atomic` (FIFO allocation), TDS/TCS, void support |
| Supplier Ledger | `/finance/supplier-ledger` | Supplier transaction history |
| Supplier Outstanding | `/finance/supplier-outstanding` | Unpaid purchase invoices |
| Supplier Payments | `/finance/supplier-payments` | Supplier payment via `record_supplier_payment_atomic` (FIFO allocation to oldest unpaid purchase invoices) |

### 6. Reports

| Report | Route | Purpose |
|--------|-------|---------|
| Sales Register | `/reports/sales-register` | Date-range invoice listing |
| Purchase Register | `/reports/purchase-register` | Date-range purchase listing |
| Outstanding Aging | `/reports/outstanding-aging` | Aging buckets (0-30, 31-60, 61-90, 90+) |
| Batch Stock | `/reports/batch-stock` | Current stock by product & batch |
| GST Summary | `/reports/gst-summary` | GSTR-1 ready summary |
| TDS/TCS | `/reports/tds-tcs` | TDS/TCS deduction report |

### 7. HR & Payroll

| Page | Route | Purpose |
|------|-------|---------|
| Employees | `/hr/employees` | Employee directory with PAN, UAN, bank details |
| Salary Components | `/hr/salary-components` | Earnings & deductions configuration |
| Payroll | `/hr/payroll` | Monthly payroll runs |
| Payslips | `/hr/payslips` | Individual payslip generation |

### 8. Field Operations

**Admin View** (desktop):
| Page | Route | Purpose |
|------|-------|---------|
| Duty Sessions | `/fieldops/sessions` | View all field staff sessions, KM, duration |
| Visits | `/fieldops/visits` | Dealer visit check-in/out records |
| Field Orders | `/fieldops/field-orders` | Approve/reject field-captured orders |
| Field Payments | `/fieldops/payments` | Verify field-collected payments |

**Mobile App** (field staff):
| Page | Route | Purpose |
|------|-------|---------|
| Home | `/m/home` | Today's summary (duty, KM, orders, collections) |
| Duty | `/m/duty` | Start/stop duty with GPS tracking |
| Dealers | `/m/dealers` | Browse dealers, quick check-in |
| Check-in/out | `/m/visits/checkin` | GPS-tagged dealer visit |
| New Order | `/m/orders/new` | Capture field order |
| New Payment | `/m/payments/new` | Capture field payment |

### 9. Settings

| Page | Route | Purpose |
|------|-------|---------|
| Company | `/settings/company` | Company profile, GSTIN, bank details, invoice series, sequential counters |
| Users | `/settings/users` | User management with role assignment |
| Financial Years | `/settings/financial-years` | FY management and closing |
| Opening Balances | `/settings/opening-balances` | Manage dealer/supplier opening balances per FY |
| Audit Logs | `/settings/audit-logs` | Full audit trail of all data changes |

---

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `dealers` | Customers | name, GSTIN, state_code, credit_limit, payment_terms_days |
| `suppliers` | Vendors | name, GSTIN, state_code |
| `products` | Product catalog | name, hsn_code, gst_rate, sale_price, unit, min_stock_alert_qty |
| `product_batches` | Batch inventory | product_id, batch_no, current_qty, mfg_date, exp_date, purchase_rate |
| `orders` / `order_items` | Sales orders | dealer_id, order_number, status (draft→confirmed→dispatched→delivered) |
| `invoices` / `invoice_items` | GST invoices | invoice_number (auto), CGST/SGST/IGST, amount_paid, status |
| `payments` | Dealer payments | amount, TDS/TCS, payment_mode, FIFO-allocated via `payment_allocations` |
| `payment_allocations` | Payment↔Invoice mapping | payment_id, invoice_id, allocated_amount |
| `credit_notes` / `credit_note_items` | Sales returns | Against specific invoices |
| `purchase_orders` / `purchase_invoices` | Purchase pipeline | supplier_id, similar structure to sales |
| `debit_notes` | Purchase returns | Against purchase invoices |
| `ledger_entries` | Dealer ledger | entry_type (invoice/payment/void), debit/credit |
| `inventory_txn` | Stock movements | txn_type (SALE/PURCHASE/ADJUSTMENT), qty_in/out |
| `opening_balances` | FY opening balances | entity_id, entity_type, opening_debit/credit |

### Field Operations Tables

| Table | Purpose |
|-------|---------|
| `duty_sessions` | GPS duty sessions with start/end, total_km, incentive |
| `location_points` | GPS breadcrumb trail (lat, lng, accuracy) |
| `dealer_visits` | Check-in/out with GPS coordinates and photos |
| `field_orders` / `field_order_items` | Field-captured orders (pending→converted/rejected) |
| `field_payments` | Field-collected payments (pending→verified/rejected) |
| `employee_profiles` | Links auth users to field employee data |
| `incentive_rules` | KM-based and per-order incentive configuration |

### HR Tables

| Table | Purpose |
|-------|---------|
| `employees` | Employee master with salary, PAN, UAN |
| `salary_components` | Earnings/deductions templates |
| `payroll_runs` | Monthly payroll batches |
| `payslips` | Individual payslip with earnings/deductions JSON |

### System Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (auto-created on signup) |
| `user_roles` | RBAC role assignments |
| `company_settings` | Company info, invoice numbering |
| `financial_years` | FY periods and closing |
| `audit_logs` | Full audit trail |

---

## Atomic RPCs

All critical financial operations use PostgreSQL functions with row-level locking for concurrency safety:

### Sales Side
| RPC | Purpose |
|-----|---------|
| `create_invoice_atomic` | Sequential numbering, batch stock deduction, invoice + items + inventory txn + ledger entry |
| `record_payment_atomic` | FIFO allocation to oldest unpaid invoices, payment_allocations, ledger entry |
| `void_invoice_atomic` | Marks void, reverses batch stock, creates reversal inventory txn + ledger |
| `void_payment_atomic` | Marks void, reverses allocations using `payment_allocations`, reverses ledger |
| `create_credit_note_atomic` | Sequential CN numbering, stock restoration, dealer ledger credit entry |
| `void_credit_note_atomic` | Reverses stock restoration, reverses dealer ledger entry |

### Purchase Side
| RPC | Purpose |
|-----|---------|
| `create_purchase_invoice_atomic` | Batch creation/upsert, stock-in via inventory txn, supplier ledger debit entry |
| `record_supplier_payment_atomic` | FIFO allocation to oldest unpaid purchase invoices, supplier ledger credit entry |
| `void_purchase_invoice_atomic` | Reverses batch stock, inventory txn, supplier ledger entry |
| `create_debit_note_atomic` | Sequential DN numbering, stock deduction, supplier ledger credit entry |
| `void_debit_note_atomic` | Restores stock, reverses supplier ledger entry |

### Field Operations
| RPC | Purpose |
|-----|---------|
| `approve_field_order` | Converts field order → main pipeline order, copies items |
| `finalize_duty_session` | Computes total KM via Haversine, calculates incentive |

---

## Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `create-admin` | Bootstrap first admin user | Requires `ADMIN_BOOTSTRAP_TOKEN` |
| `fieldops` | Field operations API (sync, location, etc.) | Bearer token (user auth) |
| `generate-pdf` | Invoice PDF generation | User auth |
| `location-cleanup` | 30-day GPS data retention cleanup | Service role |
| `manage-users` | Admin user management (create, update roles) | Admin role required |

---

## Authentication & Roles

### Role-Based Access Control

| Role | Access |
|------|--------|
| `admin` | Full access to all modules |
| `sales` | Masters, Sales, Finance, Reports, Field Ops |
| `accounts` | Finance, Reports, Field Ops |
| `inventory` | Masters (products), Inventory, Purchase, Reports |
| `warehouse` | Inventory, Purchase |

Roles are stored in `user_roles` table. Helper functions:
- `has_role(user_id, role)` — checks specific role
- `has_any_role(user_id)` — checks if user has any role

### RLS Policies

All tables have Row-Level Security enabled. Policies use the `has_role()` and `has_any_role()` helper functions. Security model:
- **Read**: Most tables allow any authenticated user with a role
- **Write**: Restricted by module (e.g., only admin/sales can create invoices)
- **Delete**: Generally restricted to admin only
- **Void**: Admin and accounts can void invoices/payments

---

## Mobile Field App

### Routes
All mobile routes are prefixed with `/m/` and protected by `MobileGuard`.

### Features
- **GPS Tracking**: 3 modes (Low/Normal/High accuracy)
- **Duty Sessions**: Start/stop with location capture
- **Dealer Visits**: Check-in/out with GPS coordinates
- **Field Orders**: Capture orders on-the-go (approval workflow)
- **Field Payments**: Record collections (verification workflow)
- **Daily Summary**: Today's KM, orders, collections at a glance

### GPS Configuration
- Accuracy threshold: 100m
- Daily capture cap: 600 points
- Data retention: 30 days (via `location-cleanup` edge function)

---

## GST Compliance

### Tax Calculation
- **Intra-state** (same state_code): CGST (50%) + SGST (50%)
- **Inter-state** (different state_code): IGST (100%)
- Default GST rate per product (configurable: 5%, 12%, 18%, 28%)

### HSN Codes
- Stored per product in `products.hsn_code`
- Carried to invoice items for GSTR compliance

### Reports
- GST Summary with CGST/SGST/IGST breakdowns
- Sales Register (GSTR-1 ready)
- Purchase Register (GSTR-2 ready)

---

## Setup & Deployment

### Prerequisites
- Lovable Cloud project (auto-configured)
- No external dependencies required

### First-Time Setup

1. **Company Settings**: Navigate to `/settings/company` and configure:
   - Company name, legal name, GSTIN
   - Address, bank details
   - Invoice series (default: "RC") and starting number

2. **Create Admin User**: Use the `create-admin` edge function with `ADMIN_BOOTSTRAP_TOKEN`

3. **Financial Year**: Create active FY at `/settings/financial-years`

4. **Add Users**: Admin can create users at `/settings/users` with role assignments

5. **Master Data**: Add Products (with HSN, GST rates) → Dealers → Suppliers

6. **Inventory**: Add batches via Stock In or Purchase Invoices

### Environment Variables (Auto-configured)
- `VITE_SUPABASE_URL` — Backend URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Client key
- `ADMIN_BOOTSTRAP_TOKEN` — Edge function secret for admin creation

### Deployment
- **Frontend**: Click "Publish" in Lovable → "Update" to deploy
- **Backend**: Edge functions deploy automatically on save
- **Database**: Migrations apply via the migration tool

---

## API Reference

### Supabase RPC Functions

```typescript
// === Sales ===
supabase.rpc("create_invoice_atomic", {
  p_dealer_id, p_invoice_date, p_subtotal,
  p_cgst_total, p_sgst_total, p_igst_total, p_total_amount,
  p_created_by, p_items: [{product_id, batch_id, qty, rate, ...}],
})
supabase.rpc("record_payment_atomic", {
  p_dealer_id, p_payment_date, p_amount, p_payment_mode,
  p_reference_number, p_notes, p_created_by,
  p_tds_rate, p_tds_amount, p_tcs_rate, p_tcs_amount, p_net_amount
})
supabase.rpc("void_invoice_atomic", { p_invoice_id, p_reason, p_voided_by })
supabase.rpc("void_payment_atomic", { p_payment_id, p_reason, p_voided_by })
supabase.rpc("create_credit_note_atomic", { p_invoice_id, p_reason, p_created_by, p_items })
supabase.rpc("void_credit_note_atomic", { p_cn_id, p_reason, p_voided_by })

// === Purchase ===
supabase.rpc("create_purchase_invoice_atomic", {
  p_supplier_id, p_pi_number, p_pi_date, p_subtotal,
  p_cgst_total, p_sgst_total, p_igst_total, p_total_amount,
  p_created_by, p_items: [{product_id, batch_no, qty, rate, ...}],
})
supabase.rpc("record_supplier_payment_atomic", {
  p_supplier_id, p_payment_date, p_amount, p_mode, p_reference_no, p_notes
})
supabase.rpc("void_purchase_invoice_atomic", { p_pi_id, p_reason, p_voided_by })
supabase.rpc("create_debit_note_atomic", { p_purchase_invoice_id, p_reason, p_created_by, p_items })
supabase.rpc("void_debit_note_atomic", { p_dn_id, p_reason, p_voided_by })

// === Field Ops ===
supabase.rpc("approve_field_order", { _field_order_id, _order_number })
supabase.rpc("finalize_duty_session", { _session_id })
```

### Edge Function Endpoints

```
POST /functions/v1/create-admin
  Body: { token, email, password, full_name }

POST /functions/v1/manage-users
  Headers: Authorization: Bearer <user_token>
  Body: { action: "create"|"list"|"update_roles", ... }

POST /functions/v1/fieldops
  Headers: Authorization: Bearer <user_token>
  Body: { action: "sync_locations"|"get_summary"|... }

POST /functions/v1/generate-pdf
  Headers: Authorization: Bearer <user_token>
  Body: { invoice_id }
```

---

## Constraints & Integrity

| Constraint | Table | Purpose |
|-----------|-------|---------|
| `CHECK (current_qty >= 0)` | `product_batches` | Prevents negative stock |
| `UNIQUE (invoice_number)` | `invoices` | No duplicate invoice numbers |
| `UNIQUE (credit_note_number)` | `credit_notes` | No duplicate CN numbers |
| `UNIQUE (debit_note_number)` | `debit_notes` | No duplicate DN numbers |

### Indexes
- `invoices(invoice_date)`, `invoices(dealer_id)`
- `invoice_items(product_id)`, `invoice_items(batch_id)`
- `ledger_entries(entry_date)`, `ledger_entries(dealer_id)`
- `payment_allocations(payment_id)`, `payment_allocations(invoice_id)`

---

*Last updated: February 2026*
