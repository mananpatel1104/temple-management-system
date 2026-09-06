# Shree Swaminarayan Mandir — Progressive Web Application

Official temple management PWA for Shree Swaminarayan Mandir, Vadtal.
Built to a ₹0-budget architecture per the project SRS/SDD: React 18 +
Vite + TypeScript on the frontend, Supabase (PostgreSQL + Edge
Functions + Storage) on the backend, deployed as a static site on
GitHub Pages and installable as a PWA.

> **Status:** In active development, module by module. Several modules
> (Authentication, Dashboard, Library, Gallery, Announcements,
> Notifications, Live Darshan & Katha, Member Management, Audit Log,
> Settings — language only) have real, RBAC-secured implementations;
> others (Money Manager, Panchang/Nirnay, Daily Thal, Search) remain
> reserved empty structure under `src/modules/*`. See
> `docs/IMPLEMENTATION_CHECKLIST.md` for the authoritative, requirement-
> by-requirement status — note that file itself may lag the latest task
> by a task or two and should be re-verified before relying on it for a
> release decision.

## Tech Stack

| Layer          | Technology                                    |
| -------------- | ---------------------------------------------- |
| Frontend       | React 18, Vite, TypeScript                     |
| Styling        | Tailwind CSS (mobile-first, Light/Dark themes) |
| Routing        | React Router v6                                |
| Backend        | Supabase (PostgreSQL, Edge Functions, Storage) |
| Auth           | Custom PIN-based (NOT Supabase Auth)           |
| Offline / PWA  | vite-plugin-pwa (Workbox) + Web App Manifest   |
| Hosting        | GitHub Pages (static, free tier)               |
| Lint / Format  | ESLint + Prettier (+ Tailwind class sorting)   |

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A Supabase project (free tier) — see [Environment Variables](#environment-variables)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env with your Supabase project URL and anon key

# 3. Run the dev server
npm run dev
```

The app runs at `http://localhost:5173`.

## Available Scripts

| Script                 | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Start the Vite dev server                        |
| `npm run build`         | Type-check and build for production (`dist/`)    |
| `npm run preview`       | Preview the production build locally             |
| `npm run lint`          | Run ESLint                                       |
| `npm run lint:fix`      | Run ESLint with auto-fix                         |
| `npm run format`        | Format the codebase with Prettier                |
| `npm run format:check`  | Check formatting without writing changes         |
| `npm run type-check`    | Run the TypeScript compiler in `--noEmit` mode   |

## Environment Variables

All environment variables are documented in `.env.example`. Copy it to
`.env` for local development — **never commit `.env`**. Only variables
prefixed `VITE_` are exposed to client code (Vite convention), and the
Supabase client (`src/shared/lib/supabaseClient.ts`) reads **exclusively**
from `import.meta.env` via `src/config/env.ts` — no hard-coded credentials
anywhere in the codebase.

| Variable                 | Required | Description                                          |
| ------------------------- | -------- | ----------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Yes      | Supabase project URL                                   |
| `VITE_SUPABASE_ANON_KEY`  | Yes      | Supabase anon/public API key (RLS enforces access)      |
| `VITE_APP_NAME`           | No       | Display name used in UI/manifest fallbacks              |
| `VITE_APP_ENV`            | No       | `development` \| `staging` \| `production`              |
| `VITE_BASE_PATH`          | No       | Deployment base path; set to `/<repo-name>/` in CI      |

## Project Structure

```
src/
├── app/            # Providers, router, root layout (composition only)
├── modules/        # One folder per feature module (empty — reserved)
├── shared/         # Cross-module UI primitives, hooks, utils, Supabase client
├── store/          # Global client-side state (reserved)
├── i18n/           # Gujarati / Hindi / English translation resources
├── offline/        # Service worker registration & offline utilities
├── styles/         # Tailwind entry + theme CSS custom properties
└── config/         # Environment & app-wide configuration

supabase/           # Migrations, Edge Functions (one folder per controller), seed data
docs/               # SRS, SDD, API docs, user/admin manuals
tests/              # unit / integration / e2e / fixtures
```

Path aliases (`@/`, `@app/`, `@modules/`, `@shared/`, `@store/`, `@i18n/`,
`@offline/`, `@styles/`, `@config/`) are configured in both
`tsconfig.json` and `vite.config.ts` — keep them in sync if adding new
top-level `src/` folders.

## Authentication Model

This project intentionally does **not** use Supabase Auth. Per the SRS/SDD:

- **Devotees** register once (Name + optional Mobile) with no PIN.
- **Editors/Administrators** authenticate with a hashed PIN via a custom
  auth module (to be implemented in `src/modules/auth/`).
- The Supabase client is initialized with `persistSession: false` and
  `autoRefreshToken: false` to keep the Supabase Auth subsystem fully
  disengaged (see `src/shared/lib/supabaseClient.ts`).

## Branding Assets

The official temple logo (Shree Swaminarayan Mandir, Heranj) is integrated
as the PWA/app icon set. Source of truth and generated variants:

| File                                          | Purpose                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `public/icons/temple-logo.png`                | Canonical high-resolution logo, transparent background — reference this for the header/branding and Temple Info module once built |
| `public/icons/icon-{72,96,128,144,152,192,384,512}x*.png` | Standard ("any"-purpose) PWA icons declared in `manifest.webmanifest` |
| `public/icons/maskable-icon-512x512.png`      | Maskable icon — logo kept within the W3C 40%-radius safe zone on a solid cream background so it survives circular/squircle OS masking |
| `public/favicon.ico`                          | Browser tab favicon (multi-resolution)                         |
| `public/splash/splash-logo.png`               | Logo asset reserved for the splash screen, ready for `src/app/layout/SplashScreen.tsx` once that component is implemented |

All icon files were generated from the official logo artwork with a true
alpha-transparent background (the source PNG's checkerboard was pixel data,
not real transparency, and has been removed without altering the artwork,
lettering, proportions, or colors).

## PWA & Offline

- `public/manifest.webmanifest` defines installability (icons, theme
  color, standalone display).
- `vite-plugin-pwa` (configured in `vite.config.ts`) generates the
  Workbox service worker at build time: cache-first for static assets,
  network-first (with an 8s timeout) for Supabase requests.
- `src/offline/serviceWorkerRegistration.ts` registers the worker and
  exposes update/offline-ready hooks — called once from `src/main.tsx`.
- `public/offline.html` is the navigation fallback shown when a page
  isn't cached and the network is unavailable.

## Deployment (GitHub Pages)

`.github/workflows/deploy-github-pages.yml` builds and deploys `dist/`
to GitHub Pages on every push to `main`. Before your first deploy:

1. In the repository **Settings → Pages**, set the source to **GitHub
   Actions**.
2. In **Settings → Secrets and variables → Actions**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository
   secrets.
3. The workflow automatically sets `VITE_BASE_PATH` to
   `/<repository-name>/` so built asset paths resolve correctly under
   `https://<username>.github.io/<repository-name>/`.
4. This deploys the **frontend only**. The Supabase backend (database
   schema, Edge Functions, storage buckets) is a separate one-time setup
   — see [Deployment (Supabase Backend)](#deployment-supabase-backend)
   below and complete it first, since the frontend cannot function
   without it.

> No `package-lock.json` is committed yet, so the workflow currently
> runs `npm install` instead of `npm ci`. Generating and committing a
> real lockfile (`npm install` on a machine with npm registry access,
> then commit the resulting `package-lock.json`) is recommended so
> builds become reproducible and the workflow can be switched back to
> `npm ci` + dependency caching.

## Deployment (Supabase Backend)

None of this has been run against a live project from this environment
(no network access here — see **Known Limitations** below); follow it
manually with the Supabase CLI:

1. **Create the Supabase project** (free tier) and note its Project URL
   and keys from **Project Settings → API**.
2. **Push the database schema**, in order — the Supabase CLI applies
   migrations in filename order automatically:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies `supabase/migrations/0002_task9_auth_rbac_audit.sql`
   through `0007_task10d_live_darshan_katha.sql` — creating all tables,
   enabling Row Level Security with no permissive policies for
   `anon`/`authenticated` (deny-by-default; every read/write goes
   through the Edge Functions below using the service-role key), and
   creating the private `gallery` and `announcement-attachments`
   storage buckets with their file-size/MIME-type limits.
3. **Set Edge Function secrets** (server-side only — never prefix these
   with `VITE_`, or they would be bundled into the client):
   ```bash
   supabase secrets set \
     AUTH_JWT_SECRET=$(openssl rand -hex 32) \
     BOOTSTRAP_SETUP_TOKEN=$(openssl rand -hex 32)
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided
   automatically to every Edge Function by the Supabase platform and do
   not need to be set manually.
4. **Deploy every Edge Function**:
   ```bash
   supabase functions deploy announcements audit-log auth-change-pin \
     auth-login auth-register auth-reset-pin bootstrap-admin gallery \
     live-darshan member-management notifications
   ```
5. **Create the first Supreme Administrator** by calling
   `bootstrap-admin` once (e.g. with `curl`), authenticated with the
   `BOOTSTRAP_SETUP_TOKEN` set above, then **rotate or remove
   `BOOTSTRAP_SETUP_TOKEN` immediately afterwards** — the function
   itself reminds you of this in its response message.
6. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (repository
   secrets, step 2 above) to this project's values and deploy the
   frontend.

## Coding Conventions

- One module per feature under `src/modules/<module>/`, each with its
  own `pages/`, `components/`, `hooks/`, `services/`, `types/`.
- Nothing outside a module's own folder imports its internals directly —
  use each module's `index.ts` barrel once implemented.
- Only `src/config/env.ts` reads `import.meta.env` — everything else
  imports `env` from there.
- Tailwind is mobile-first: unprefixed utility = smallest screen,
  `sm:`/`md:`/`lg:` scale up (see `tailwind.config.ts`).

## License

Proprietary — Shree Swaminarayan Mandir, Vadtal. All rights reserved.
