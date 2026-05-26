# Raizechem Migration & Android Asset Details

This document contains critical information required for migrating the Raizechem ERP from Lovable/Supabase to Google Cloud Platform (GCP) and preserving the Android field app.

---

## 1. Company Details
*   **Company Name**: Raizechem Pvt Ltd
*   **Legal Name**: (Refer to Settings -> Company in UI)
*   **Industry**: Chemical Distribution ERP
*   **Primary GSTIN**: (Configured in Whitebooks secrets)
*   **Domain**: `@raizechem.in` (Used for restricted Auth)

---

## 2. Android App Bundle (AAB) Details
*   **App Name**: RaizeChem Field
*   **Package Name (App ID)**: `com.raizechem.field`
*   **Current Version**: 1.1.5
*   **Development Framework**: Capacitor (React/Ionic)
*   **Platform**: Android

### Critical Android Files to Preserve
| File | Current Location | Importance |
| :--- | :--- | :--- |
| **`upload.keystore`** | `android/app/` (or GitHub Secrets) | **CRITICAL**. Required to sign and update the app on Google Play Store. |
| **`google-services.json`** | `android/app/` | Required for Firebase/Push Notifications/GCP connectivity. |
| **`capacitor.config.ts`** | Root directory | Defines the App ID and build configuration. |
| **`scripts/` folder** | Root directory | Contains build automation and manifest patching scripts. |
| **`signing.gradle`** | `scripts/` | Defines how the Gradle build handles environment secrets. |

---

## 3. Migration Roadmap to GCP

### Phase 1: Frontend Hosting
*   **Action**: Move from Lovable hosting to **Google Cloud Storage (GCS)** + **Cloud CDN**.
*   **Steps**:
    1.  `npm run build` to generate the `dist/` folder.
    2.  Create a GCS bucket (e.g., `raizechem-admin-web`).
    3.  Configure bucket for Static Website Hosting.
    4.  Point your domain (GCP Cloud DNS) to the bucket via a Load Balancer with SSL.

### Phase 2: Database Migration
*   **Action**: Move from Supabase Postgres to **Google Cloud SQL (Postgres)**.
*   **Steps**:
    1.  Provision a Cloud SQL instance (Postgres 15+).
    2.  Export data from Supabase via `pg_dump`.
    3.  Apply migrations from `supabase/migrations/` to the new instance.
    4.  Update connection strings in Secret Manager.

### Phase 3: Backend Logic (Functions)
*   **Action**: Convert Supabase Edge Functions to **Google Cloud Functions**.
*   **Key Functions to Port**:
    *   `whitebooks-ewaybill` (E-Way Bill integration)
    *   `fieldops` (Mobile sync and tracking)
    *   `generate-pdf` (Invoice rendering)

### Phase 4: Authentication
*   **Action**: Transition from Supabase Auth to **Firebase Auth** or **Identity Platform**.
*   **Note**: Requires updating the `useAuth` hook and Supabase Client initialization in the frontend.

---

## 4. Required Secrets for GCP Secret Manager
*   `DATABASE_URL`: Postgres connection string.
*   `WHITEBOOKS_CLIENT_ID` / `CLIENT_SECRET`: For E-Way Bills.
*   `UPLOAD_KEYSTORE_PASSWORD`: For Android builds.
*   `SUPABASE_SERVICE_ROLE_KEY`: (Until fully replaced by Cloud IAM).
