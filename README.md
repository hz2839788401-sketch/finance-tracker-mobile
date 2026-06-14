# Finance Tracker Mobile

Android-first personal finance tracker for local manual accounting, CSV import/export, and user-authorized Android notification capture.

## What works now

- Local web frontend for PC debugging.
- Local Express API on `http://127.0.0.1:4010`.
- Local user registration/login.
- Encrypted per-user ledger files under `apps/api/data/ledgers`.
- Manual transaction entry.
- Pending transaction review before confirming into the ledger.
- Search and status filters.
- CSV import/export.
- Historical bill text paste/import for lines of notification-style records.
- Notification text parser for common WeChat, Alipay, bank, and broker-style notification messages.
- Android native `NotificationListenerService` source and config plugin.

## Privacy and platform boundaries

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
