#!/usr/bin/env bash
set -euo pipefail

HEAD_BRANCH="${1:-ci/android-release}"
BASE_BRANCH="${2:-main}"

REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$REPO" ]; then
  echo "GITHUB_REPOSITORY not set. Exiting." >&2
  exit 0
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not installed. Skipping PR creation." >&2
  exit 0
fi

TITLE="Android Release CI: $HEAD_BRANCH -> $BASE_BRANCH"
BODY=$(cat <<'EOF'
## Automated Release
- CI built Android AAB for internal testing track.
- This PR contains the Android Gradle signing wiring and CI steps.

Notes:
- Upload the produced AAB from CI artifacts to Google Play Console Internal testing track.
EOF
)

gh pr create --title "$TITLE" --body "$BODY" --head "$HEAD_BRANCH" --base "$BASE_BRANCH" --repo "$REPO" || true
