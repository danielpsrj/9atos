# 9Atos

A gamified web platform for studying and memorizing normative texts, legislation, and complex knowledge structures. A single concept can be played as a Flashcard, Multiple Choice, Matching game, or Fill-in-the-Blanks task, all scheduled by a Spaced Repetition System (SM-2 variant) for long-term retention.

Built as a functional monolith: **Next.js 15 (App Router) + TypeScript (strict) + Prisma 6 + PostgreSQL 16 + Tailwind CSS 4**, containerized with Docker.

## Prerequisites

- **Node.js 22 LTS** (see `.nvmrc`) and **npm**
- **Docker** with the Compose plugin (for the bundled PostgreSQL)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env

# 3. Start the app and PostgreSQL via Docker Compose
docker compose up -d

# 4. Open the app
#    → http://localhost:3005
```

The database schema and seed data are added in Phase 1 of the implementation plan. Once present, run:

```bash
npm run prisma:migrate   # create the schema
npm run db:seed          # load the bootstrap user + sample knowledge base
```

### Development without Docker

If you already run PostgreSQL elsewhere, point `DATABASE_URL` in `.env` at it, then:

```bash
npm run dev              # → http://localhost:3000
```

## Scripts

| Script                    | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Start the dev server (Turbopack) on port 3000 |
| `npm run build`           | Production build                              |
| `npm start`               | Serve the production build                    |
| `npm run lint`            | ESLint (strict-type-checked) + Prettier check |
| `npm run format`          | Prettier write                                |
| `npm test`                | Run unit tests (Vitest)                       |
| `npm run test:coverage`   | Unit tests with V8 coverage                   |
| `npm run prisma:generate` | Regenerate the Prisma client                  |
| `npm run prisma:migrate`  | Create/apply a dev migration                  |
| `npm run prisma:studio`   | Open Prisma Studio                            |
| `npm run db:seed`         | Seed the database                             |

## Project Structure

```
.
├── prisma/
│   └── schema.prisma        # Database schema (PostgreSQL)
├── prisma.config.ts         # Prisma 6 config (seed command, dotenv)
├── src/
│   └── app/
│       └── api/health/      # GET /api/health (container healthcheck)
├── compose.yaml             # Dockhand deployment stack
├── docker-compose.yml       # Local development stack (kept in sync)
├── Dockerfile               # Multi-stage production image (node:22-alpine)
├── 9atos_technical_specification.md
└── IMPLEMENTATION_PLAN.md
```

## Environment

| Variable       | Description                  | Default (`.env.example`)                     |
| -------------- | ---------------------------- | -------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:secret@db:5432/9atos` |

## License

This project is licensed under the [MIT License](LICENSE).
