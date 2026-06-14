# Finance Tracker Mobile

Android-first personal finance tracker for local manual accounting, CSV import/export, and user-authorized Android notification capture.

## What works now

- Animated startup splash screen.
- **Phone standalone unlock**: device password stored in SecureStore; no PC API required on Android.
- **PC browser debugging** via local web frontend + Express API.
- Local Express API on `http://127.0.0.1:4010` (web login / encrypted ledgers).
- Manual transaction entry, pending review, CSV import/export, bill text import.
- Notification text parser for WeChat, Alipay, bank, and broker-style messages.
- Android `NotificationListenerService` for notification sync on real devices.

## Phone vs PC login

| Platform | Login | Data storage |
|----------|-------|--------------|
| Android APK | Create/unlock with device password | SecureStore on phone |
| PC browser (`npm run dev:local`) | Register/login against local API | Encrypted JSON under `apps/api/data/` |

## Download release APK

Prebuilt APK is in the repo:

```text
release/finance-tracker-standalone.apk
```

Rebuild locally (Windows: source `scripts/env.ps1` if Gradle cannot find JDK/SDK):

```powershell
. .\scripts\env.ps1
npm run release:android
```

## Local debugging (PC)

This app does not collect account passwords, does not read private data from other apps, and does not bypass WeChat, Alipay, bank, or broker restrictions. Notification capture only works after the user grants Android notification access in system settings, and it can only capture new posted notifications.

Cloud sync is intentionally not enabled in this version. The app is local-first to avoid paid infrastructure and reduce sensitive-data exposure.

The local API password is used to derive the encrypted ledger key. User metadata stores PBKDF2 password hashes, while transaction rows are stored in AES-256-GCM encrypted files. This protects the local JSON ledger from casual plaintext inspection, but it is not a replacement for a full production security review.

## Local debugging

```powershell
cd D:\CodexOutputs\d-app-ppt\finance-tracker-mobile
npm run dev:local
```

Open the frontend:

```text
http://127.0.0.1:8082
```

Seed test data:

```powershell
npm run api:seed
```

Run tests:

```powershell
npm test
```

Stop services:

```powershell
npm run dev:stop
```

## Android notification listener

The Android project includes:

- `FinanceNotificationListenerService`
- `FinanceNotificationModule`
- `FinanceNotificationPackage`
- Android manifest service registration

The app has a button to open notification listener settings. Once enabled on a real Android phone, captured notifications should be read into the pending review list. That phone flow still needs fresh APK installation and real-device verification.
