#!/usr/bin/env bash
set -euo pipefail

MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: $MANIFEST_FILE not found."
    exit 1
fi

echo "Patching AndroidManifest.xml with required permissions..."

# List of permissions to add
PERMISSIONS=(
    "android.permission.ACCESS_COARSE_LOCATION"
    "android.permission.ACCESS_FINE_LOCATION"
    "android.permission.ACCESS_BACKGROUND_LOCATION"
    "android.permission.FOREGROUND_SERVICE"
    "android.permission.INTERNET"
)

# Add permissions before the <application> tag if they don't exist
for PERM in "${PERMISSIONS[@]}"; do
    if ! grep -q "$PERM" "$MANIFEST_FILE"; then
        echo "Adding permission: $PERM"
        sed -i "/<application/i \    <uses-permission android:name=\"$PERM\" />" "$MANIFEST_FILE"
    fi
done

# Ensure location hardware features are declared
if ! grep -q "android.hardware.location.gps" "$MANIFEST_FILE"; then
    sed -i "/<application/i \    <uses-feature android:name=\"android.hardware.location.gps\" android:required=\"false\" />" "$MANIFEST_FILE"
fi

echo "Manifest patching complete."
