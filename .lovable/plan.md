

# Raizechem Pvt Ltd — Admin Dashboard

## Overview
A full-featured admin web application for **Raizechem Pvt Ltd** (hosted at `admin.raizechem.in`), built with a professional blue-toned design, Supabase backend for authentication, role-based access, and full data persistence.

---

## 1. Design & Layout
- **Blue professional theme** — corporate blue sidebar, white content area, clean typography
- **Left sidebar** with collapsible navigation grouped by section (Masters, Inventory, Sales, Finance, Settings)
- **Top bar** with user avatar/name, role badge, global search, and logout
- **Responsive** but optimized for desktop use

---

## 2. Authentication & Roles
- **Login page** (`/login`) — email + password login (no signup; admin creates users)
- **Role-based access** with roles: `admin`, `sales`, `warehouse`
  - Roles stored in a dedicated `user_roles` table (secure, no privilege escalation)
  - Sidebar menu items shown/hidden based on role
  - Admin can manage employee accounts in Settings

---

## 3. Dashboard (`/dashboard`)
- Summary cards: today's orders, pending payments, low-stock alerts, total revenue
- Quick charts: monthly sales trend, top-selling products
- Recent activity feed (latest orders, stock movements)

---

## 4. Masters Module
### Dealers (`/masters/dealers`)
- List of dealers with search, filters (city, state, status)
- Add/Edit dealer form: name, GST number, contact, address, credit limit
- View dealer detail with outstanding balance

### Products (`/masters/products`)
- Product list with search and category filter
- Add/Edit product: name, HSN code, unit, GST rate, category
- Active/inactive toggle

---

## 5. Inventory Module
### Batches (`/inventory/batches`)
- List all batches with search by product, batch number, expiry
- Add batch: link to product, batch number, manufacturing date, expiry, quantity

### Stock In (`/inventory/stock-in`)
- Record incoming stock entries
- Select product + batch, enter quantity, supplier info, date

### Alerts (`/inventory/alerts`)
- Auto-generated list of low-stock and near-expiry items
- Configurable thresholds per product

---

## 6. Sales Module
### Orders (`/sales/orders`)
- Create sales order: select dealer, add line items (product, batch, qty, price)
- Order list with search, date range, dealer, and status filters
- Status tracking: Draft → Confirmed → Dispatched → Delivered

### Invoices (`/sales/invoices`)
- Generate GST-compliant invoice from confirmed orders
- Invoice fields: CGST, SGST, IGST, HSN, totals in words
- **Print-friendly layout** with company letterhead styling
- **PDF download** capability
- Invoice list with filters by dealer, date, payment status

### Returns (`/sales/returns`)
- Record sales returns against an invoice
- Adjust stock and financials automatically

---

## 7. Finance Module
### Ledger (`/finance/ledger`)
- Dealer-wise ledger showing all debits/credits
- Filter by dealer, date range

### Outstanding (`/finance/outstanding`)
- Summary of all unpaid invoices grouped by dealer
- Aging analysis (0–30, 30–60, 60–90, 90+ days)

### Payments (`/finance/payments`)
- Record payments received from dealers
- Link payment to invoices
- Payment mode: cash, bank transfer, cheque

---

## 8. Settings
### Company (`/settings/company`)
- Company profile: name, logo, address, GST number, bank details
- These details auto-populate on invoices

### User Management (admin-only)
- Add/remove employee users
- Assign roles

---

## 9. Backend (Supabase / Lovable Cloud)
- Full Supabase database with tables for: dealers, products, batches, stock_movements, orders, order_items, invoices, returns, payments, company_settings
- Row-Level Security on all tables
- Role-based access via `user_roles` table + `has_role()` helper function
- Edge function for PDF invoice generation

---

## Implementation Approach
We'll build this incrementally:
1. **Phase 1**: Layout, auth, dashboard, and masters (dealers + products)
2. **Phase 2**: Inventory module (batches, stock-in, alerts)
3. **Phase 3**: Sales module (orders, invoices with GST + PDF, returns)
4. **Phase 4**: Finance module (ledger, outstanding, payments)
5. **Phase 5**: Settings, role management, polish

