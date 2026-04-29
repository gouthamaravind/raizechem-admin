# Android App Development Prompt — RaizeChem Field Sales

## Project Context

You are building a native Android app using **Capacitor** for RaizeChem, a chemical distribution company. The app is for **field sales staff** who visit dealers, take orders, collect payments, and track their daily duty sessions with GPS.

The **backend already exists** — it's a remote Supabase project. Do NOT create any local backend, server, or database. Everything connects to the existing remote backend.

## Backend Connection Details

- **Supabase URL:** `https://tjjpzpqwemyfbgdaijee.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqanB6cHF3ZW15ZmJnZGFpamVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjMyNTIsImV4cCI6MjA4NzIzOTI1Mn0.SVPcUkMcgZi3MbL4DZES9B2aj-FYzXA6VwdXk2yfm5w`
- **Edge Functions Base:** `https://tjjpzpqwemyfbgdaijee.supabase.co/functions/v1/`

The Supabase client is already configured in `src/integrations/supabase/client.ts` — **DO NOT modify this file**. Import it as:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

## Capacitor Config

The file `capacitor.config.ts` already exists:

- appId: com.raizechem.field
- appName: RaizeChem Field
- webDir: dist
- Server URL (dev): https://3c3f2d47-de20-480f-9a64-bf9a542e34cb.lovableproject.com?forceHideBadge=true

For production builds, remove/comment out the server.url so the app loads from the local dist/ bundle.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Framework | React 18 + TypeScript 5 + Vite 5 |
| UI | Tailwind CSS v3 + shadcn/ui |
| State | TanStack React Query v5 |
| Routing | React Router v6 |
| Mobile | Capacitor 8 (@capacitor/core, @capacitor/android) |
| Auth | Supabase Auth (email/password only, @raizechem.in domain) |
| Backend | Remote Supabase (Postgres + Edge Functions) |

## Authentication

- Email/password only — restricted to @raizechem.in domain
- No OAuth, no anonymous signups
- Test credentials: admin@raizechem.in / Admin@Raize123
- Auth state managed via `src/hooks/useAuth.tsx`
- Mobile login page: `src/pages/mobile/MobileLogin.tsx`
- Mobile auth guard: `src/components/mobile/MobileGuard.tsx`

## Mobile Routes (already exist at /m/*)

| Route | Page | Purpose |
| --- | --- | --- |
| /m/login | MobileLogin | Login screen |
| /m/home | MobileHome | Dashboard with today's summary |
| /m/duty | MobileDuty | Start/stop duty session |
| /m/dealers | MobileDealers | Browse assigned dealers |
| /m/orders | MobileOrders | View field orders |
| /m/orders/new | MobileNewOrder | Create field order |
| /m/payments | MobilePayments | View field payments |
| /m/payments/new | MobileNewPayment | Record payment collection |
| /m/checkin | MobileCheckin | Check in at dealer |
| /m/checkout | MobileCheckout | Check out from dealer |

## Mobile Layout

`src/components/mobile/MobileLayout.tsx` — provides header + bottom nav bar with tabs: Home, Duty, Dealers, Orders, Payments.

## Field Operations API

All field ops go through the edge function at `fieldops`. The hook `src/hooks/useFieldOps.tsx` wraps all calls:

```typescript
const { startDuty, stopDuty, addLocations, checkinVisit, checkoutVisit, createFieldOrder, recordPayment, getTodaySummary } = useFieldOps();
```

Available Actions (POST to `/functions/v1/fieldops?action=<action>`):

| Action | Method | Body | Purpose |
| --- | --- | --- | --- |
| start-duty | POST | { lat, lng, tracking_mode } | Start duty session |
| stop-duty | POST | { session_id, lat, lng } | End duty session |
| add-locations | POST | { session_id, points: [{lat, lng, accuracy, recorded_at}] } | GPS breadcrumbs |
| checkin-visit | POST | { dealer_id, session_id, lat, lng, notes } | Check in at dealer |
| checkout-visit | POST | { visit_id, lat, lng, notes, photo_url } | Check out from dealer |
| create-field-order | POST | { dealer_id, session_id, items: [{product_id, qty, expected_rate}], notes, requested_delivery_date } | Create order |
| record-payment | POST | { dealer_id, amount, mode, reference_no, payment_date, notes, attachment_url } | Record payment |
| today-summary | GET | — | Get today's stats |

All requests require Authorization header with user's JWT token. The `useFieldOps` hook handles this automatically.

## Key Database Tables (relevant to mobile)

- duty_sessions — duty punch in/out with GPS
- location_points — GPS breadcrumb trail
- dealer_visits — check-in/out at dealers
- field_orders / field_order_items — orders placed in field (pending admin approval)
- field_payments — payments collected in field
- dealers — dealer master data
- products — product catalog
- profiles — user profiles (name, email)

## What Needs to Be Built/Improved

1. Native Capacitor Plugins to Add

```
npm install @capacitor/geolocation @capacitor/camera @capacitor/filesystem @capacitor/local-notifications @capacitor/status-bar @capacitor/splash-screen @capacitor/app @capacitor/haptics @capacitor/network
```

2. Background GPS Tracking
- When duty is active, track GPS in background every 30 seconds
- Use @capacitor/geolocation watchPosition
- Batch-send points every 2 minutes via addLocations()
- Handle poor connectivity — queue points locally and sync when online
- Consider using @capawesome/capacitor-background-task or @transistorsoft/capacitor-background-geolocation for reliable background tracking on Android

3. Offline Support
- Cache dealer list, product list locally (IndexedDB or SQLite)
- Queue field orders and payments when offline
- Auto-sync when connectivity returns
- Show sync status badge (`src/components/mobile/SyncBadge.tsx` exists)
- Use @capacitor/network to detect online/offline state

4. Camera Integration
- Photo capture during dealer checkout (proof of visit)
- Upload to Supabase Storage bucket
- Attach URL to visit record via checkout-visit action

5. UI/UX Improvements for Mobile
- All mobile pages are under `src/pages/mobile/`
- Use MobileLayout wrapper for consistent header + bottom nav
- Design for touch — large tap targets (min 44px), swipe gestures
- Pull-to-refresh on list pages
- Loading skeletons for data fetching
- Safe area handling for notched devices (`.safe-bottom` class exists)

6. Push Notifications (Future)
- When field order is approved/rejected by admin
- Payment confirmation
- Use Supabase Realtime or FCM

## Build & Deploy Commands

```bash
# Development (hot-reload from Lovable server)
npm run build
npx cap sync
npx cap run android

# Production build (standalone APK)
# 1. Remove server.url from capacitor.config.ts
# 2. Build and sync
npm run build
npx cap sync
# 3. Open in Android Studio
npx cap open android
# 4. Build APK/AAB from Android Studio
```

## File Structure Reference

```
src/
├── components/mobile/
│   ├── MobileGuard.tsx      # Auth guard
│   ├── MobileLayout.tsx     # Layout with bottom nav
│   └── SyncBadge.tsx        # Offline sync indicator
├── hooks/
│   ├── useAuth.tsx          # Auth context
│   ├── useFieldOps.tsx      # Field operations API
│   └── useBranch.tsx        # Branch context
├── pages/mobile/
│   ├── MobileLogin.tsx
│   ├── MobileHome.tsx
│   ├── MobileDuty.tsx
│   ├── MobileCheckin.tsx
│   ├── MobileCheckout.tsx
│   ├── MobileDealers.tsx
│   ├── MobileNewOrder.tsx
│   ├── MobileNewPayment.tsx
│   ├── MobileOrders.tsx
│   └── MobilePayments.tsx
└── integrations/supabase/
    ├── client.ts            # ⚠️ DO NOT EDIT
    └── types.ts             # ⚠️ DO NOT EDIT
```

## Critical Rules

- DO NOT edit `src/integrations/supabase/client.ts` or `types.ts` — auto-generated
- DO NOT edit `.env` — auto-managed
- DO NOT create local backend servers — use the remote Supabase
- DO NOT modify edge functions locally — they deploy from the Lovable platform
- Use Tailwind semantic tokens (`bg-primary`, `text-foreground`) — never hardcode colors
- All mobile routes must be under `/m/*`
- Wrap all mobile pages with `<MobileGuard>` and `<MobileLayout>`
- Use `sonner` for toast notifications: `import { toast } from "sonner"`
- Use TanStack React Query for all data fetching
- Test with `admin@raizechem.in / Admin@Raize123`

## Roles

Roles: admin, sales, warehouse, accounts, inventory, fieldops. Field staff will have the fieldops role. The role check uses `has_role()` DB function. Module access is defined in `src/types/roles.ts`.

---

**Save this prompt and refer to it when implementing Android field app tasks.**
