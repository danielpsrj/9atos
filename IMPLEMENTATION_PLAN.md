# 9Atos — Implementation Plan & Requirements

**Source:** `9atos_technical_specification.md` (v1.0, October 2026)
**Scope:** V1 only. V2/V3 items are listed as out-of-scope with architectural hooks noted.

---

## 1. Product Summary

9Atos is a gamified web platform for studying normative texts (legislation, complex knowledge structures). Its core differentiator: a **knowledge base decoupled from the testing interface**. One `Regra` (concept) can be rendered as a Flashcard, Multiple Choice, Matching game, or Fill-in-the-Blanks task. A central **Spaced Repetition System (SRS)** engine (SM-2 variant) schedules reviews for long-term retention.

**V1 is a single-user, local-first web app** (no authentication — see Open Questions). Multi-user, AI ingestion, and mobile are V2/V3.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR-01 | Knowledge hierarchy: `Area → Disciplina → Topico → Regra`, each level addressable and browsable | §3 |
| FR-02 | `Regra` stores: `pergunta`, `respostaCerta`, `justificativa` (opt), `dica` (opt), `distratores` (JSON array), `nivelDificuldade` (1–5), `probabilidade` (0.0–1.0) | §3.1 |
| FR-03 | Notebooks (`Caderno`): user-created collections of rules; many-to-many via `RegraNoCaderno` with cascade delete | §3.1 |
| FR-04 | SRS engine: SM-2 variant with 4 feedback grades (Missed q=1, Hard q=3, Good q=4, Easy q=5); interval reset on error; ease factor floor 1.3; per-user per-rule progress with review history log | §4 |
| FR-05 | Study session start: fetch the most urgent rules for a notebook (by `proximaRevisao`), capped by `limit`, for a chosen `gameType` | §6 |
| FR-06 | Study session sync: batch submission of per-rule quality grades; server applies SRS updates and returns updated scheduling | §6 |
| FR-07 | Four game types, all driven by the same `Regra` data: Flashcards, Multiple Choice (distractors), Matching (concept ↔ definition), Fill-in-the-Blanks (cloze) | §1, §5.2 |
| FR-08 | Matching game UX: two columns (concepts / definitions); correct pair draws a sapphire "electrical beam" then fades out; mistakes flash dark red and increment an internal error counter | §5.2 |
| FR-09 | Game session chrome: thin linear progress bar (top), Exit button (left), Zen Mode indicator or descending gold timer (right) | §5.2 |
| FR-10 | Dashboard: left side-nav layout; header with streak widget (gold flame + day counter) and goal widget (target + "20/30 Rules"); "Your Notebooks" card grid | §5.2 |
| FR-11 | Notebook card: area tag, title, SVG progress ring (primary color) where % = rules with `intervaloDias > 21`, "Study" button | §5.2 |
| FR-12 | Gamification: daily streak counter (`ofensivaAtual` / `maiorOfensiva` on `Usuario`), goal tracking (rules studied today vs. daily goal) | §3.1, §5.2 |
| FR-13 | Data ingestion: import knowledge base from CSV/JSON (parser service) | §2.2 |
| FR-14 | i18n: UI fully locale-aware from day 1; `pt-BR` and `en-US` dictionaries via `next-intl`; DB content (`pergunta`, `resposta`) is NOT translated by the UI engine | §7 |
| FR-15 | `ultimoAcesso` on `Usuario` updated on activity (feeds streak logic) | §3.1 |
| FR-16 | User settings: configurable streak mode + threshold, daily goal, per-card timer seconds, Zen Mode default, session size limit; persisted per user, editable from a Settings screen | Owner decisions (Q1–Q3, Q6) |
| FR-17 | Session sampling: due rules ranked by urgency, then selected with probability weighting by `Regra.probabilidade` | Owner decision (Q5) |

### 2.2 Non-Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| NFR-01 | TypeScript strict mode enforced repository-wide (no `any` leakage; `tsconfig` `strict: true`) | §2.1 |
| NFR-02 | Functional monolith: Next.js App Router with API routes + Server Actions; no separate backend service in V1 | §2.1 |
| NFR-03 | PostgreSQL 16+ accessed exclusively through Prisma; migrations version-controlled | §2.1, §3 |
| NFR-04 | Styling: Tailwind CSS + Radix UI / Shadcn UI primitives; no bespoke CSS frameworks | §2.1 |
| NFR-05 | Design system "Sapphire & Gold Abyss" with WCAG AA contrast (see §3 below) | §5.1 |
| NFR-06 | Containerization: multi-stage Dockerfile (Alpine production image, optimized `node_modules` cache) + `docker-compose.yml` running app and DB in separate containers | §8 |
| NFR-07 | Lean, maintainable codebase; isolated execution on modest infrastructure | §2 |
| NFR-08 | Batched DB writes for session sync (no per-question round-trips) | §6 |
| NFR-09 | Schema designed for multi-user expansion (all progress is per-user; no global state) — V2-ready | §3 |

### 2.3 Design Tokens (binding)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` (Midnight Ocean) | `#0A192F` | App background |
| `bg-secondary` (Submarine Waters) | `#112240` | Cards, side panels, modals |
| `primary` (Sapphire) | `#64FFDA` | Buttons, links, highlights, progress rings, beams |
| `accent` (Gold/Amber) | `#FBBF24` | Timers, alerts, streaks, badges |
| `text-primary` (Light Slate) | `#CCD6F6` | Body text, questions, justifications |
| `text-secondary` (Muted Slate) | `#8892B0` | Hints, dates, menu labels |
| `error` (dark red) | `#F87171` | Mistake highlights (AA-compliant on `#112240`) |

### 2.4 Platform & Code Requirements (binding)

Pinned toolchain and code conventions. Every issue must comply; deviations require an owner decision.

**Runtime & toolchain**

| Item | Requirement |
|------|-------------|
| Node.js | **22 LTS** (Docker: `node:22-alpine`). Node 20 is EOL — do not use. |
| Package manager | **npm**; `package-lock.json` committed. No pnpm/yarn. |
| Framework | **Next.js 15** (App Router) + **React 19** (satisfies spec's "React 18+"). |
| Language | **TypeScript 5.x**, `strict: true` **plus** `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Zero `any` (NFR-01). |
| ORM | **Prisma 6** (PostgreSQL 16+). |
| Styling | **Tailwind CSS 4** + Shadcn UI (latest) on Radix primitives. |
| i18n | **next-intl 4**. |
| Icons | **lucide-react** (flame, target, and all UI icons; `Disciplina.iconeUrl` maps to a lucide icon name). |
| Unit tests | **Vitest 3** (+ `@vitest/coverage-v8`). |
| E2E tests | **Playwright** (latest stable), Chromium only for V1. |
| Lint | **ESLint flat config** + `typescript-eslint` in **strict-type-checked** mode. |
| Format | **Prettier** (single quotes, semicolons, 100-col, trailing commas); `lint` script runs ESLint + Prettier check. |

**Browser & device targets**

- Last **2 major versions** of Chrome, Firefox, Safari, Edge (desktop + mobile). No Internet Explorer, no legacy Safari.
- Minimum supported viewport: **768 px** (below that, the shell collapses per task 5.3).
- No feature detection beyond what Next.js/React 19 baselines provide.

**Dates, time, and timezones**

- Date library: **date-fns**. All datetimes stored in **UTC** in the database.
- All "calendar day" boundaries (streaks, daily goal, `ultimoAcesso` day checks) are evaluated in **America/Sao_Paulo** — the user's exam timezone. This is a V1 constant, not a user setting.
- `proximaRevisao` comparisons use UTC instants; only day-bucketing uses the fixed timezone.

**Typography**

- **System font stack** (no webfonts in V1): `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Scale (Tailwind defaults, binding): body `text-base` (16 px), questions `text-lg`, card titles `text-xl`, dashboard headings `text-2xl`; line-height 1.5 for body, 1.25 for headings.

**Animation**

- Duration tokens: `fast` 150 ms, `base` 250 ms, `slow` 300 ms; easing `ease-out` for entrances, `ease-in` for exits.
- Card flip: 300 ms rotateY; matching beam: 150 ms draw + 250 ms fade; mistake flash: 150 ms in, 250 ms out. Respect `prefers-reduced-motion` (disable non-essential animation).

**API conventions**

- **Error envelope** (all routes): `4xx/5xx` responses return `{ "error": { "code": string, "message": string, "details"?: object } }`. Codes are stable strings (e.g., `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`).
- **Health check**: `GET /api/health` → `200 { "status": "ok" }` (no DB dependency) — used by Docker orchestration.
- Success responses are bare JSON payloads (no envelope).

**Repository & delivery conventions**

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`) — enforced by review; CI check optional in V1.
- **Branching:** V1 works directly on `main` (single developer); no PR flow required, but every issue's work lands as one or more conventional commits referencing the issue number.
- **Security headers** (Next.js `headers()`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive CSP (self only; no third-party origins in V1).
- **Locale persistence:** next-intl locale cookie; default `pt-BR` when absent.

**Data ingestion conventions**

- **CSV header schema** (binding): `pergunta,resposta_certa,justificativa,dica,distratores,nivel_dificuldade,probabilidade` — `distratores` is semicolon-separated; `justificativa`, `dica`, `probabilidade` optional. JSON imports use the same field names as objects/arrays.
- **Import limits:** max **5 MB** file size, max **10,000 rows**; larger files are rejected with a clear error.

**Accepted behaviors (documented, not bugs)**

- Closing the browser mid-session **loses unsynced grades** (sync fires only at session end). No mid-session persistence in V1.
- Performance budget: Lighthouse **Performance ≥ 90** on the dashboard with seeded data (measured in task 9.2).

---

## 3. Architecture Decisions (resolved from spec)

| # | Decision | Rationale |
|---|----------|-----------|
| AD-01 | **Single local user in V1.** No auth. A bootstrap routine creates/loads one `Usuario` row; all routes operate against it. | Spec has no auth fields on `Usuario`; auth is explicitly V2 (NextAuth). |
| AD-02 | **SRS runs server-side only.** Client sends grades; server computes intervals and returns the updated schedule. | §4 "adapted for server-side calculations"; keeps the algorithm in one testable place. |
| AD-03 | **Games are pure functions of `Regra[]`.** A `GameEngine` module takes rules + game type and produces a session model (cards, pairs, cloze gaps, MC options). Distractors come from `Regra.distratores`; when fewer than needed, the engine borrows answers from sibling rules in the same topic (deterministic, seeded). | §1 decoupling principle; §2.2 "Game Logic Engine (Pair matching, distractors)". |
| AD-04 | **Cloze generation is deterministic:** mask the longest contiguous word span of `respostaCerta` (or a marked span if provided later). No LLM in V1. | Keeps V1 dependency-free; AI pipeline is V2. |
| AD-05 | **Streak logic (configurable):** a day counts when the user's activity that day meets a configurable threshold — either ≥N study sessions or ≥N rules reviewed (user picks the mode and the N). `ofensivaAtual` increments on the first qualifying day; resets to 0 if a calendar day is skipped. `maiorOfensiva` = historical max. Defaults: mode = rules, threshold = 1. | Owner decision (Q1): make it configurable. |
| AD-06 | **Daily goal (configurable):** default 30 rules/day (matches the "20/30 Rules" mockup), user-adjustable in settings. | §5.2 mockup + owner decision (Q2). |
| AD-07 | **i18n via `next-intl`** with `[locale]` route segment; default locale `pt-BR` (spec is written for Brazilian exam prep), fallback `en-US`. | §7. |
| AD-08 | **API surface:** `POST /api/study/session/start`, `POST /api/study/session/sync` (per spec) + CRUD routes for the knowledge hierarchy and notebooks (spec implies them via the dashboard) + settings read/update. | §6 + §5.2. |
| AD-09 | **Seed data:** a sample `Area → Disciplina → Topico → Regra` dataset (e.g., Brazilian Constitution, Fundamental Rights) committed to the repo for dev/demo. | Needed to make the dashboard and games demonstrable. |
| AD-10 | **User settings model:** new `ConfiguracaoUsuario` model (1:1 with `Usuario`, created at bootstrap) holding: `modoOfensiva` (`sessoes` \| `regras`), `limiarOfensiva` (Int), `metaDiaria` (Int, default 30), `segundosPorCartao` (Int, default 30), `zenModePadrao` (Boolean, default true), `limiteSessao` (Int, default 20). Keeps the spec's `Usuario` model intact and groups all tunables in one place. | Owner decisions (Q1, Q2, Q3, Q6). |
| AD-11 | **Session sampling weighted by `probabilidade`:** the scheduler ranks due rules by urgency (`proximaRevisao`), then breaks ties and applies stochastic selection weighted by `Regra.probabilidade` (rules with `null` get weight 1.0). Higher-probability rules appear more often across sessions. | Owner decision (Q5): weight sampling, not metadata-only. |
| AD-12 | **Timer & Zen Mode:** timed mode uses a configurable per-card countdown (default 30 s); expiry auto-grades the card as Missed (q=1). **Zen Mode is the default** — sessions start untimed unless the user switches to timed mode. | Owner decision (Q3). |
| AD-13 | **Session size:** default `limit` = 20 rules per session (matches the spec's example payload and the "20/30" mockup); overridable per request and via `ConfiguracaoUsuario.limiteSessao`. | Owner decision (Q6): proposed 20, adopted. |
| AD-14 | **Matching minimum:** a matching session requires ≥4 pairs; if a notebook yields fewer due rules, the engine tops up with the next-most-urgent rules from the same notebook (or the whole knowledge base if the notebook is exhausted) to reach 4. | Owner decision (Q7): proposed 4, adopted. |

---

## 4. Implementation Phases

### Phase 0 — Project Bootstrap
**Goal:** empty repo → running `docker compose up` with a blank Next.js page and a healthy Postgres.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 0.1 | `npx create-next-app` (App Router, TS strict, Tailwind, ESLint) | `npm run dev` serves; `tsc --noEmit` clean |
| 0.2 | Add Prisma; `schema.prisma` with `generator` + `datasource` only | `prisma generate` succeeds |
| 0.3 | `.env` / `.env.example` with `DATABASE_URL=postgresql://postgres:secret@db:5432/9atos` | `.env` git-ignored; example committed |
| 0.4 | Multi-stage `Dockerfile` (deps → build → runner, `node:22-alpine` per §2.4) | `docker build` produces < 400 MB image |
| 0.5 | `docker-compose.yml` per spec §8.2 (web + db, `db_data` volume, `restart: always`) | `docker compose up` → app on :3000, DB reachable |
| 0.6 | `.gitignore`, `LICENSE` (MIT, per README), update `README.md` with real getting-started | README instructions work verbatim |

### Phase 1 — Data Layer
**Goal:** full schema in the database, typed access, seedable.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 1.1 | Write complete Prisma schema (all 8 spec models + `ConfiguracaoUsuario` per AD-10, relations, `@@unique([usuarioId, regraId])`, cascade deletes) | `prisma migrate dev` applies cleanly |
| 1.2 | Prisma client singleton (`lib/prisma.ts`) | No connection leaks in dev |
| 1.3 | Seed script: bootstrap `Usuario` + default `ConfiguracaoUsuario` + sample hierarchy (≥1 Area, ≥2 Disciplinas, ≥3 Topicos, ≥15 Regras with distractors and varied `probabilidade`) | `prisma db seed` populates DB; idempotent |
| 1.4 | Repository layer (`lib/repositories/`): typed CRUD for Area, Disciplina, Topico, Regra, Caderno | Unit-tested with a test DB or mocked client |

### Phase 2 — SRS Engine
**Goal:** the algorithm, pure and exhaustively tested, before any UI touches it.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 2.1 | `lib/srs/engine.ts`: pure function `applyReview(state, q, now) → newState` implementing §4.1 exactly (error reset; 1 → 6 → ×EF progression; EF formula; floor 1.3; `proximaRevisao = now + interval`) | — |
| 2.2 | Unit tests: every grade (1, 3, 4, 5) × every rep stage (0, 1, 2+); EF floor clamp; interval reset after lapse; history append | All pass; table-driven test cases from the spec's formulas |
| 2.3 | `lib/srs/scheduler.ts`: `dueRules(usuarioId, cadernoId?, limit)` — orders by `proximaRevisao <= now` first, then earliest future; overdue always included; ties and over-limit selection use probability-weighted sampling by `Regra.probabilidade` (null → weight 1.0) per AD-11 | Tested: overdue rules always returned first; weighted sampling respects `probabilidade` distribution over many draws (statistical test) |
| 2.4 | Session sync service: applies a batch of `{regraId, qualidade}` atomically (Prisma transaction), appends to `historico`, updates streak fields | Tested: batch of N updates in one transaction |

### Phase 3 — Game Engine
**Goal:** one `Regra[]` in, four playable session models out.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 3.1 | Session model types: `FlashcardSession`, `MatchSession`, `ClozeSession`, `MultipleChoiceSession` | Types compile strict |
| 3.2 | Flashcards: rule → front (`pergunta`) / back (`respostaCerta` + `justificativa` + `dica`) | — |
| 3.3 | Multiple choice: 1 correct + N distractors from `distratores`; if short, borrow from same-topic siblings (seeded shuffle, deterministic per session id) | Tested: never duplicates the correct answer; option count stable |
| 3.4 | Matching: pair concepts with definitions; shuffle columns independently; ≥4 pairs minimum for a session | Tested: bijection preserved |
| 3.5 | Cloze: deterministic gap masking of `respostaCerta` (longest word span); render sentence with blank | Tested: gap always inside the answer text |
| 3.6 | Grade mapping per game type: flashcard/MC → direct 1/3/4/5 button; matching → per-pair correct/missed (missed pairs replayed, final grade = 1 if any miss else 4); cloze → correct/incorrect per blank | Documented in code comments |

### Phase 4 — API Layer
**Goal:** the spec's REST surface plus CRUD, all server-side.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 4.1 | `POST /api/study/session/start` — body `{cadernoId, limit, gameType}`; returns session model (rules formatted for frontend) | Matches §6 contract exactly |
| 4.2 | `POST /api/study/session/sync` — body `{usuarioId, resultados[]}`; transactional SRS apply; returns updated `proximaRevisao` per rule | Matches §6 contract; idempotent per session id (add `sessionId` to prevent double-apply) |
| 4.3 | Knowledge CRUD: `GET/POST/PATCH/DELETE` for areas, disciplinas, topicos, regras (nested under parent routes) | OpenAPI-ish doc comment per route |
| 4.4 | Notebook CRUD: create/rename/delete caderno; add/remove rules | Cascade delete verified |
| 4.5 | Dashboard data route: streak, goal progress, per-notebook ring percentages (interval > 21 days) | Single round-trip payload |
| 4.6 | Settings: `GET /api/settings`, `PATCH /api/settings` (validates ranges: threshold ≥1, goal ≥1, timer 5–120 s, session limit 5–50) | Invalid values rejected with 400 |

### Phase 5 — Design System & Shell
**Goal:** the "Sapphire & Gold Abyss" identity, applied before feature screens.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 5.1 | Tailwind theme extension with the 6 spec tokens + error color; CSS variables for theming | Tokens named per §3 table |
| 5.2 | Shadcn UI init; configure primitives (button, card, dialog, progress, tooltip) to the palette | Components render in-theme |
| 5.3 | App shell: left side-nav (Overview, Notebooks, Knowledge Base, Settings), top header slot | Responsive down to 768 px |
| 5.4 | i18n: `next-intl` setup, `[locale]` segment, `messages/pt.json` + `messages/en.json`, locale switcher in side-nav | All shell strings in both locales; no hardcoded strings (ESLint rule) |
| 5.5 | Accessibility pass: focus rings in sapphire, AA contrast verified for all token pairs, keyboard navigation for nav | Manual checklist + axe scan |

### Phase 6 — Dashboard
**Goal:** Screen 1 from the mockup, live data.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 6.1 | Header: "Overview" title; streak widget (gold flame + "N Days"); goal widget (target + "X/30 Rules") | Values from dashboard data route |
| 6.2 | Notebook card grid (`#112240` cards): area tag, title, SVG progress ring (sapphire, % = rules with interval > 21), "Study" button | Ring animates on load; empty state when no notebooks |
| 6.3 | "New Notebook" flow (dialog: name, description) | Creates caderno, appears in grid |
| 6.4 | Empty/onboarding state: first-run screen prompting to import data or use the seed | Shown when 0 notebooks |
| 6.5 | Settings screen (side-nav entry): streak mode + threshold, daily goal, timer seconds, Zen Mode default, session size — all persisted via 4.6 | Changes take effect on next session; values round-trip |

### Phase 7 — Game Screens
**Goal:** Screen 2 chrome + all four games playable end-to-end.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 7.1 | Session chrome: top linear progress bar; Exit (left, confirm dialog); Zen Mode toggle / descending gold timer (right). **Zen Mode is the default** (AD-12); timed mode uses the user-configurable per-card countdown | Timer pauses in Zen Mode; exit mid-session discards unsynced grades with confirmation |
| 7.2 | Flashcards: flip animation, grade buttons (Missed/Hard/Good/Easy) after reveal, justification + hint display | Grade → next card; session ends → sync |
| 7.3 | Matching: two columns; click-to-select; correct pair → sapphire beam animation → fade out; wrong pair → dark red (`#F87171`) flash + error counter. Enforces the ≥4-pair minimum (AD-14) with top-up from next-most-urgent rules | Beam is a CSS/SVG line between the two cards; session ends when all pairs matched; top-up verified when notebook has <4 due rules |
| 7.4 | Multiple choice: question + options; instant feedback (correct = sapphire, wrong = red + show justification) | — |
| 7.5 | Cloze: sentence with blank; type-to-fill or pick-from-options; per-blank feedback | — |
| 7.6 | Session end: results summary (correct %, per-rule grades), then `POST /sync` | Sync fires exactly once; UI shows updated "next review" info |
| 7.7 | Timer mode: countdown per card (gold, default 30 s, user-configurable 5–120 s); expiry auto-grades as Missed (q=1) | Configurable seconds honored; Zen Mode (default) disables it |

### Phase 8 — Ingestion & Knowledge Base UI
**Goal:** get real content in without hand-editing the DB.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 8.1 | CSV/JSON parser service: validates schema, maps columns to `Regra` fields, rejects bad rows with line-level errors | Unit-tested with fixture files (valid + malformed) |
| 8.2 | Import UI: upload → preview parsed rows → confirm → bulk insert under chosen Topico | Progress feedback for large files |
| 8.3 | Knowledge Base browser: tree (Area → Disciplina → Topico → Regra), create/edit/delete at every level, rule editor with distractor list editor | Full CRUD round-trip works |
| 8.4 | Notebook builder: browse knowledge tree, select rules, add to caderno | Selection state persists across navigation |

### Phase 9 — Hardening & Delivery
**Goal:** production-shaped V1.

| Task | Details | Acceptance criteria |
|------|---------|---------------------|
| 9.1 | Error boundaries + toast system (red/gold per severity) | No white-screen on API failure |
| 9.2 | Loading states (skeletons) for dashboard and session start | No layout shift |
| 9.3 | E2E smoke test (Playwright): seed → create notebook → start flashcard session → grade → sync → streak increments | Passes in CI |
| 9.4 | CI workflow: lint + typecheck + unit tests + build on push | Green on main |
| 9.5 | Final README: real architecture diagram, API table, dev workflow, Docker usage | A new clone works in < 10 minutes |
| 9.6 | Tag `v1.0.0` | — |

---

## 5. Milestones & Dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6 ──► Phase 7 ──► Phase 8 ──► Phase 9
 bootstrap   data        SRS         games       API         design      dashboard   games UI    ingestion   ship
```

- Phases 2 and 3 are independent of each other (both need Phase 1) and can run in parallel.
- Phase 5 (design system) can start as soon as Phase 0 lands; it unblocks 6 and 7.
- Phase 8 depends on Phase 4 (CRUD APIs) but its parser (8.1) is testable earlier.
- **Milestone M1 (usable demo):** end of Phase 7 — seed data, dashboard, all four games, SRS working.
- **Milestone M2 (V1 complete):** end of Phase 9.

---

## 6. Testing Strategy

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| SRS engine | Vitest, table-driven | 100% of formula branches (every q, every rep stage, floor clamp, lapse reset) |
| Game engine | Vitest | Distractor borrowing, cloze masking, matching bijection, determinism (same seed → same session) |
| API routes | Vitest + Prisma test DB (or `prisma db push` on ephemeral container) | Contract tests for §6 endpoints; transaction atomicity for sync |
| UI | Playwright | E2E smoke (task 9.3); component tests only where logic is non-trivial (progress ring, timer) |
| i18n | ESLint `no-hardcoded-strings` + snapshot of both dictionaries | No missing keys in either locale |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SM-2 edge cases (EF drift, interval explosion) produce bad schedules | Learning quality degrades silently | Pure-function engine + exhaustive unit tests before any UI integration (Phase 2 gate) |
| Distractor shortage for MC/cloze in small topics | Unplayable sessions | Borrowing strategy (AD-03) + import validation warns when a topic has < 4 rules |
| Single-user assumption breaks when V2 auth lands | Migration pain | All queries already scoped by `usuarioId` (NFR-09); bootstrap user is just a row |
| Scope creep toward V2 (AI, social) | V1 slips | This plan is the contract; V2 items are explicitly excluded |
| Cloze masking produces ambiguous gaps | Wrong answers accepted | Deterministic longest-span rule + per-blank exact-match validation |

---

## 8. Resolved Decisions (owner sign-off)

All previously open questions are resolved. These are binding for V1:

| # | Question | Decision |
|---|----------|----------|
| Q1 | Streak definition | **Configurable** — user chooses mode (sessions/day or rules/day) and threshold (AD-05, AD-10) |
| Q2 | Daily goal | **Configurable** — default 30 rules/day, user-adjustable (AD-06, AD-10) |
| Q3 | Timer defaults | Per-card seconds **configurable** (default 30 s); **Zen Mode is the default** (AD-12) |
| Q4 | Error color | `#F87171` (proposal adopted) |
| Q5 | `probabilidade` field | **Weights session sampling** — not metadata-only (AD-11) |
| Q6 | Session size | **Default 20** (proposed, adopted); overridable per request and in settings (AD-13) |
| Q7 | Matching minimum | **4 pairs** (proposal adopted), with top-up logic (AD-14) |

---

*End of implementation plan.*
