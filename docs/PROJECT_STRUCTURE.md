# Finance Tracker Project Structure

This project has three working layers:

```text
finance-tracker-mobile/
  App.js                    Mobile/Web UI entry
  src/
    api/                    HTTP client for the local API
    core/                   Pure ledger business logic
    data/                   Categories and sample notification text
    parsers/                Notification text parser
    storage/                Device local storage fallback
    utils/                  CSV import/export helpers
  apps/
    api/                    Local backend API
      src/server.js         Express server
      src/db.js             Local auth and encrypted JSON ledger access
      data/users.json       Local user records and password hashes
      data/ledgers/         Per-user encrypted ledger files
  android/                  Android native project and notification listener
  scripts/                  Local debug and Android helper scripts
  tests/                    Parser and ledger unit tests
```

## Local Debug Flow

Start the local backend and web frontend:

```powershell
cd D:\CodexOutputs\d-app-ppt\finance-tracker-mobile
npm run dev:local
```

Then open:

```text
Frontend: http://127.0.0.1:8082
API:      http://127.0.0.1:4010
Health:   http://127.0.0.1:4010/health
```

The local API stores user metadata and encrypted ledger files:

```text
D:\CodexOutputs\d-app-ppt\finance-tracker-mobile\apps\api\data\users.json
D:\CodexOutputs\d-app-ppt\finance-tracker-mobile\apps\api\data\ledgers\
```

Seed test data:

```powershell
npm run api:seed
```

Run tests:

```powershell
npm test
```

Stop local services:

```powershell
npm run dev:stop
```

## API Endpoints

```text
GET    /health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/debug/parse-notification
POST   /api/debug/inject-notification
POST   /api/debug/reset
```

## Current Reality

The browser-visible local app can register/login to a local account, create manual transactions, simulate parsed notifications, paste historical bill text, review pending transactions, confirm or ignore entries, search rows, and import/export CSV. It talks to a real local Express API and persists each user's ledger in an AES-256-GCM encrypted JSON file on disk.

The Android project contains a real `NotificationListenerService`, but the end-to-end phone flow still needs physical-device verification after installing a fresh APK. This project does not connect to Alipay, WeChat, bank, or broker account backends.
