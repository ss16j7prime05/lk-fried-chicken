# LK Fried Chicken

Production food-ordering system: React + Vite frontend, Firebase backend (Authentication, Firestore, Storage, Cloud Functions), Google Maps (Leaflet/OSRM/Nominatim), PromptPay payments, and LINE Official Account notifications.

## Project Structure

```
src/
  App.jsx                 Customer ordering page (menu, cart, checkout)
  TrackOrder.jsx           Customer order tracking page (/track)
  CustomerOrderHistory.jsx Customer order history (/history)
  Store.jsx, StoreDashboard.jsx, StoreMenu.jsx   Legacy store pages
  Rider.jsx, RiderProfile.jsx                    Legacy rider pages
  Admin.jsx, AdminDashboard.jsx                  Legacy admin pages

  AuthContext.jsx          Firebase Auth state + Firestore users/{uid} profile
  ProtectedRoute.jsx        Role + approval-status route guard
  firebase.js               Firebase app init (single hardcoded config)
  config.js                  App-wide constants (STORE_ID, PromptPay number, etc.)

  login/                     Login.jsx (unified, role-tab login) + legacy per-role login pages
  register/                  RegisterCustomer/Store/Rider.jsx (current registration flow)
  signup/                    Legacy store/rider signup pages

  store/                     Store Dashboard v2 (realtime orders, OrderCard, status pipeline)
  rider/                     Rider Dashboard v2 (accept/deliver flow, GPS tracking)
  admin/                     Admin Control Center (stats, approvals, payments, reports)
  location/                  LocationPicker/DeliveryMap/MapButton (delivery address selection)
  tracking/                  LiveMap/RiderMarker/CustomerMarker/StoreMarker/ETABox/TrackingPanel
  payment/                   PromptPayQR/PaymentStatusBadge/paymentUtils

functions/
  index.js                   Cloud Functions entry (re-exports below)
  firebaseAdmin.js            Single Admin SDK bootstrap
  orderNotification.js        Firestore triggers -> LINE notifications (8 order events)
  lineWebhook.js               Signature-verified LINE webhook endpoint
  services/lineNotificationService.js   Reusable LINE push + retry + logging + signature verify

firestore.rules    Firestore security rules
storage.rules       Firebase Storage security rules
vercel.json          SPA rewrite + build config for Vercel
```

## Installation

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
npm run lint
```

No `.env` file is needed — Firebase config is hardcoded in `src/firebase.js` (same project for local dev and production, so there's nothing to keep in sync between environments).

## Roles & Routes

| Role | Login redirect | Approval required |
|---|---|---|
| Customer | `/customer` | No (`status: "active"` set automatically at registration) |
| Store | `/store` | Yes (`status: "pending"` until an admin approves) |
| Rider | `/rider` | Yes (`status: "pending"` until an admin approves) |
| Admin | `/admin` | No (`status: "active"`, created manually — no public admin registration) |

Login is unified at `/login` (role tabs). Registration is at `/register` (chooser) → `/register/customer`, `/register/store`, `/register/rider`. There is no admin registration page by design.

Every `users` document is keyed by the real Firebase Auth UID (`users/{auth.uid}`) — never a hardcoded ID like `admin_0001`. Login always reads `users/{auth.currentUser.uid}`, never queries by email.

## Firebase Setup

1. Create a Firebase project with **Authentication** (Email/Password provider), **Firestore**, and **Storage** enabled.
2. Copy the Web App config into `src/firebase.js` (`firebaseConfig` object).
3. Deploy rules: `firebase deploy --only firestore:rules,storage`.
4. Create the first admin manually in the Firebase Console: Authentication → add a user → copy its UID → Firestore `users/{uid}` → set `{ uid, email, role: "admin", status: "active", name, phone, createdAt }`. There is no UI for this (admin self-registration is intentionally disabled).
5. (Optional, for a store's coordinates) set `lat`/`lng`/`storeName`/`isOpen`/`lineGroupId` on `stores/{STORE_ID}` (`STORE_ID` is defined in `src/config.js`).

## Google Maps Setup

No API key required — the app uses [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles, [OSRM](http://project-osrm.org/) for road-routing distance/duration, and [Nominatim](https://nominatim.org/) for address search/geocoding (all public, free, no key). See `src/location/locationUtils.js`.

## LINE OA Setup

1. Create a LINE Official Account + Messaging API channel in the [LINE Developers Console](https://developers.line.biz/).
2. Set Cloud Functions environment variables before deploying (`functions/` directory):
   - `LINE_CHANNEL_ACCESS_TOKEN` — channel access token
   - `LINE_CHANNEL_SECRET` — channel secret (used to verify webhook signatures)
   - `STORE_LINE_USER_ID` — fallback LINE userId/groupId for the store if `stores/{id}.lineGroupId` isn't set
   - `TRACK_BASE_URL`, `STORE_DASHBOARD_URL` — links included in notification messages
3. Deploy: `firebase deploy --only functions`.
4. In the LINE Developers Console, set the webhook URL to the deployed `lineWebhook` function URL (used only to satisfy LINE's webhook-verification requirement — this app sends notifications one-way and does not process inbound messages, Rich Menu, LINE Login, or broadcasts).
5. Customers need a `lineUserId` on their `users` doc to receive notifications (set during registration/login if provided); stores need `lineGroupId` on `stores/{id}` (set manually, no UI).

## PromptPay

Set `PROMPTPAY_ID` and `PROMPTPAY_ACCOUNT_NAME` in `src/config.js`. QR codes are generated via the public [promptpay.io](https://promptpay.io) image API (real EMV-standard PromptPay QR, no dependency required).

## Deployment (Vercel)

`vercel.json` pins `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`, and a catch-all SPA rewrite (`/(.*) -> /index.html`) so client-side routes work on direct load/refresh.

```bash
git push origin <branch>
```

If the Vercel project is connected to this GitHub repo, pushing triggers an automatic deploy. No environment variables need to be set in Vercel — Firebase config is hardcoded identically for every environment.

## Security Notes

- `firestore.rules`: every user can read/write only their own `users/{uid}` document; only `role == "admin"` can change another user's `status` (approve/reject) — self-registration can only set `status` to `"active"` (customer) or `"pending"` (store/rider), never `"approved"` directly.
- Orders, menus, and store-document writes for `store`/`rider` roles require an approved (or pre-existing legacy, i.e. no `status` field) account.
- `storage.rules`: uploaded application documents (`applications/{role}/{uid}/{file}`) can only be written by the owning UID.
