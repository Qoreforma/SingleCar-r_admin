# Car Rental Admin

Internal operations console for the single-company car rental API.
React 18, TypeScript, Vite, Zustand, React Router, Axios, Tailwind.

## Run it

```bash
npm install
cp .env.example .env     # set VITE_API_BASE_URL (and VITE_API_PROXY_TARGET for dev)
npm run dev              # http://localhost:5173
npm run build            # typechecks, then builds to dist/
```

With `VITE_API_BASE_URL=/api/v1` and `VITE_API_PROXY_TARGET=http://your-backend`, the Vite dev server proxies
the API and you avoid CORS. For a deployed build, either serve the admin and API from one origin or allow the
admin origin in the API's CORS config.

If the backend is on another origin, expose these response headers or file downloads lose their names and row counts:
`Access-Control-Expose-Headers: Content-Disposition, X-Report-Row-Count`.

## Scope (production core mode)

Built: sign-in with MFA, password reset, invitation acceptance, dashboard and reports, settings, staff, audit log,
fleet and availability, customers, drivers, bookings (documents, notes, activity, driver, locations, status),
change requests, and payments (refunds, reconciliation, webhook events).

Deliberately not built, because they aren't mounted in core mode: admin content/promotions, support chat, leads,
notification-delivery retry. Webhooks are never called from the browser.

## Layout

```
src/
  api/          one module per API area; mirrors docs/openapi. client.ts handles auth + refresh rotation
  stores/       one Zustand store per domain; createPagedStore.ts is the shared list slice
  pages/        one folder per screen
  components/   ui/ (primitives), layout/ (shell, protected route)
  lib/          session policy, formatting, permissions, helpers
  types/        contract types
```

## Endpoint map

| Area | API module | Store | Screens |
|---|---|---|---|
| Auth (login, MFA, reset, invitation) | `api/auth.ts` | `authStore` | `pages/auth/*` |
| Dashboard and CSV reports | `api/dashboard.ts` | `dashboardStore` | `pages/dashboard` |
| Settings | `api/settings.ts` | `settingsStore` | `pages/settings` |
| Staff, audit logs | `api/staff.ts` | `staffStore` | `pages/staff` |
| Cars, availability, price history | `api/fleet.ts` | `fleetStore` | `pages/fleet` |
| Customers, sessions, export | `api/customers.ts` | `customersStore` | `pages/customers` |
| Bookings, documents, notes, change requests | `api/bookings.ts` | `bookingsStore` | `pages/bookings` |
| Drivers | `api/drivers.ts` | `driversStore` | `pages/drivers` |
| Payments, refunds, jobs, webhooks | `api/payments.ts` | `paymentsStore` | `pages/payments` |

## Behaviour that follows the stories doc

- Tokens: access token in memory; refresh token in `sessionStorage`. Change this in one file: `lib/session.ts`.
  Refresh rotation is single-flight so parallel 401s never reuse a rotated token.
- MFA enrolment shows a QR (rendered locally) and the key; recovery codes appear once, and the app stays locked
  until the operator confirms they saved them.
- Server state wins. After every booking mutation the booking is re-read; `409`/`422` show "this record changed"
  with a reload button. `expected_version` always comes from the last-read record.
- Refunds: two-step review, amount in major units converted to integer minor units without floating point,
  idempotency key reused on retry while the details are unchanged, 202 shown as pending, never as complete.
- Money is formatted with the currency the API returned; no balances are recalculated in the browser.
- Reports and exports are file downloads. Customer data export goes straight to disk and is never kept in state.
- Secret-looking keys in settings are dropped before they reach state and are never sent back.

## Check these against the live API

The API reference types many payloads as free-form objects, so these are my best reading. Each is isolated:

1. **Record field names** for bookings, cars, customers, documents, activity and notes are read through accessors
   that try likely names. Adjust `pages/bookings/bookingHelpers.ts`, `pages/fleet/carHelpers.ts`, and the column
   definitions in `pages/customers/Customers.tsx` once you see real payloads. The detail views also render every
   field generically, so nothing is hidden meanwhile.
2. **`version`** is assumed to be the field behind `expected_version` on cars, bookings and drivers (`lib/helpers.ts: getVersion`).
3. **Settings save** sends each changed top-level section whole (for example all of `booking_policies`). If your
   backend replaces nested objects, that's what you want; if it merges, it's still safe.
4. **Car pricing and spec fields** are edited as free-form key/value rows, because their shape isn't in the contract.
   Hints come from existing cars.
5. **Permissions**: only `documents:review`, `bookings:notes`, `bookings:locations`, `bookings:manage` are named in the
   docs, and owners are treated as having all of them (`lib/permissions.ts`). Navigation isn't gated by permission;
   a 403 shows a "permission denied" state. Add checks as you learn the permission names.
6. **Dates**: date pickers send UTC day boundaries; date-time pickers use the browser's local time.
7. **Staff list** only has `is_active`, so invitation-accepted state can't be shown.
8. **Availability block release** has no request body in the contract, so no reason is sent.
