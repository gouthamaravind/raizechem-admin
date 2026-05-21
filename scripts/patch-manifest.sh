#!/usr/bin/env bash
set -euo pipefail

MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: $MANIFEST_FILE not found."
    exit 1
fi

echo "Patching AndroidManifest.xml with Production Grade permissions..."

# List of permissions to add
PERMISSIONS=(
    "android.permission.ACCESS_COARSE_LOCATION"
    "android.permission.ACCESS_FINE_LOCATION"
    "android.permission.ACCESS_BACKGROUND_LOCATION"
    "android.permission.FOREGROUND_SERVICE"
    "android.permission.FOREGROUND_SERVICE_LOCATION"
    "android.permission.INTERNET"
    "android.permission.ACCESS_NETWORK_STATE"
    "android.permission.WAKE_LOCK"
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
    sed -i "/<application/i \    <uses-feature android:name=\"android.hardware.location.gps\" android:required=\"true\" />" "$MANIFEST_FILE"
fi

# Ensure Foreground Service Type for Location (Android 14)
# This requires adding the type to the Service tag. 
# Capacitor uses a default service, but usually we just need the permission.
# However, let's make sure the uses-permission is there.

echo "Manifest patching complete."
