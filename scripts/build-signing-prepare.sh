#!/usr/bin/env bash
set -euo pipefail

# Arguments
VERSION_NAME="${1:-1.0.0}"
VERSION_CODE="${2:-1}"

# Path to the app's build.gradle
BUILD_FILE="android/app/build.gradle"

if [ ! -f "$BUILD_FILE" ]; then
    echo "Error: $BUILD_FILE not found. Make sure 'npx cap add android' has run."
    exit 1
fi

echo "Patching version info: Name=$VERSION_NAME, Code=$VERSION_CODE"
# Patch versionCode and versionName
# Matches: versionCode 1  -> versionCode <VERSION_CODE>
# Matches: versionName "1.0" -> versionName "<VERSION_NAME>"
sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$BUILD_FILE"
sed -i "s/versionName \".*\"/versionName \"$VERSION_NAME\"/" "$BUILD_FILE"

# Ensure the gradle directory exists
mkdir -p android/app/gradle

# Copy the signing.gradle template
if [ -f "scripts/signing.gradle" ]; then
    cp scripts/signing.gradle android/app/gradle/signing.gradle
else
    echo "Error: scripts/signing.gradle not found."
    exit 1
fi

# Patch build.gradle if not already patched
if grep -q "apply from: \"gradle/signing.gradle\"" "$BUILD_FILE"; then
    echo "Signing config already applied to $BUILD_FILE"
else
    echo "Applying signing.gradle to $BUILD_FILE"
    echo "" >> "$BUILD_FILE"
    echo "apply from: \"gradle/signing.gradle\"" >> "$BUILD_FILE"
fi

echo "Signing preparation complete."
