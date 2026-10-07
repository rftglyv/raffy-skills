#!/bin/sh
# Build RaffyBar.app (menu-bar only, no Dock icon) into native/build/.
# Usage: sh native/build.sh   then   open native/build/RaffyBar.app
set -e
cd "$(dirname "$0")/RaffyBar"
swift build -c release
APP=../build/RaffyBar.app
rm -rf "$APP" && mkdir -p "$APP/Contents/MacOS"
cp .build/release/RaffyBar "$APP/Contents/MacOS/RaffyBar"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>RaffyBar</string>
  <key>CFBundleIdentifier</key><string>dev.raffy.bar</string>
  <key>CFBundleExecutable</key><string>RaffyBar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST
echo "built $(cd .. && pwd)/build/RaffyBar.app"
