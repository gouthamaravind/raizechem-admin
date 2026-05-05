#!/usr/bin/env bash
set -euo pipefail

# Path to the app's build.gradle
BUILD_FILE="android/app/build.gradle"

if [ ! -f "$BUILD_FILE" ]; then
    echo "Error: $BUILD_FILE not found. Make sure 'npx cap add android' has run."
    exit 1
fi

# Ensure the gradle directory exists
mkdir -p android/app/gradle

# Copy the signing.gradle template
# Assumes the script is run from root and signing.gradle is in scripts/
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
