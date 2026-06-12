# Finance Tracker Mobile

Android-first personal finance tracker for local manual accounting, CSV import/export, and user-authorized Android notification capture.

## What works in v0.1

- Manual transaction entry.
- Pending transaction review before saving.
- Local storage on device.
- CSV import/export.
- Notification text parser for WeChat, Alipay, bank, and broker-style messages.
- Android native `NotificationListenerService` source and Expo config plugin for development builds.

## Privacy and platform boundaries

This app does not collect account passwords, does not read private data from other apps, and does not bypass WeChat, Alipay, bank, or broker restrictions. Notification capture only works after the user grants Android notification access in system settings, and it can only capture new posted notifications.

Cloud sync is intentionally not enabled in this version. The app is local-first to avoid paid infrastructure and reduce sensitive-data exposure.

## Run later

The current workspace has no installed dependencies for this new project. Installing dependencies or building Android may write caches or SDK files outside this folder, possibly on `C:\`; ask for approval before doing that.

```powershell
cd D:\CodexOutputs\d-app-ppt\finance-tracker-mobile
npm install
npm run prebuild
npm run android
```

Parser-only tests:

```powershell
npm run test:parsers
```

## Android notification listener

After `expo prebuild --platform android`, the config plugin adds:

- `FinanceNotificationListenerService`
- `FinanceNotificationModule`
- `FinanceNotificationPackage`
- Android manifest service registration

The app will show a button to open notification listener settings. Once enabled, captured notifications appear in the pending review list.
