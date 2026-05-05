# Knowledge Overview: Raizechem Admin CI Workflow

This document captures the current status, decisions, and next steps for the Android CI workflow and related repo changes. It’s intended to provide context for future work (including with Claude) and to speed up onboarding for new contributors.

## 1) Context
- The goal: set up a Google Play App Signing-based Android App Bundle (AAB) workflow that builds from the web app (Capacitor wrapper) and pushes a signed AAB to Google Play Console Internal Testing.
- The repo contains two folders in this workspace: the outer repo (gouthamaravind/raizechem-admin) and an inner/embedded raizechem-admin that previously held the Android app structure. The plan was to flatten or properly land the workflow so Actions can run on main.

## 2) What was done today
- Added/attempted to land Android CI scaffolding on the outer repo:
  - Outer workflow file path: .github/workflows/android-release.yml
  - Path detector: scripts/detect-android-path.sh
  - Gradle signing glue for upload keystore: raizechem-admin/android/gradle/signing.gradle
  - Signing patch helper: raizechem-admin/android/build-signing-prepare.sh
  - Optional: PR helper: raizechem-admin/scripts/create-pr-android-release.sh
  - Optional: Release notes template: NOTES/ANDROID_RELEASE_TEMPLATE.md
- There were intermittent issues around a nested raizechem-admin subrepo (submodule-like) causing confusion when pushing to main. The recommended path is to flatten and land all Android CI files directly on the outer main.

## 3) Current repository state (summary)
- The outer repo main may still contain a nested raizechem-admin folder (subrepo). If so, either flatten or treat as submodule consistently.
- The Android CI workflow has been prepared and a patch was created on a branch ci/android-release and attempted to merge into main. As of now, main should contain .github/workflows/android-release.yml after a successful merge, and Actions should pick up the workflow.
- Secrets for the keystore must be provided in the outer repo: UPLOAD_KEYSTORE_BASE64, UPLOAD_KEYSTORE_PASSWORD, UPLOAD_KEY_ALIAS, UPLOAD_KEY_PASSWORD.

## 4) How to verify locally and in GitHub
- Local checks (you can run these in your shell):
  - git ls-tree -r HEAD --name-only | grep android-release.yml
  - git diff main..HEAD -- .github/workflows/android-release.yml  (to verify changes)
- GitHub checks:
  - Ensure Actions is enabled for the repo (Settings > Actions).
  - Open Actions tab and look for Build Android App Bundle. If not present, ensure the patch landed on main.
  - If using workflow_dispatch, click Run workflow and pick main.
- After run: download app-release.aab from the workflow artifact and upload to Google Play Console > Internal Testing.

## 5) Next steps (short)
- Finalize merge of the Android CI patch into main (if not already merged).
- Ensure the four keystore secrets exist in the outer repo settings.
- Trigger the workflow from Actions and validate that app-release.aab is produced.
- If everything works, we can plan the Lovable two-way sync as a separate task.

## 6) Secrets & security guidelines
- Do not commit keystores or credentials to the repo.
- Use GitHub Actions Secrets for UPLOAD_KEYSTORE_BASE64, UPLOAD_KEYSTORE_PASSWORD, UPLOAD_KEY_ALIAS, UPLOAD_KEY_PASSWORD.
- Follow least-privilege access for any credentials.

## 7) Access and collaboration notes
- This document is intended for general knowledge sharing and will be helpful when collaborating with Claude or any other assistant.
- If you need to regenerate the patch bundle, I can output a single patch file you can apply with one command.

## 8) Quick references
- Android CI patch content and scripts are located under:
- .github/workflows/android-release.yml
- scripts/detect-android-path.sh
- raizechem-admin/android/gradle/signing.gradle
- raizechem-admin/android/build-signing-prepare.sh
- NOTES/ANDROID_RELEASE_TEMPLATE.md
