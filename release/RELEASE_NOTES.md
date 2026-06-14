# Finance Tracker APK v0.2.0

## Current build

APK:

```text
D:/CodexOutputs/d-app-ppt/finance-tracker-mobile/release/finance-tracker-standalone.apk
```

Size: ~61.7 MB

Built: 2026-06-14T12:08:51.026Z

## Changes in v0.2.0

- Animated in-app splash screen on startup
- Phone standalone unlock: device-local password (SecureStore), no PC API required
- PC browser debugging still uses local Express API on port 4010
- Native Android splash updated (dark theme + logo orb)

## Install

1. Copy `finance-tracker-standalone.apk` to your Android phone
2. Install and open the app
3. Create a device password on first launch
4. Grant notification access in system settings for notification sync

## Limits

- Debug-signed APK for local testing, not Play Store production signing
- Notification capture requires Android notification listener permission
- Does not connect to WeChat/Alipay/bank official APIs
