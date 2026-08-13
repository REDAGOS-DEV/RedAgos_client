# RedAgos Client

Frontend for the **RedAgos Blood Request and Inventory Management System** — a Nuxt 4 single-page application serving donors, hospitals, and blood centers.

This is the client only. It is a pure API consumer and does **not** run without the [RedAgos backend](#backend-api) (Laravel + Sanctum) running alongside it.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [API Service Layer](#api-service-layer)
  - [Authentication](#authentication)
  - [State Management](#state-management)
  - [Styling](#styling)
- [User Roles & Routes](#user-roles--routes)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

RedAgos connects three parties in the blood supply chain:

- **Donors** register, check eligibility, book appointments, and track their donation history.
- **Hospitals** submit blood requests, track fulfillment, and check availability.
- **Blood centers** manage inventory, review incoming requests, run donation drives, and report on activity.

Each role gets its own authentication flow, dashboard layout, and route namespace.

## Tech Stack

| Concern | Choice |
| --- | --- |
| Framework | Nuxt 4 (Vue 3, Vue Router 5) |
| Language | TypeScript + JavaScript (mixed; see [conventions](#development-workflow)) |
| Styling | Tailwind CSS via `@nuxtjs/tailwindcss` |
| HTTP | Nuxt's built-in `$fetch`, wrapped by a `BaseService` class |
| State | Nuxt `useState` composables |
| Package manager | npm |

> **Note:** this project deliberately uses no external state or HTTP library. There is no Pinia and no Axios — reach for `useState` and `$fetch` respectively.

## Prerequisites

- **Node.js** `^22.12.0 || ^24.11.0 || >=26.0.0` (the repo pins `24.11.0` in [.nvmrc](.nvmrc) — run `nvm use` if you use nvm)
- **npm** (ships with Node)
- A running **RedAgos backend API** — see [Backend API](#backend-api)

### Backend API

The client expects the Laravel backend from the `RedAgos_server` repository, reachable at the URL in `API_BASE_URL`. Start it before the client:

```bash
cd ../RedAgos_server
php artisan serve   # defaults to http://127.0.0.1:8000
```

## Getting Started

```bash
# 1. Clone
git clone <repository-url>
cd RedAgos_client

# 2. Configure environment
cp .env.example .env     # Windows PowerShell: copy .env.example .env

# 3. Install dependencies
npm install

# 4. Run the dev server
npm run dev
```

The app is served at **http://localhost:3000**.

## Environment Variables

Copy [.env.example](.env.example) to `.env` and adjust as needed. `.env` is gitignored; `.env.example` is committed and should be updated whenever a new variable is introduced.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `API_BASE_URL` | Yes | `http://127.0.0.1:8000/api` | Base URL of the RedAgos backend API. Exposed to the client as `runtimeConfig.public.apiBaseURL`. |

Because this value lives under `runtimeConfig.public`, it is **readable in the browser**. Never put secrets in it.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with HMR on port 3000 |
| `npm run build` | Build the app for production |
| `npm run preview` | Serve the production build locally |
| `npm run generate` | Pre-render the app as a static site |
| `npm run make:service <Name>` | Scaffold a new API service class (see [API Service Layer](#api-service-layer)) |

`npm run postinstall` runs `nuxt prepare` automatically after install to generate types in `.nuxt/`.

## Project Structure

```text
RedAgos_client/
│
├── app/
│   ├── app.vue                  # Root component
│   │
│   ├── api/                     # API service layer (one folder per domain)
│   │   ├── BaseService.ts       # Shared $fetch wrapper: auth header, error normalization
│   │   ├── auth/AuthService.ts
│   │   ├── billing/BillingService.ts
│   │   ├── bloodcenter/BloodCenterService.ts
│   │   ├── donor/DonorService.ts
│   │   └── hospital/HospitalService.ts
│   │
│   ├── assets/
│   │   ├── css/main.css         # Tailwind entrypoint + global styles
│   │   ├── icons/               # SVG icon set
│   │   └── images/
│   │
│   ├── components/
│   │   ├── BloodCenter/
│   │   ├── Donor/
│   │   ├── Hospital/
│   │   ├── Landing/
│   │   ├── auth/
│   │   ├── common/              # Shared, role-agnostic UI
│   │   └── profile/
│   │
│   ├── composables/             # Shared reactive state & logic (useUser, useDarkMode, ...)
│   ├── layouts/                 # default + one dashboard layout per role
│   ├── middleware/auth.ts       # Route guard for authenticated pages
│   │
│   └── pages/                   # File-based routing
│       ├── auth/                # Per-role login / register / forgot-password
│       ├── donor/
│       ├── hospital/
│       ├── blood-center/
│       ├── legal/               # Terms, Privacy
│       └── index.vue            # Landing page
│
├── public/                      # Served as-is at the site root
├── scripts/make-service.js      # Generator behind `npm run make:service`
│
├── .env.example
├── .nvmrc
├── nuxt.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Architecture

### API Service Layer

All backend communication goes through `app/api/`. Components and composables should **never** call `$fetch` against the API directly — call a service instead. This keeps the auth header, base URL, and error shape in one place.

[`BaseService`](app/api/BaseService.ts) handles:

- Prefixing requests with `runtimeConfig.public.apiBaseURL`
- Attaching `Authorization: Bearer <token>` from `localStorage`
- Routing `params` to the query string on `GET` and to the body otherwise
- Normalizing failures into an `Error` carrying `status` and Laravel's `errors` validation bag

Each domain service is a singleton extending `BaseService`:

```ts
import { donorService } from '~/api/donor/DonorService'

const donors = await donorService.list({ page: 1 })
```

Scaffold a new one with the generator, which creates `app/api/<kebab-name>/<Name>Service.ts` with `list`/`create`/`show`/`update`/`delete`/`restore` methods pointed at `/<kebab-name>s`:

```bash
npm run make:service Appointment
```

Handle errors by inspecting the normalized fields:

```ts
try {
  await authService.login({ email, password })
} catch (err) {
  if (err.status === 422) fieldErrors.value = err.errors  // { email: ['...'] }
  else message.value = err.message
}
```

### Authentication

- Login returns a token that is stored in `localStorage` under the key **`_token`**.
- [`middleware/auth.ts`](app/middleware/auth.ts) guards protected pages. It is client-only (it bails out during SSR) and redirects unauthenticated visitors to a login route with a `?redirect=` query so they return to their original destination.
- Apply it per page with `definePageMeta({ middleware: 'auth' })`.
- Because the token lives in `localStorage`, authenticated data must be fetched on the client, not during SSR.

### State Management

Shared state uses Nuxt's `useState` inside composables in `app/composables/`, which gives an SSR-safe singleton per key.

[`useUser`](app/composables/useUser.js) is the canonical example — it exposes `user`, `loading`, `fetchUser()`, `updateAvatar()`, and `clearUser()`, and normalizes the backend payload (snake_case) into the shape the UI consumes.

Some composables (`useMockFulfillmentApi`, and other mock-data helpers) still return fixture data while the matching endpoints are built. Replace these with real services as the backend lands.

### Styling

- Tailwind CSS, configured in [tailwind.config.js](tailwind.config.js) with **class-based dark mode** (`darkMode: 'class'`).
- Toggle theming through the `useDarkMode` composable rather than manipulating the `dark` class by hand.
- Global styles and Tailwind directives live in `app/assets/css/main.css`.

## User Roles & Routes

| Role | Auth routes | Application routes |
| --- | --- | --- |
| Donor | `/auth/donor/*` | `/donor` — Dashboard, Appointments, Eligibility, History, Profile, Notifications, Settings, QR code, Help |
| Hospital | `/auth/hospital/*` | `/hospital` — Dashboard, Blood requests (list/new/edit/detail), Track requests, Blood availability, Notifications, Settings |
| Blood Center | `/auth/blood-center/*` | `/blood-center` — Dashboard, Inventory, Blood requests, Fulfillment, Drives, Donors, Appointments, Reports, Settings |
| Admin | `/auth/admin/*` | Authentication screens only; dashboard not yet implemented |

`/auth/role-selection` is the entry point that routes a visitor to the right login flow.

## Development Workflow

1. Branch off `develop` (e.g. `feature/donor-appointments`).
2. Implement and verify locally against a running backend.
3. Commit with clear, descriptive messages.
4. Push and open a Pull Request targeting `develop`.
5. Merge to `main` for release.

**Conventions**

- New API calls go through a service in `app/api/` — never call the backend directly from a component.
- Prefer TypeScript (`.ts`) for new composables and services. Existing `.js` composables are legacy and can be migrated opportunistically.
- Component folders are grouped by role (`Donor/`, `Hospital/`, `BloodCenter/`); anything reused across roles belongs in `common/`.
- Add any new environment variable to both `nuxt.config.ts` and `.env.example`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Requests fail with a network/CORS error | Backend not running, or `API_BASE_URL` points at the wrong host. Confirm the API responds at that URL. |
| `401` on every request after logging in | The `_token` entry in `localStorage` is missing or stale. Clear site data and log in again. |
| Env change has no effect | Restart `npm run dev` — `runtimeConfig` is read at startup. |
| Type errors after pulling | Run `npm install` (triggers `nuxt prepare`) or `npx nuxt prepare` to regenerate `.nuxt/` types. |

## License

Developed as a capstone project and intended for academic purposes.
