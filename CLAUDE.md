# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Yamba is a crowdshipping app: **shippers** (expéditeurs) book parcel deliveries with **carriers** (voyageurs) who publish trips. Nx monorepo (npm workspaces), TypeScript strict, comments/docs/i18n primarily in **French** — keep new comments and docs in French.

## Commands

Always run tasks through Nx (see also `AGENTS.md`):

```sh
npm run dev                        # serve everything (all backends + frontend)
npx nx dev user-ui                 # Next.js frontend only (port 3000)
npx nx serve api-gateway           # gateway (port 8080)
npx nx serve auth-service          # port 6001
npx nx serve trip-service          # port 6002

npx nx build <project>             # production build
npx nx typecheck <project>         # TS typecheck
npx nx test <project>              # jest tests for one project
npx nx test <project> -- --testPathPatterns=<pattern>   # single test file (jest 30)

npx prisma generate                # after editing prisma/schema.prisma
npx prisma db push                 # sync schema to MongoDB (no migrations — Mongo provider)

npm run auth-docs && npm run trip-docs   # regenerate swagger-output.json (swagger-autogen)
```

No linter is configured (Nx generators use `linter: none`). Root `.env` holds all secrets (`DATABASE_URL` Mongo, `REDIS_DATABASE_URI`, JWT secrets, SMTP, Stripe, Google Maps) — see `.env.example`.

## Architecture

### Services (Express, behind a gateway)

Requests flow: `user-ui (3000)` → `api-gateway (8080)` → microservices. The gateway (`apps/api-gateway/src/main.ts`) does CORS (localhost + LAN IP regexes), rate limiting, and path-based proxying:

- `/api/trips/*` → trip-service `:6002` as `/trips/*`
- `/api/uploads/*` → trip-service `:6002` as `/uploads/*` (ImageKit)
- everything else → auth-service `:6001` (catch-all)

**auth-service**: auth (register/login/refresh), carrier onboarding + Stripe, saved routes, public user profiles, cron jobs (`src/cron/`), nodemailer emails. **trip-service**: trips CRUD + search (zod schemas in `src/schemas/`), uploads, trip notifications. Both follow `routes/ → controller(s)/ → service(s)/`.

### Shared code — `packages/` via `@packages/*` alias

- `packages/libs/prisma` — singleton PrismaClient; **one shared MongoDB across all services**, schema at root `prisma/schema.prisma`
- `packages/libs/redis` — ioredis singleton
- `packages/middleware` — `isAuthenticated`, `isOptionallyAuthenticated`, `authorizeRoles` (JWT from `access_token` cookie or Bearer header)
- `packages/error-handler`

### Auth flow

JWT `access_token` + `refresh_token` set as cookies by auth-service. Frontend `apps/user-ui/src/lib/api-client.ts` (axios, `withCredentials`) auto-refreshes on 401 with a request queue **and a 30s circuit breaker** — read its header comment before touching it. `lib/api.ts` (`apiFetch`) is the lighter fetch wrapper; base URL comes from `NEXT_PUBLIC_API_BASE_URL`.

### Frontend — `apps/user-ui` (Next.js 16 App Router)

- **i18n**: next-intl. All pages live under `src/app/[locale]/`; `src/middleware.ts` handles locale routing (fr/en). Messages are per-domain JSON in `messages/{fr,en}/<domain>.json` — add keys to **both** locales.
- **Feature-folder convention** in `src/components/<domain>/<feature>/`: `FeatureClient.tsx` (entry), `FeatureSkeleton.tsx`, `feature.api.ts`, `feature.state.ts`, `feature.types.ts`, plus `views/`, `shared/`, `steps/` subfolders. See `components/booking/booking-tracker/` as reference.
- **Next.js 16 rule**: function props passed to client components must be suffixed `Action` (e.g. `onSelectAction`) or TS71007 fires. Legacy violations are catalogued in `TODO-LEGACY-FIXES.md`.
- **Double UI**: many features have separate desktop/mobile component trees (e.g. `BookingStepperDesktop` / `BookingStepperMobile`), switched via `useIsMobile`.
- Data fetching: TanStack Query; hooks in `src/hooks/`, API layers in `src/services/*.api.ts` or colocated `feature.api.ts`.

### Domain docs

`docs/` contains detailed French functional + technical specs (booking shipper wizard, carrier deal request). Read the relevant `YAMBA-DOC-TECHNIQUE-*.md` before evolving those features — they document conventions, pitfalls, and file catalogues.