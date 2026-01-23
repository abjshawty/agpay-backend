# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
This repo is a TypeScript backend API (Fastify) for payment aggregation (AGPAY v2). It uses:
- Fastify as the HTTP server (`src/externals/server.ts`)
- Prisma as ORM with a MongoDB datasource (`prisma/schema.prisma`)
- A service/repository layering: HTTP routes → services → repositories → Prisma
- Vitest for tests (test files live alongside code as `*.test.ts`)

## Common commands
All commands below are run from the repo root.

### Install dependencies
- Install (existing `node_modules` is present in the repo on disk, but CI/Docker uses a clean install):
  - `npm ci`
  - or `npm install`

### Generate Prisma client
- `npm run gen`

(Useful after editing `prisma/schema.prisma`.)

### Run the API (development)
- `npm run dev` (nodemon)
- `npm run dev:watch` (prisma generate + ts-node-dev)

### Build / run production build
- `npm run build` (TypeScript compile to `build/`)
- `npm start` (runs `node ./build/index.js`)
- `npm run prod-simulate` (build + run)

### Formatting
- `npm run format` (prettier over `src/`)

### Tests
- Run all tests:
  - `npm test`
- Run a single test file:
  - `npm test -- src/services/partners.test.ts`
- Run a single test by name (Vitest):
  - `npx vitest -t "<test name substring>"`

## Local configuration
- Environment variables are documented in `.env.example`.
- Prisma reads `DATABASE_URL` from the environment; the schema is configured for MongoDB.

## High-level architecture

### Runtime entrypoint
- `src/index.ts` is the main entrypoint:
  - constructs and starts the Fastify `Server`
  - initializes cron bootstrapping (`src/services/cronService.ts`)
  - imports `src/services/superadmin.ts` for startup side-effects (superadmin/profile bootstrap)

### HTTP layer (Fastify routes)
- Routes are registered in `src/api/routes/index.ts` under the prefix `/api${API_PATH}`.
- Each route module under `src/api/routes/` typically:
  - defines Fastify route schemas (params/body/query)
  - attaches auth via `preHandler: checkAuth` (`src/helpers/auth.ts`)
  - calls into a corresponding service in `src/services/`

### Service layer (business rules)
- `src/services/*` implements validation, security checks, orchestration, exports, and cross-entity rules.
- Example: `src/services/transactions.ts` contains core transaction flows:
  - pagination/filtering for UI
  - exports (CSV/Excel/PDF)
  - stats/aggregations
  - DFC (Daily Financial Closure) computation helpers

### Repository layer (data access)
- `src/repository/*` is the main Prisma access layer.
- Repositories should focus on query construction and persistence, not authorization.
- Example: `src/repository/transactions.ts` builds `where` clauses and pagination logic.

### Data model
- Prisma schema: `prisma/schema.prisma`.
- Key models include `User`, `Society`, `Partner`, `CodeSociety`, `Transaction`, `DailyFinancialClosure`, `Audit`.

### Auth
- Fastify JWT is registered in `src/externals/server.ts` (`@fastify/jwt`).
- Request auth middleware: `src/helpers/auth.ts` (`checkAuth`, `onlyadmin`).
- Token blocking/denylist uses `TokenX` via `src/repository/tokenX.ts` (used in `checkAuth`).

### Swagger
- Swagger is configured in `src/externals/utils/swagger.ts` and registered by the server.
- Swagger UI is exposed under `/docs`.

### Background jobs / ingestion
- Cron bootstrap: `src/services/cronService.ts`.
  - On startup it checks if operators exist; if not, it seeds via `src/utils/loadPartners.ts`.
- Kafka ingestion exists (currently not always enabled):
  - `src/services/neo_kafka.ts` (kafkajs consumer/producer)
  - `src/helpers/kafka/*` (alternative consumer/processing utilities)
- Microsoft SQL ingestion (for recap transactions) lives in `src/helpers/sql/ms.ts`.

## Security invariant: society access validation
The repo contains a documented “zero-trust” society-access model (see `docs/SECURITY.md`).

Key implementation:
- `src/services/transactions.ts` implements centralized access control via `validateSocietyAccess()`:
  - INTERNAL users: allowed societies come from `user.societyId` (array)
  - EXTERNAL users: allowed societies are derived via Partner → `CodeSociety` → Society (`getPartnerSocieties()`)
  - If a route accepts a requested `societyId`, it must be validated against the user’s allowed societies.
  - If no `societyId` is provided, the service layer should default filters to the full set of allowed societies.

When adding or modifying transaction/DFC endpoints:
- Put society-access checks in the service layer (before calling repositories).
- Prefer reusing `TransactionService.validateSocietyAccess()` rather than re-implementing per endpoint.

## CI/CD pointers
- `Jenkinsfile` runs Sonar scanner and produces a release zip; deploy stage is gated by branch conditions.
- Docker build is supported via the multi-stage `Dockerfile` (Node 20 alpine).