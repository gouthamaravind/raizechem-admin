#!/usr/bin/env bash
set -euo pipefail

ANDROID_DIR="$(pwd)/android"
BUILD_FILE="$ANDROID_DIR/app/build.gradle"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "Android dir not found at $ANDROID_DIR (expected ./android). Skipping signing patch."
  exit 0
fi

if [ -f "$BUILD_FILE" ]; then
  if grep -q "apply from: \"gradle/signing.gradle\"" "$BUILD_FILE"; then
    echo "Signing config already applied."
  else
    echo "Applying signing.gradle to Gradle build."
    # Try to apply the signing.gradle script located at android/gradle/signing.gradle
    echo 'apply from: "gradle/signing.gradle"' >> "$BUILD_FILE"
  fi
else
  echo "Build.gradle not found at $BUILD_FILE. Will apply on first generated Gradle file."
fi
