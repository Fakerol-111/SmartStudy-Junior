#!/bin/bash
# Build Android APK for SmartStudy
# Usage: ./build-android.sh

set -e

cd "$(dirname "$0")"

echo "=== 1. 生成 JS Bundle ==="
npx expo export:embed \
  --platform android \
  --dev false \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

echo ""
echo "=== 2. 构建 APK ==="
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.18.8-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="/c/Users/13008/android-sdk"

cd android
./gradlew assembleDebug

echo ""
echo "=== 完成 ==="
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
