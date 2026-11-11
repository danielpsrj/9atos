# 9Atos

A gamified web platform for studying and memorizing normative texts, legislation, and complex knowledge structures. A single concept can be played as a **Flashcard**, **Multiple Choice**, **Matching** game, or **Fill-in-the-Blanks** task — all scheduled by a Spaced Repetition System (SM-2 variant) for long-term retention.

Built as a functional monolith: **Next.js 15 (App Router) + React 19 + TypeScript (strict) + Prisma 6 + PostgreSQL 16 + Tailwind CSS 4**, containerized with Docker.

- **Spec:** [`9atos_technical_specification.md`](./9atos_technical_specification.md)
- **Plan:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
- **License:** MIT

---

## Architecture

The logical component diagram (spec §2.2). The browser talks to a single Next.js monolith; UI, i18n, and the game engine live in the app, while ingestion and the SRS engine form a services layer above Prisma and PostgreSQL.

```text
[ Client (Browser) ]
      | (HTTP/REST & Server Actions)
      v
[ Next.js App ]
 ├── UI Components (Zen Mode, Timer, Charts)
 ├── i18n Service (Dictionaries pt/en)
 ├── Game Logic Engine (Pair matching, distractors)
 └── API Routes (Ingestion and progress routes)
      |
      v
[ Services Layer / Business Logic ]
 ├── Data Ingestion (CSV/JSON Parser)
 └── SRS Engine (Ease Factor and Interval Calculation)
      |
      v
[ Prisma ORM ]
      |
      v
[ PostgreSQL Database ]
```

**Key design decisions (V1):**

- **Single-user, no auth** (AD-01). A bootstrap `Usuario` (`usuario-bootstrap`) is created by the seed; every route resolves that one user.
- **SRS is server-side only.** The client never computes intervals — it sends grades, the server applies the SM-2 variant and returns the next-review dates.
- **All datetimes are UTC.** Day boundaries (streaks, daily goal) are computed in `America/Sao_Paulo` via `@date-fns/tz`.
- **Error envelope** on every failure: `{ "error": { "code", "message", "details?" } }`.
- **i18n** via `next-intl` with a `[locale]` segment; the locale is persisted in a `NEXT_LOCALE` cookie (defaults to `pt-BR`).

---

## Prerequisites

- **Node.js 22 LTS** (see `.nvmrc`) and **npm** — for local development and tests.
- **Docker** with the Compose plugin — for the bundled PostgreSQL and the containerized app.

> The fastest path to a running app is **fully via Docker** (below). You only need Node if you want to run the dev server with hot reload or run the test suites.

---

## Quick start (Docker) — running app in under 10 minutes

```bash
docker compose up -d --build
```

That single command builds the production image, starts PostgreSQL 16 and the app, and — on container start — runs `prisma generate && prisma migrate deploy && prisma db seed` (all idempotent). The app is then available at:

```
http://localhost:3005
```

The seed creates the bootstrap user and a sample hierarchy (Brazilian Constitution — Direitos Fundamentais) with 15 rules. On first run the dashboard shows an onboarding screen offering to import your own data or use the sample notebook.

> **Port note:** the app is published on host port **3005** (the container stays on 3000). On the deployment host, 3000 (Gitea) and 3001 (Dockhand) are already taken.

To stop and remove everything (including the database volume):

```bash
docker compose down -v
```

---

## Local development

For contributors who want the dev server with hot reload. The database still runs in Docker; only the Node process runs on the host.

The one catch: `.env.example` points `DATABASE_URL` at the compose `db` service (host `db`), which only resolves **inside** the compose network. A host-side dev server needs PostgreSQL reachable at `localhost:5432`. The easiest way is to publish the db port:

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment for a host-side server
cp .env.example .env
#    then edit .env to point at localhost:
#      DATABASE_URL=postgresql://postgres:secret@localhost:5432/9atos

# 3. Start the database with its port published on the host
docker compose up -d db
#    (the db service listens on 5432 inside the network; to reach it from the
#     host, add `ports: ['5432:5432']` to the db service in compose.yaml, or
#     run your own PostgreSQL 16 on localhost:5432.)

# 4. Generate the Prisma client, apply migrations, and seed
npm run prisma:generate
npm run prisma:migrate   # prisma migrate dev (creates/applies the schema)
npm run db:seed          # creates the bootstrap user + sample hierarchy

# 5. Run the dev server (Turbopack)
npm run dev
#    → http://localhost:3000
```

> **Simplest reliable setup:** run the whole stack in Docker (Quick start above) and use the containerized app. The host-side dev server is only for iterating on code, and it needs `DATABASE_URL` pointed at a host-reachable Postgres.

### Prisma

| Command                   | What it does                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `npm run prisma:generate` | Regenerate the Prisma client from the schema.                |
| `npm run prisma:migrate`  | `prisma migrate dev` — create/apply migrations (dev).        |
| `npm run prisma:studio`   | Open Prisma Studio to browse the data.                       |
| `npm run db:seed`         | Run the idempotent seed (bootstrap user + sample hierarchy). |

The schema is in [`prisma/schema.prisma`](./prisma/schema.prisma); the CLI config (seed command, no auto-`.env` loading) is in [`prisma.config.ts`](./prisma.config.ts).

---

## Docker usage

Two compose files are kept in sync:

- **`compose.yaml`** — the Dockhand stack definition (Dockhand expects this filename).
- **`docker-compose.yml`** — local development.

Both define the same two services (`web`, `db`) plus an ephemeral `db-test` service (test profile only).

> **Dependency manifest ("requirements file"):** this is a Node.js project, so there is no Python `requirements.txt`. The dependency manifest is **`package.json` + `package-lock.json`**, both committed to the repo. The Docker build installs exactly the locked versions via `npm ci` from `package-lock.json`. If a local build fails with a "file not found in build context" or missing-manifest error, the clone is incomplete — run `git pull` (or re-clone) so both files are present, and confirm `.dockerignore` does not exclude them. The `Dockerfile` fails fast with a clear message if either is missing.

```bash
# Build the production image
docker compose build

# Start the full stack (web + db)
docker compose up -d

# Follow the app logs
docker compose logs -f web

# Rebuild after code changes and restart
docker compose up -d --build
```

The multi-stage [`Dockerfile`](./Dockerfile) produces a standalone Next.js production image. Its `CMD` runs, on every container start:

```sh
npx prisma generate && npx prisma migrate deploy && npx prisma db seed && node server.js
```

All four steps are idempotent, so a fresh container reaches a migrated, seeded, ready app without manual intervention. `prisma generate` is required at startup because the full `node_modules` copy overwrites the standalone's generated Prisma client with the ungenerated stub.

---

## API reference

All routes are under `/api`. V1 is single-user with no auth (AD-01) — every route resolves the one bootstrap user. Failures return the error envelope `{ "error": { "code", "message", "details?" } }`. Delete semantics are **restrict**: deleting a parent that still has children (or a rule that has study progress) returns `409`.

### System

| Method  | Route            | Purpose                                                                                                                 |
| ------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/health`    | Liveness probe (`{ "status": "ok" }`). Used by the container healthcheck.                                               |
| `GET`   | `/api/dashboard` | Dashboard payload: current streak, today's progress vs. the daily goal, and every notebook with its mastery percentage. |
| `GET`   | `/api/settings`  | The six configurable settings (defaults for a fresh user).                                                              |
| `PATCH` | `/api/settings`  | Partially update settings; omitted fields keep their value. `400` with field-level details when out of range.           |

### Knowledge hierarchy (Area → Disciplina → Topico → Regra)

| Method   | Route                           | Purpose                                                     |
| -------- | ------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/areas`                    | List all areas.                                             |
| `POST`   | `/api/areas`                    | Create an area.                                             |
| `GET`    | `/api/areas/[id]`               | Get an area with its disciplinas and topicos.               |
| `PATCH`  | `/api/areas/[id]`               | Update an area.                                             |
| `DELETE` | `/api/areas/[id]`               | Delete an area (restrict — `409` if it has children).       |
| `GET`    | `/api/areas/[id]/disciplinas`   | List the disciplinas under an area.                         |
| `POST`   | `/api/areas/[id]/disciplinas`   | Create a disciplina under an area.                          |
| `GET`    | `/api/disciplinas/[id]`         | Get a disciplina.                                           |
| `PATCH`  | `/api/disciplinas/[id]`         | Update a disciplina.                                        |
| `DELETE` | `/api/disciplinas/[id]`         | Delete a disciplina (restrict).                             |
| `GET`    | `/api/disciplinas/[id]/topicos` | List the topicos under a disciplina.                        |
| `POST`   | `/api/disciplinas/[id]/topicos` | Create a topico under a disciplina.                         |
| `GET`    | `/api/topicos`                  | List every topico with its disciplina and area names.       |
| `GET`    | `/api/topicos/[id]`             | Get a topico with its regras.                               |
| `PATCH`  | `/api/topicos/[id]`             | Update a topico.                                            |
| `DELETE` | `/api/topicos/[id]`             | Delete a topico (restrict).                                 |
| `GET`    | `/api/topicos/[id]/regras`      | List the regras under a topico.                             |
| `POST`   | `/api/topicos/[id]/regras`      | Create a regra under a topico.                              |
| `GET`    | `/api/regras/[id]`              | Get a regra.                                                |
| `PATCH`  | `/api/regras/[id]`              | Update a regra.                                             |
| `DELETE` | `/api/regras/[id]`              | Delete a regra (restrict — `409` if it has study progress). |
| `GET`    | `/api/knowledge/tree`           | The full nested hierarchy in a single query (no N+1).       |

### Notebooks (Cadernos)

| Method   | Route                       | Purpose                                                                                                                 |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/cadernos`             | List the user's notebooks.                                                                                              |
| `POST`   | `/api/cadernos`             | Create a notebook.                                                                                                      |
| `GET`    | `/api/cadernos/[id]`        | Get a notebook with its regras.                                                                                         |
| `PATCH`  | `/api/cadernos/[id]`        | Update a notebook.                                                                                                      |
| `DELETE` | `/api/cadernos/[id]`        | Delete a notebook (restrict).                                                                                           |
| `POST`   | `/api/cadernos/from-seed`   | Create a notebook from the seeded sample rules. **Idempotent** — `201` on first creation, `200` when it already exists. |
| `POST`   | `/api/cadernos/[id]/regras` | Add a regra to a notebook.                                                                                              |
| `DELETE` | `/api/cadernos/[id]/regras` | Remove a regra from a notebook.                                                                                         |

### Import

| Method | Route                 | Purpose                                                                                                                                                |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/import/preview` | Parse an uploaded CSV/JSON (`{ content, format }`) and return the parsed regras + warnings **without writing**. Enforces the 5 MB / 10 000-row limits. |
| `POST` | `/api/import`         | Bulk-insert parsed regras under a chosen topico. Enforces the same limits server-side.                                                                 |

### Study session

| Method | Route                      | Purpose                                                                                                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/study/session/start` | Start a session: sample due rules (probability-weighted) and build the requested game (`flashcards` \| `match` \| `multiple-choice` \| `cloze`).        |
| `POST` | `/api/study/session/sync`  | Apply the session's grades (SM-2), update the streak, and return the new next-review dates. **Idempotent** per `sessionId` (guarded by `SessaoEstudo`). |

---

## Design tokens

The visual identity is a single dark theme — **Sapphire & Gold Abyss**. All seven semantic tokens live in `:root` in [`src/app/globals.css`](./src/app/globals.css); the Shadcn semantic variables map onto them, and the `.dark` block is intentionally identical.

| Token              | Value     | Role                                                          |
| ------------------ | --------- | ------------------------------------------------------------- |
| `--bg-primary`     | `#0a192f` | Midnight Ocean — app background.                              |
| `--bg-secondary`   | `#112240` | Submarine Waters — cards, side panels, modals.                |
| `--primary`        | `#64ffda` | Sapphire — buttons, links, highlights, progress rings, beams. |
| `--accent`         | `#fbbf24` | Gold/Amber — timers, alerts, streaks, badges.                 |
| `--text-primary`   | `#ccd6f6` | Light Slate — body text, questions, justifications.           |
| `--text-secondary` | `#8892b0` | Muted Slate — hints, dates, menu labels.                      |
| `--error`          | `#f87171` | Dark red — mistake highlights.                                |

**Animation tokens** (plan §2.4): `--duration-fast: 150ms`, `--duration-base: 250ms`, `--duration-slow: 300ms`, `--ease-entrance: ease-out`, `--ease-exit: ease-in`. A global `prefers-reduced-motion` rule collapses transitions to ~0ms.

**Typography:** the system font stack (no web fonts are loaded).

---

## Configurable settings

Six user-tunable settings (AD-10), exposed via `GET`/`PATCH /api/settings` and editable on the Settings screen. Defaults come from the `ConfiguracaoUsuario` model.

| Setting             | Type                  | Default  | Meaning                                                           |
| ------------------- | --------------------- | -------- | ----------------------------------------------------------------- |
| `modoOfensiva`      | `sessoes` \| `regras` | `regras` | How the streak ("ofensiva") is counted — per session or per rule. |
| `limiarOfensiva`    | `int`                 | `1`      | The minimum activity that counts toward the streak.               |
| `metaDiaria`        | `int`                 | `30`     | The daily goal (rules to review per day).                         |
| `segundosPorCartao` | `int`                 | `30`     | Per-card countdown in timed (non-Zen) mode.                       |
| `zenModePadrao`     | `boolean`             | `true`   | Whether sessions start in Zen Mode (untimed) by default (AD-12).  |
| `limiteSessao`      | `int`                 | `20`     | The maximum number of cards per session.                          |

---

## Scripts

| Script                                | What it does                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Start the dev server (Turbopack) on port 3000.                                                                                                |
| `npm run build`                       | Production build (`next build --turbopack`).                                                                                                  |
| `npm run start`                       | Serve the production build.                                                                                                                   |
| `npm run lint`                        | ESLint (flat, strict-type-checked) + Prettier check.                                                                                          |
| `npm run format`                      | Prettier write.                                                                                                                               |
| `npm test`                            | Unit + contract tests against a real ephemeral Postgres 16 (starts `db-test`, migrates, runs Vitest, tears down).                             |
| `npm run test:watch`                  | Vitest in watch mode.                                                                                                                         |
| `npm run test:coverage`               | Unit tests with V8 coverage.                                                                                                                  |
| `npm run test:smoke`                  | The full-loop E2E smoke test (builds + starts the app against an ephemeral DB, drives the whole user journey, verifies the streak increment). |
| `npm run test:db:up` / `test:db:down` | Manually start/stop the ephemeral test database.                                                                                              |
| `npm run prisma:generate`             | Regenerate the Prisma client.                                                                                                                 |
| `npm run prisma:migrate`              | `prisma migrate dev`.                                                                                                                         |
| `npm run prisma:studio`               | Open Prisma Studio.                                                                                                                           |
| `npm run db:seed`                     | Run the idempotent seed.                                                                                                                      |

### Testing

- **Unit + contract tests** (`npm test`) run against a real ephemeral Postgres 16 — no mocked Prisma client. The harness (`scripts/test-db.sh`) starts the `db-test` compose service on port 5433, applies migrations, runs Vitest, and tears the container down.
- **E2E / accessibility** (`tests/e2e/`) run a headless Chromium (Playwright) against the **deployed** app — they never start a local server. Override the target with `E2E_BASE_URL`.
- **Smoke test** (`npm run test:smoke`) is the end-to-end proof: seed → create notebook → start a flashcard session → grade → sync → verify the streak increments. It runs against a real ephemeral DB + a locally-built app, so it passes in CI.
- **CI** (`.github/workflows/ci.yml`) runs on every push and PR: ESLint + Prettier, `tsc --noEmit`, unit tests (Postgres 16 service), the production build, and a Conventional Commits check on main. Node 22 throughout.

---

## Project structure

```
9Atos/
├── src/
│   ├── app/
│   │   ├── [locale]/            # i18n root layout + all pages (pt-BR / en-US)
│   │   │   └── (shell)/         # app shell (side nav + main)
│   │   └── api/                 # all REST routes (see API reference)
│   ├── components/              # UI: dashboard, session games, notebooks, shell, ui/
│   ├── lib/
│   │   ├── prisma.ts            # the single PrismaClient singleton
│   │   ├── srs/                 # the pure SM-2 engine + scheduler
│   │   ├── games/               # the four game builders + grade mapping
│   │   ├── ingestion/           # the CSV/JSON parser
│   │   ├── dashboard.ts         # buildDashboard
│   │   └── settings.ts          # settings defaults + validation
│   └── navigation.ts            # typed Link for the [locale] segment
├── messages/                    # pt.json / en.json dictionaries
├── prisma/
│   ├── schema.prisma            # the relational schema
│   └── seed.ts                  # the idempotent seed
├── tests/
│   ├── e2e/                     # Playwright (against the deployment)
│   ├── smoke/                   # the full-loop smoke test + harness
│   └── *.test.ts                # unit + contract tests
├── .github/workflows/ci.yml     # the CI quality gate
├── compose.yaml                 # Dockhand stack (kept in sync with docker-compose.yml)
├── docker-compose.yml           # local dev stack
├── Dockerfile                   # multi-stage production image
└── playwright*.config.ts        # e2e + smoke Playwright configs
```

---

## Deployment

The app is deployed to **Dockhand** (env "DevMind") as the `9atos` stack from `compose.yaml`, published on host port **3005**. The deployment clones the repository directly, builds the image, and starts the stack; the container's `CMD` runs `prisma generate && prisma migrate deploy && prisma db seed && node server.js` on every start, so a fresh deployment is always migrated and seeded.
