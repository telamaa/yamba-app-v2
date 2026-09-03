# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Yamba is a crowdshipping app: **shippers** (expéditeurs) book parcel deliveries with **carriers** (voyageurs — "Yamber"/"Tripper" in UI copy) who publish trips. Nx monorepo (npm workspaces), TypeScript strict, comments/docs/i18n primarily in **French** — keep new comments and docs in French. Public API surfaces (OpenAPI, API error messages, event keys) are in **English**.

## Read first (governance)

Before any non-trivial task, read in this order:

1. `context/YAMBA-CONTEXT.md` — done / remaining / non-negotiable rules.
2. `context/YAMBA-SPECIFICATION-COMPLETE.md` — end-to-end spec (domain, state machines, pricing, events, security, roadmap).
3. The latest `context/YAMBA-CONTEXT-HANDOFF-*.md` — exact state of the current worksite.
4. Per task: `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (**the master document** — decisions D1–D38 (D35 candidate); architecture decisions are recorded there BEFORE code, never after), `context/YAMBA-REGLES-METIER-V2.md` (~50 business rules), `context/mockup-pricing-yamba.html` (pricing form spec).

Precedence on divergence: code + its tests > registre > business rules > syntheses in `context/`. `docs/` also contains detailed French functional + technical specs (booking shipper wizard, carrier deal request) — read the relevant `YAMBA-DOC-TECHNIQUE-*.md` before evolving those features.

## Commands

Always run tasks through Nx (see also `AGENTS.md`):

```sh
npm run dev                        # serve everything (all backends + frontend)
npx nx dev user-ui                 # Next.js frontend only (port 3000)
npx nx serve api-gateway           # gateway (port 8080)
npx nx serve auth-service          # port 6001
npx nx serve trip-service          # port 6002
npx nx serve deal-service          # port 6003
npx nx serve notification-service  # port 6004 (Kafka consumer — needs Redpanda up)

npx nx build <project>             # production build
npx nx typecheck <project>         # TS typecheck
npx nx test <project>              # jest tests for one project
npx nx test <project> -- --testPathPatterns=<pattern>   # single test file (jest 30)

npx prisma generate                # after editing prisma/schema.prisma (schema at repo ROOT)
npx prisma db push                 # sync schema to MongoDB (no migrations — Mongo provider)

npm run auth-docs                  # regenerate auth swagger-output.json (swagger-autogen — legacy, conversion to Zod-OpenAPI is backlog)
```

Test platform baseline: **676 tests** (trip-service 198, deal-service 402, notification-service 76) + auth-service 65 (also a CI check) — any deviation must be explained.

Manual `tsc` (when Nx typecheck target is not what you want): `npx tsc --noEmit --project apps/<service>/tsconfig.app.json` — NEVER `--project apps/<service>` (resolves the solution-style tsconfig: 0 files checked).

No linter is configured (Nx generators use `linter: none`). Root `.env` holds all secrets (`DATABASE_URL` Mongo, `REDIS_DATABASE_URI`, JWT secrets, SMTP, Stripe, Google Maps) — see `.env.example`. Never commit any `.env` (`.example` files are fine).

## Git & CI

- Base branch `dev`, protected by **13 required status checks** (TypeScript ×6, unit tests ×4: auth/deal/notification/trip, i18n FR/EN mirror, secrets anti-leak, OpenAPI contracts generate+diff). Never commit directly to `dev`: `feat/*` or `chore/*` branch + PR.
- "CI OK" is verified by COUNTING checks, not by their color alone.
- Tests live in the SAME PR as their logic (decision D30). PR number is recorded at merge time.
- `git status --short` before staging; `git add` always WITH an explicit pathspec; `git log --oneline -1` right after each commit.
- Never `npm audit fix --force` inside a feature PR (dedicated `chore/deps` PR).

## Architecture

### Services (Express, behind a gateway)

Requests flow: `user-ui (3000)` → `api-gateway (8080)` → microservices. The gateway (`apps/api-gateway/src/main.ts`) does CORS (localhost + LAN IP regexes), rate limiting, and path-based proxying:

- `/api/trips/*` → trip-service `:6002` as `/trips/*`
- `/api/uploads/*` → trip-service `:6002` as `/uploads/*` (ImageKit)
- deal-service routes → `:6003` (VERIFY exact gateway prefix in `apps/api-gateway/src/main.ts` before relying on it)
- everything else → auth-service `:6001` (catch-all)

**auth-service**: auth (register/login/refresh), carrier onboarding + Stripe, saved routes, public user profiles, cron jobs (`src/cron/`), nodemailer emails. **trip-service**: trips CRUD + search + lifecycle state machine + pricing gate (zod schemas in `src/schemas/`), uploads, OpenAPI 3.1 generated from Zod (99 paths, Scalar viewer at `:6002/docs`). **deal-service**: Booking model, server-side state machine (9 statuses, 12 actor-bound transitions — mirror of `SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md` §2.2), role-scoped DTOs, transactional outbox + Redpanda relay. **notification-service**: first Kafka consumer (event-id dedup, offsets committed post-processing). All follow `routes/ → controller(s)/ → service(s)/`.

### Shared code — `packages/` via `@packages/*` alias

- `packages/libs/prisma` — singleton PrismaClient; **one shared MongoDB across all services**, schema at root `prisma/schema.prisma`
- `packages/libs/redis` — ioredis singleton
- `packages/middleware` — `isAuthenticated`, `isOptionallyAuthenticated`, `authorizeRoles` (JWT from `access_token` cookie or Bearer header)
- `packages/error-handler`
- `packages/api-contracts` — Zod schemas + shared status sets, single source for OpenAPI; alias declared BEFORE the `@packages/*` wildcard in `tsconfig.base.json`
- `packages/libs/payments` — `PaymentProvider` abstraction (D11/D38): Stripe (manual capture) + Fake (dev/tests, refused in production); factory from env
- `packages/messaging` — `EventPublisher` interface; kafkajs isolated here (connection errors come back `retriable: false` — intercept explicitly)
- `packages/libs/email` — shared transactional mailer (D41/D44): lazy SMTP transport, `sendTemplatedEmail` (per-service EJS files, legacy) and `sendTransactionalEmail` (ONE embedded EJS layout string + `EmailContent` data). auth-service emails are per-locale dictionaries (`apps/auth-service/src/emails/auth-emails.ts`). The locale list lives ONLY in `packages/libs/api-contracts/src/locale.ts` (`SUPPORTED_LOCALES`, `resolveLocale`); the front consumes it through the dedicated alias `@packages/api-contracts/locale`. Never write a new `fr ? … : …` — add a dictionary entry. Email language = the RECIPIENT's `User.preferredLocale`; account-less flows use the request locale (`x-locale` header sent by the API clients).
- `packages/libs/delivery-code` — delivery code (D43): CSPRNG 6 digits, bcrypt hash (validation) + AES-256-GCM `deliveryCodeEncrypted` (shipper re-display, `DELIVERY_CODE_ENCRYPTION_KEY`, dev key fallback outside production). Zero infra deps — also imported relatively by the seed. New `@packages/*` aliases must ALSO be added to each consuming service's `webpack.config.js` (`resolve.alias`) — tsc resolves `tsconfig.base.json`, `nx serve` does not.

### Auth flow

JWT `access_token` + `refresh_token` set as cookies by auth-service. Frontend `apps/user-ui/src/lib/api-client.ts` (axios, `withCredentials`) auto-refreshes on 401 with a request queue **and a 30s circuit breaker** — read its header comment before touching it. `lib/api.ts` (`apiFetch`) is the lighter fetch wrapper; base URL comes from `NEXT_PUBLIC_API_BASE_URL`.

### Frontend — `apps/user-ui` (Next.js 16 App Router)

- **i18n**: next-intl. All pages live under `src/app/[locale]/`; `src/middleware.ts` handles locale routing (fr/en). Messages are per-domain JSON in `messages/{fr,en}/<domain>.json` — add keys to **both** locales (CI mirrors them).
- **Feature-folder convention** in `src/components/<domain>/<feature>/`: `FeatureClient.tsx` (entry), `FeatureSkeleton.tsx`, `feature.api.ts`, `feature.state.ts`, `feature.types.ts`, plus `views/`, `shared/`, `steps/` subfolders. See `components/booking/booking-tracker/` as reference.
- **Next.js 16 rule**: function props passed to client components must be suffixed `Action` (e.g. `onSelectAction`) or TS71007 fires. Legacy violations are catalogued in `TODO-LEGACY-FIXES.md`. `params` in page components is a Promise → `await` it.
- **Double UI**: many features have separate desktop/mobile component trees (e.g. `BookingStepperDesktop` / `BookingStepperMobile`), switched via `useIsMobile`.
- Data fetching: TanStack Query; hooks in `src/hooks/`, API layers in `src/services/*.api.ts` or colocated `feature.api.ts`.
- Design system: mango `#FF9900` + teal `#0F766E`, dark/light via class strategy.

## Non-negotiable rules

- Monetary amounts are **cents as `Int`** + a `currency` field. Never Float.
- Role-scoped DTOs are strict whitelists (never spread+delete).
- The delivery code NEVER travels in events or emails.
- No state change without an outbox event written in the SAME Mongo transaction.
- Pricing snapshot in a Booking is immutable — never recomputed from the Trip.
- 403 vs 404 semantics respected (don't reveal resource existence).
- Every business limit is enforced server-side; the front only reflects `allowedActions` from the API — it never decides.
- State machines are executable mirrors of the spec: any divergence is a bug in the machine or the spec, never an "interpretation" in a controller.
- Any new architecture decision made during a task must be proposed as a registre entry (D-next), not left implicit in code.

## Known pitfalls (paid once, never twice)

- Prisma+Mongo: `field: null` in a `where` misses ABSENT fields → `OR: [{field: null}, {field: {isSet: false}}]` — for EVERY nullable filter (`readAt`, `publishedAt`…), and writers must set `null` explicitly. Paid FOUR times (readAt, reservedKg A34, outbox relay A49, trackingEvents A85): a fixture that sets the field proves nothing about the real writer. **Composite/scalar LISTS are worse: no Prisma filter (`none`, `some`, `isEmpty`, `equals: []`) matches an ABSENT list** — writers must create lists as `[]` (booking-request.ts does), concurrency guards go through `updatedAt` (optimistic lock), and `packages/libs/prisma/scripts/repair-absent-lists.ts` back-fills existing documents.
- Nullable unique fields on Mongo collide on null (P2002).
- Atlas shared tiers cap aggregation pipelines at 50 stages; Prisma emits one `$set` stage per field on updates touching composite types → `P2010 Pipeline length greater than 50`. Chunk wide updates with `apps/trip-service/src/lib/mongo-update-chunks.ts` (transition fields last).
- macOS FS is case-insensitive, CI Linux is not → exact-case imports.
- A nested `apps/<service>/node_modules/<pkg>` (version drift between the service `package.json` and the root) shadows the root copy: `npm ls <pkg>` must say « deduped ». `imagekit` is pinned exact (6.0.0) in BOTH package.json files — 1.5.0 was a 2016 fossil with another API (A47).
- `overflow-x: clip` (not `hidden`) to preserve `position: sticky`.
- LAN testing (other computers/phones on `http://192.168.x.x:3000`): EITHER switch `NEXT_PUBLIC_API_BASE_URL` in `apps/user-ui/.env.local` to the LAN IP (then EVERY device, the Mac included, must use the LAN URL — cookies are host-bound: front on `localhost` + API on the LAN IP = login 200 then `/me` 401), OR (D48, preferred) set `API_PROXY_TARGET=http://localhost:8080` + `NEXT_PUBLIC_API_BASE_URL=/api` so Next proxies `/api/*` to the gateway and cookies are first-party on any host. Restart user-ui after changing either. `allowedDevOrigins` in `next.config.js` is required or Next 16 answers 403 on `/_next/*` and pages stay on their SSR skeleton.
- Seeds live in `packages/libs/prisma/scripts/`, relative imports, run via `npx tsx --env-file=.env …` (sourcing `.env` in zsh mangles the Mongo password). `seed-deals.ts` is the QA reset: wipe + recreate trips/bookings of the seed users, real delivery code `742891` on every post-pickup booking.
- `nx serve` loads root `.env` and OVERRIDES variables passed on the command line — to run a service with a controlled env (e.g. forcing the FAKE payment provider), run the built bundle: `STRIPE_SECRET_KEY= node --env-file=../../.env dist/main.js` from `apps/<service>` (Node lets the process env win).

## End of task

A delivery = a PR merged into `dev` with its tests. If the done/remaining state moved, update `context/YAMBA-CONTEXT.md` and `context/YAMBA-SUIVI-PROJET.md`.

**Before announcing any PR as ready, COMPLETE (never create new files) the three cumulative documents in `context/`:**
1. `YAMBA-DOC-TECHNIQUE.md` — what was done and why, readable by a junior developer (one section per PR/lot).
2. `YAMBA-DOC-METIER.md` — the need and the numbered business rules (RG-*), acceptance tests.
3. `YAMBA-APPRENTISSAGE-DEV.md` — a tutorial chapter per PR: the techniques and language/tool concepts used, the why, from theory to the code actually implemented (real paths + excerpts), pitfalls, going further.
`context/fiches-pr/` is a frozen archive (PR #78–#85). Screenshots are never versioned. No co-author trailers.
