# 9Atos — End-to-End QA Testing Plan

**Role:** Principal QA Lead / Full-Stack Systems Engineer
**Application:** 9Atos — single-user, no-auth spaced-repetition (SRS) study app for Brazilian law exam prep (OAB / Constituição Federal).
**Stack:** Node 22 · Next.js 15 + React 19 · TypeScript (extended-strict) · Prisma 6 + Postgres 16 · Tailwind 4 · next-intl 4 · Vitest 3 · Playwright (Chromium) · ESLint flat + strict-type-checked + Prettier.
**Deployment under test:** Dockhand env 1 "DevMind" at `http://192.168.1.207:3005` (host port 3005). The Postgres volume persists across redeploys.
**Date:** 2026-11-12

---

## 1. Test Plan Overview & Objectives

### 1.1 Scope

**In-scope** (every user-facing surface and the API contract that backs it):

| Module               | Routes / Surfaces                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview / Dashboard | `/` · `GET /api/dashboard` · `GET /api/health`                                                                                                                                                                            |
| User                 | `/user` (streak, daily goal)                                                                                                                                                                                              |
| Knowledge Base       | `/knowledge` · KnowledgeList (Conhecimento unities) · KnowledgeTree (Area→Disciplina→Topico→Regra CRUD) · `GET /api/knowledge/tree` · area/disciplina/topico/regra CRUD routes · `?cascade=true` delete                   |
| Import               | `/knowledge` (ImportScreen) · `POST /api/import/preview` · `POST /api/import` · CSV/JSON parser + column mapping                                                                                                          |
| Notebooks            | `/notebooks` · notebook builder · `GET                                                                                                                                                                                    | POST /api/cadernos`·`POST         | DELETE /api/cadernos/[id]/regras`·`POST /api/cadernos/from-seed` |
| Notebook Statistics  | `/notebooks/[id]/estatisticas` · `GET /api/cadernos/[id]/estatisticas` · memory-stage donut, per-game plays, per-game usage (7/30/90-day)                                                                                 |
| Study Session        | `/study?cadernoId=…&game=…` · 4 games (flashcards, match, multiple-choice, cloze) · `POST /api/study/session/start` · `POST /api/study/session/sync` · session persistence (localStorage) · Zen Mode · browse (prev/next) |
| Settings             | `/settings` · `GET                                                                                                                                                                                                        | PATCH /api/settings` (6 settings) |
| Cross-cutting        | i18n (pt-BR / en-US), error envelope + error boundary, not-found, accessibility, design tokens, loading states, responsive layout                                                                                         |

**Explicitly out-of-scope:**

- Authentication / multi-user (V1 is single-user, no auth by design — AD-01).
- Real-time / WebSocket behavior (the app is request/response; the session is client-side state).
- Mobile native apps (web-only; responsive web is in-scope).
- Performance/load testing beyond a Lighthouse performance pass on the deployment (no soak or stress testing in V1).
- The ephemeral test-DB harness itself (`scripts/test-db.sh`, `db-test` profile) — it is a test _tool_, not a product surface.

### 1.2 High-level test goals

1. **Functional correctness** — every CRUD operation, the import pipeline, the SRS engine, and the study-session lifecycle behave per spec, with correct success _and_ error responses.
2. **UI/UX fidelity** — the single dark theme renders with the 7 binding design tokens; no text overflow, missing states, broken images, or layout breakage at the reference viewport (1440×900) and at mobile (390×844).
3. **Data integrity** — the knowledge hierarchy, notebook membership, and study progress are consistent; cascade deletes remove the full subtree _and_ the study progress in one transaction; the SRS `historico` log is append-only and correct.
4. **Error resilience** — every failure path returns the `{error:{code,message,details?}}` envelope with the right HTTP status and `ErrorCode`; the UI surfaces a readable message (never a raw stack trace or a blank screen).
5. **Internationalization** — pt-BR and en-US are key-parity-complete and every user-facing string is translated (no leaked keys, no mixed languages).
6. **Accessibility** — keyboard navigability, focus visibility (the global sapphire `:focus-visible` ring), ARIA labels on icon-only buttons, and sufficient color contrast.

### 1.3 Quality exit criteria

The release is shippable when **all** of the following hold:

- **Zero** Severity-1 (data loss / crash / broken core flow) and Severity-2 (feature unusable) defects open.
- The full Vitest suite (231 tests) and the Playwright E2E suite (12 specs) + smoke spec pass on a clean build.
- `tsc --noEmit`, `eslint` (strict-type-checked), and `prettier --check` are all green.
- `next build` (Turbopack, which runs ESLint) succeeds with a fresh cache.
- Lighthouse performance on the deployment ≥ 90 (no regressions).
- Every in-scope module has at least one passing E2E scenario with screenshot evidence archived.
- i18n key-parity test passes (pt-BR ↔ en-US).

---

## 2. Functional & UI/UX Screenshot Verification Workflow

### 2.1 When and where to capture screenshots

Capture a screenshot at **every** one of these checkpoints during a test run. Name files `<scenario-id>-<checkpoint>.png` and store them under `qa-evidence/` (or attach to the defect issue).

| Checkpoint type            | When                                                                    | Example                                                  |
| -------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| **Pre-action**             | Immediately before a user action that mutates state                     | Before confirming a delete, before confirming an import  |
| **Post-action (success)**  | After a successful mutation, once the UI has settled (`networkidle`)    | The tree after a cascade delete; the import result toast |
| **Error state**            | Whenever an error envelope is returned or an error boundary renders     | A 409 CONFLICT dialog; a validation-error banner         |
| **Loading state**          | While an async operation is in flight (indeterminate indicator visible) | The import "Parsing file…" indicator                     |
| **Empty state**            | When a list has no items                                                | An empty notebook; a knowledge tree with no areas        |
| **Responsive breakpoints** | At 1440×900 (reference), 1024×768 (tablet), 390×844 (mobile)            | The study session at mobile width                        |
| **Both locales**           | Repeat the key journeys under `/pt-BR/…` and `/en-US/…`                 | The import mapping dialog in en-US                       |

**How to capture (Playwright):**

```js
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: `qa-evidence/${id}-${checkpoint}.png`, fullPage: true });
```

Always `waitUntil: 'networkidle'` (or an explicit `waitFor` on the target element) before capturing, so the screenshot reflects the settled state, not a mid-render frame. For loading states, capture _before_ the settle.

### 2.2 UI/UX review checklist

For **each** captured screenshot, review against this table. A "fail" on any row is a UI/UX defect (log it per §2.3).

| #   | Criterion                         | What to look for                                                                                                                  | Pass / Fail |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **Alignment**                     | Elements align to the grid; no unintended offsets; consistent gutters/margins                                                     |             |
| 2   | **Text overflow / truncation**    | No clipped or overflowing text; long strings truncate with ellipsis where designed (e.g. tree node names use `truncate`)          |             |
| 3   | **Missing / wrong states**        | Every interactive element shows its correct state (default, hover, focus, disabled, loading, success, error)                      |             |
| 4   | **Loading spinners / indicators** | Async actions show an indeterminate indicator; no frozen UI; indicator clears on completion                                       |             |
| 5   | **Console errors**                | Zero uncaught exceptions, React error-boundary triggers, or failed network requests in the browser console / DevTools network tab |             |
| 6   | **Broken images / icons**         | All lucide icons and any raster images render (no empty boxes); SVGs are not distorted                                            |             |
| 7   | **Design tokens**                 | Colors match the 7 binding tokens (`--bg-primary #0a192f`, `--primary #64ffda`, `--error #f87171`, …); no off-palette colors      |             |
| 8   | **Focus visibility**              | Keyboard focus shows the global sapphire `:focus-visible` ring (2px) on every focusable element                                   |             |
| 9   | **Contrast**                      | Text meets WCAG AA contrast against its background (verify with the `/theme` token page + a contrast checker)                     |             |
| 10  | **Responsive integrity**          | At 390×844 no horizontal scroll, no overlapping elements, tap targets ≥ 44px                                                      |             |
| 11  | **i18n correctness**              | All strings in the active locale; no leaked `Namespace.key` tokens; no mixed-language output                                      |             |
| 12  | **Animation / motion**            | Transitions use the binding durations (150/250/300ms); `prefers-reduced-motion` is honored (no motion when set)                   |             |

### 2.3 Annotating and logging UI/UX defects with visual evidence

When a checklist row fails, file a GitHub issue that includes:

1. **Title** — `[UI] <module>: <one-line defect>` (e.g. `[UI] Import: mapping dialog select overflows at 390px`).
2. **The screenshot** — the failing checkpoint image, attached to the issue body.
3. **An annotation** — a second, annotated copy of the screenshot (draw a red box/arrow on the defect) so the problem is unambiguous without reading the prose.
4. **Reproduction** — exact URL, locale, viewport, and the click/type steps to reach the state.
5. **Expected vs. actual** — what the design intends vs. what renders.
6. **Console / network evidence** — paste any console error or failed request (status + response body) that accompanies the visual defect.
7. **Severity / priority** — per the §5 framework.

---

## 3. Back-End Log Review & Troubleshooting Protocol

9Atos is a single Next.js service (no microservices), so "log streams" are: the **Next.js server console** (stdout/stderr of the `web` container), the **Postgres server log** (`db` container), and the **application's own audit trail** (the `ProgressoUsuario.historico` JSON log and the request/response envelope). There is no distributed trace ID; correlation is by **timestamp + the idempotent `sessionId`** (for study sync) or by **resource id** (for CRUD).

### 3.1 What to tail / query during and after a test run

| Source                           | How to access                                                                     | What it tells you                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Next.js server console**       | `docker logs <web-container>` on the Dockhand host, or the Dockhand stack logs UI | Unhandled promise rejections, Prisma errors (P2002/P2003/P2025), 500 stack traces, route handler exceptions |
| **Postgres server log**          | `docker logs <db-container>`                                                      | Deadlocks, slow queries, connection errors, constraint violations                                           |
| **`ProgressoUsuario.historico`** | `SELECT historico FROM "ProgressoUsuario" WHERE "regraId" = …`                    | The append-only SRS log — verify each study sync appended exactly one `{date, grade, game?}` entry          |
| **Request/response envelope**    | The HTTP response body of every API call (capture in the E2E run)                 | The `{error:{code,message,details?}}` on failure; the resource on success                                   |
| **`/api/health`**                | `GET /api/health`                                                                 | Liveness; must return 200 with a healthy body                                                               |

### 3.2 Patterns, codes, and signatures to look for

| Signal                                            | Meaning                                                                                                | Action                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **HTTP 500** + `INTERNAL_ERROR`                   | Unhandled exception in a route handler                                                                 | Pull the server console stack trace at that timestamp; reproduce; file a Sev-1/Sev-2 defect |
| **HTTP 400** + `VALIDATION_ERROR`                 | Bad request body / shape                                                                               | Confirm the UI sent a well-formed body; if the UI is at fault, it's a front-end defect      |
| **HTTP 404** + `NOT_FOUND`                        | Resource missing (Prisma P2025)                                                                        | Expected for a deleted/unknown id; unexpected if the id should exist                        |
| **HTTP 409** + `CONFLICT`                         | FK restriction (Prisma P2003) — e.g. deleting a node that still has children _without_ `?cascade=true` | Expected on a non-cascade delete of a parent; a defect if a cascade delete still 409s       |
| **Prisma P2002** (unique violation)               | Duplicate unique key                                                                                   | Data-integrity defect                                                                       |
| **Unhandled promise rejection** in server console | A `fetch`/`prisma` call rejected without a catch                                                       | Sev-1 (silent failure)                                                                      |
| **Slow query > 500ms** in Postgres log            | N+1 or missing index on a list/tree query                                                              | Performance defect (note the query + the triggering route)                                  |
| **Deadlock** in Postgres log                      | Concurrent transaction conflict                                                                        | Sev-2; capture both transactions                                                            |
| **`historico` missing an entry** after a sync     | The SRS log did not record the grade                                                                   | Data-integrity Sev-1                                                                        |
| **Streak / day-boundary mismatch**                | A review counted on the wrong day                                                                      | The `America/Sao_Paulo` day boundary was misapplied — Sev-2                                 |

### 3.3 Correlating a UI action with a back-end event

1. **Note the wall-clock timestamp** (to the second) of the UI action.
2. **For a study sync**, the `sessionId` is the correlation key: `grep <sessionId>` in the server console and `SELECT … WHERE "sessionId" = …` — the sync is idempotent per `sessionId`, so a replay is detectable.
3. **For a CRUD mutation**, correlate by the **resource id** in the response body and the matching `WHERE id = …` in the server/DB logs at that timestamp.
4. **For an import**, correlate by the **row count** in the response (`inserted`, `rowCount`) and the number of `Regra` rows created in that window.
5. Record the correlation (timestamp + key) in the defect's diagnostic bundle (§5.2).

---

## 4. End-to-End Test Scenario Matrix

Each scenario lists: **ID & title**, **preconditions**, **execution steps**, **expected UI result + screenshot checkpoint**, and **expected back-end/DB state + log checkpoint**. "Capture" = take a screenshot at that checkpoint.

### 4.1 Dashboard / Overview

| ID        | Title                           | Preconditions                              | Steps                | Expected UI + 📸                                                                                                                 | Expected back-end/DB + log                                                                                                                                      |
| --------- | ------------------------------- | ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OV-01** | Dashboard loads with real stats | Seeded notebook with reviewed rules exists | 1. `GET /pt-BR/`     | Dashboard renders: current streak, best streak, daily goal, "reviewed today", and a notebook ring list. 📸 `ov-01-dashboard.png` | `GET /api/dashboard` → 200 `{ofensivaAtual, maiorOfensiva, metaDiaria, revisadasHoje, cadernos[]}`; `ringPercentage` = share of rules with `intervaloDias > 21` |
| **OV-02** | Health endpoint is live         | —                                          | 1. `GET /api/health` | (no UI) 200 healthy body                                                                                                         | 200; no server-console errors                                                                                                                                   |
| **OV-03** | Empty dashboard (no notebooks)  | A fresh DB with no cadernos                | 1. `GET /pt-BR/`     | Empty state, no crash, no NaN. 📸 `ov-03-empty.png`                                                                              | `cadernos: []`, `revisadasHoje: 0`                                                                                                                              |

### 4.2 Knowledge hierarchy (CRUD + cascade)

| ID        | Title                                     | Preconditions                                                       | Steps                                                                          | Expected UI + 📸                                                                                                                                             | Expected back-end/DB + log                                                                                                 |
| --------- | ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **KN-01** | Create Area → Disciplina → Topico → Regra | On `/knowledge`                                                     | 1. Create an area, a disciplina under it, a topico, a regra (with distratores) | Each node appears in the tree as created; regra editor shows the distractor list. 📸 `kn-01-created.png`                                                     | 4× 201/200; `GET /api/knowledge/tree` returns the nested node                                                              |
| **KN-02** | Edit a regra                              | A regra exists                                                      | 1. Open the regra editor, change `pergunta` + a distrator, save                | The tree reflects the edit. 📸 `kn-02-edited.png`                                                                                                            | `PATCH /api/regras/[id]` → 200 with updated fields                                                                         |
| **KN-03** | Delete a leaf regra                       | A regra with **no** progress                                        | 1. Delete the regra                                                            | Node removed; no warning. 📸 `kn-03-leaf-deleted.png`                                                                                                        | `DELETE /api/regras/[id]` → 200; regra gone                                                                                |
| **KN-04** | Non-cascade delete of a parent is blocked | An area with a disciplina                                           | 1. `DELETE /api/areas/[id]` (no cascade)                                       | 409 CONFLICT surfaced in the UI dialog. 📸 `kn-04-conflict.png`                                                                                              | 409 `{error:{code:CONFLICT}}`; server log shows P2003                                                                      |
| **KN-05** | Cascade delete removes subtree + progress | An area→disc→top→regra where the regra has a `ProgressoUsuario` row | 1. Delete the area with `?cascade=true`                                        | Dialog shows "Isso também excluirá N item(ns) filho(s)."; after confirm the whole subtree is gone. 📸 `kn-05-cascade-warning.png` + `kn-05-cascade-done.png` | 200; area, disciplina, topico, regra **and** the `ProgressoUsuario` row all return 404; one transaction (no partial state) |
| **KN-06** | Conhecimento (unity) list                 | A multi-content import has occurred                                 | 1. View the KnowledgeList                                                      | The unity is listed with its rule count. 📸 `kn-06-unities.png`                                                                                              | `GET /api/conhecimentos` → 200 list                                                                                        |

### 4.3 Import (CSV/JSON + column mapping)

| ID        | Title                                          | Preconditions                              | Steps                                      | Expected UI + 📸                                                                                                    | Expected back-end/DB + log                                                                                                            |
| --------- | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **IM-01** | Exact-header CSV imports                       | A valid binding-header CSV                 | 1. Upload, preview, choose topico, confirm | Preview lists all valid rows; import reports N inserted. 📸 `im-01-preview.png` + `im-01-imported.png`              | `POST /api/import/preview` → 200 `{regras,errors,warnings,rowCount}`; `POST /api/import` → 200 `{inserted:N}`; N `Regra` rows created |
| **IM-02** | Non-binding header triggers the mapping dialog | A CSV with English/different-order headers | 1. Upload                                  | The "Mapear colunas" dialog appears with columns auto-mapped from the alias table. 📸 `im-02-mapping.png`           | `POST /api/import/preview` → 200 `{needsMapping:true, headerColumns, suggestedMapping}`                                               |
| **IM-03** | Mapped import reorders columns                 | From IM-02, confirm the mapping            | 1. Confirm mapping, preview, import        | Preview shows rows in binding order (pergunta/resposta correct); import inserts them. 📸 `im-03-mapped-preview.png` | `POST /api/import` with `columnMapping` → 200; regras have the mapped fields                                                          |
| **IM-04** | Malformed rows are rejected, not fatal         | A CSV with some bad rows                   | 1. Upload, preview                         | Valid rows shown; bad rows listed with line-level errors. 📸 `im-04-rejected.png`                                   | `errors[]` with `{line, message}`; only valid rows inserted                                                                           |
| **IM-05** | Oversized file rejected                        | A > 5 MB file                              | 1. Upload                                  | "file too large" error, nothing sent/parsed. 📸 `im-05-too-large.png`                                               | 400 `VALIDATION_ERROR` (or client-side block before send)                                                                             |
| **IM-06** | Over-limit row count rejected                  | A > 10,000-row file                        | 1. Upload                                  | Row-limit error. 📸 `im-06-too-many-rows.png`                                                                       | 400 `VALIDATION_ERROR` with `rowCount`/`maxRows` details                                                                              |
| **IM-07** | JSON import                                    | A valid JSON array of regras               | 1. Upload, preview, import                 | Parses and imports. 📸 `im-07-json.png`                                                                             | 200; camelCase fields mapped                                                                                                          |

### 4.4 Notebooks + statistics

| ID        | Title                            | Preconditions                               | Steps                                  | Expected UI + 📸                                                                                                                                | Expected back-end/DB + log                                                                                         |
| --------- | -------------------------------- | ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **NB-01** | Create a notebook and add rules  | On `/notebooks`                             | 1. Create a notebook, add regras to it | Notebook appears; rule count updates. 📸 `nb-01-created.png`                                                                                    | `POST /api/cadernos` → 201; `POST /api/cadernos/[id]/regras` → 200                                                 |
| **NB-02** | Notebook statistics render       | A notebook with reviewed rules across games | 1. Open `/notebooks/[id]/estatisticas` | Memory-stage donut (long-term/recent/not-learned), per-game plays, per-game usage (7/30/90-day) all render with real data. 📸 `nb-02-stats.png` | `GET /api/cadernos/[id]/estatisticas` → 200 with the three datasets; day keys are `yyyy-MM-dd` (America/Sao_Paulo) |
| **NB-03** | Statistics for an empty notebook | A notebook with 0 rules                     | 1. Open its statistics                 | Empty/zero state, no crash, no NaN. 📸 `nb-03-empty-stats.png`                                                                                  | 200 with empty datasets                                                                                            |

### 4.5 Study session (the 4 games + lifecycle)

| ID        | Title                                           | Preconditions                                  | Steps                                                          | Expected UI + 📸                                                                                                                          | Expected back-end/DB + log                                                                                                                            |
| --------- | ----------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ST-01** | Flashcards: grade and advance                   | A notebook with ≥ 1 rule                       | 1. Start a flashcards session, flip a card, grade it (1/3/4/5) | Card flips; grade buttons; advancing moves to the next card. 📸 `st-01-flashcard.png`                                                     | `POST /api/study/session/start` → 200 session; on finish `POST /api/study/session/sync` → 200; `historico` gains one `{date,grade,game:'flashcards'}` |
| **ST-02** | Multiple-choice: correct + wrong feedback       | A rule with ≥ 3 distratores                    | 1. Answer correctly, then incorrectly                          | Correct → sapphire highlight; wrong → red + the correct option revealed + justificativa. 📸 `st-02-mc-correct.png` + `st-02-mc-wrong.png` | Grade recorded (4 for correct, 1 for wrong)                                                                                                           |
| **ST-03** | Matching: pair and miss                         | A rule set with ≥ 4 pairs                      | 1. Match pairs; deliberately miss one                          | Correct pair → sapphire beam; a missed pair is graded 1 at the end. 📸 `st-03-match.png`                                                  | ever-missed → grade 1; never-missed → grade 4                                                                                                         |
| **ST-04** | Cloze: fill the gap                             | A rule usable as cloze                         | 1. Type the missing word (case/whitespace-insensitive)         | Correct → grade 4; incorrect → grade 1. 📸 `st-04-cloze.png`                                                                              | Grade recorded accordingly                                                                                                                            |
| **ST-05** | Session completes → ResultsSummary + one sync   | Any game, all cards graded                     | 1. Grade every card                                            | ResultsSummary shows; **exactly one** sync fires (`syncedRef` guard). 📸 `st-05-results.png`                                              | One `POST /api/study/session/sync`; `historico` gains exactly N entries (one per card)                                                                |
| **ST-06** | Browse without solving (prev/next)              | A session in progress                          | 1. Use the prev/next arrows                                    | Card changes without recording a grade; done/remaining count unchanged. 📸 `st-06-browse.png`                                             | No sync; no new `historico` entry                                                                                                                     |
| **ST-07** | Persistence: leave and resume                   | A session in progress                          | 1. Grade a card, navigate away, return                         | The session restores at the right card with the grade preserved (localStorage). 📸 `st-07-resume.png`                                     | No server record of the in-progress session (client-side only); restore skips the start API                                                           |
| **ST-08** | Zen Mode default                                | Settings `zenModePadrao: true`                 | 1. Start a session                                             | Zen Mode is on by default (AD-12). 📸 `st-08-zen.png`                                                                                     | —                                                                                                                                                     |
| **ST-09** | Completion by graded count, not browse position | A session where you browse past ungraded cards | 1. Browse to the end without grading everything                | The session does **not** end early; it ends only when `gradedIds.size >= total`. 📸 `st-09-graded-count.png`                              | Sync fires only on true completion                                                                                                                    |

### 4.6 Settings

| ID        | Title                        | Preconditions  | Steps                                                         | Expected UI + 📸                                          | Expected back-end/DB + log                                             |
| --------- | ---------------------------- | -------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| **SE-01** | Change and persist a setting | On `/settings` | 1. Change `metaDiaria`, save                                  | The value persists across a reload. 📸 `se-01-saved.png`  | `PATCH /api/settings` → 200; `GET /api/settings` returns the new value |
| **SE-02** | Invalid setting rejected     | On `/settings` | 1. Submit an out-of-range value (e.g. `segundosPorCartao: 0`) | Validation error; value unchanged. 📸 `se-02-invalid.png` | 400 `VALIDATION_ERROR`                                                 |

### 4.7 Cross-cutting

| ID        | Title                            | Preconditions                   | Steps                                          | Expected UI + 📸                                                                                     | Expected back-end/DB + log                       |
| --------- | -------------------------------- | ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **XC-01** | Locale switch pt-BR ↔ en-US      | Any page                        | 1. Switch locale                               | All strings translate; no leaked keys. 📸 `xc-01-en.png`                                             | i18n key-parity holds                            |
| **XC-02** | Error boundary on a render throw | The `/error-boundary-test` page | 1. Trigger a render throw                      | The error boundary renders a readable message, not a blank screen. 📸 `xc-02-error-boundary.png`     | No unhandled rejection escapes to a white screen |
| **XC-03** | Not-found route                  | An unknown path                 | 1. `GET /pt-BR/does-not-exist`                 | The not-found page renders. 📸 `xc-03-404.png`                                                       | `notFound()`                                     |
| **XC-04** | Accessibility: keyboard + focus  | Any page                        | 1. Tab through every focusable element         | The sapphire `:focus-visible` ring appears; icon-only buttons have ARIA labels. 📸 `xc-04-focus.png` | No console a11y errors                           |
| **XC-05** | Mobile responsive (390×844)      | Key pages                       | 1. View dashboard, knowledge, study at 390×844 | No horizontal scroll, no overlap, tap targets ≥ 44px. 📸 `xc-05-mobile-*.png`                        | —                                                |
| **XC-06** | Design tokens                    | The `/theme` page               | 1. View the token page                         | All 7 binding tokens render with the exact hex values. 📸 `xc-06-tokens.png`                         | —                                                |

---

## 5. Defect Triage & Escalation Framework

### 5.1 Severity × Priority

Severity describes **impact**; Priority describes **urgency of fix**. A defect's Priority is at least its Severity.

| Severity             | Definition (UI breakage + back-end root cause)                              | Examples                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sev-1 (Critical)** | Data loss, crash, or a core flow is unusable; or silent back-end corruption | Cascade delete leaves orphaned progress (FK violation on next write); a study sync drops grades; `historico` corrupted; white-screen crash; 500 on a core route |
| **Sev-2 (High)**     | A feature is unusable or gives wrong results, but no data loss              | Statistics show wrong memory-stage buckets; import silently drops valid rows; a game records the wrong grade; streak counted on the wrong day                   |
| **Sev-3 (Medium)**   | A feature works but with a noticeable defect; workaround exists             | Text overflow that hides content; a missing loading indicator; a wrong i18n string; a slow (>500ms) list query                                                  |
| **Sev-4 (Low)**      | Cosmetic / polish; no functional impact                                     | A 1px misalignment; a non-binding color; a missing hover state                                                                                                  |

| Priority | When                                                   |
| -------- | ------------------------------------------------------ |
| **P0**   | Sev-1 — fix before any further work; block the release |
| **P1**   | Sev-2 — fix this cycle                                 |
| **P2**   | Sev-3 — fix when convenient                            |
| **P3**   | Sev-4 — backlog                                        |

**Escalation:** any Sev-1 is escalated immediately to the author with the full diagnostic bundle (§5.2) and a reproduction. A Sev-1 that is a _silent_ back-end failure (no UI symptom) is treated as more urgent than a visible crash, because it corrupts data without the user knowing.

### 5.2 Mandatory diagnostic bundle for every bug report

Attach **all** of the following to the issue:

1. **Screenshot(s)** — the failing checkpoint (and an annotated copy, §2.3).
2. **HAR / network payload** — the failing request: method, URL, request body, status code, and full response body (the error envelope).
3. **Log snippet with timestamps** — the server-console and/or Postgres lines at the action's timestamp, including any Prisma error code (P2002/P2003/P2025) or stack trace.
4. **Correlation key** — the `sessionId` (study sync) or resource id + timestamp (§3.3).
5. **Environment** — deployment URL, commit hash, image build time, locale, viewport, browser (Chromium build), and the DB state (which notebooks/rules exist).
6. **Reproduction steps** — exact, from a clean state.
7. **Expected vs. actual.**

---

## 6. Risk Assessment & Mitigation

### 6.1 Top 3 UI/UX risks

| #   | Risk                                                                                                                                 | Why it matters                                                               | Mitigation                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Text overflow / truncation in the knowledge tree and import preview** (long rule questions, long area names, mapped-column labels) | Clipped text hides content and breaks the "review and alignment" import flow | The tree uses `truncate` + `title` tooltips; the import preview rows and mapping labels must be verified at 1440 and 390 width (XC-05, IM-02/03). Add a regression E2E that asserts no horizontal scroll and that truncated text has a `title`. |
| 2   | **Missing or stuck loading / empty states** (dashboard, statistics, import)                                                          | A frozen or blank UI reads as a crash; NaN/undefined in stats is worse       | Every async surface must show an indeterminate indicator and a defined empty state (OV-03, NB-03, IM-01). E2E asserts the indicator appears then clears, and that empty states render without `NaN`/`undefined` text.                           |
| 3   | **i18n leakage / mixed language** (a missing key renders `Namespace.key`)                                                            | A leaked token is both a bug and a trust problem for a pt-BR product         | The i18n key-parity test (pt-BR ↔ en-US) runs in CI; E2E XC-01 asserts no `Namespace.key` pattern appears in the DOM under either locale.                                                                                                       |

### 6.2 Top 3 back-end / logging risks

| #   | Risk                                                                                          | Why it matters                                                                                                                                          | Mitigation                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Cascade delete leaving orphaned study progress** (the `ProgressoUsuario.regra` RESTRICT FK) | If the progress row isn't deleted in the same transaction, the delete either 500s or (worse) leaves a dangling reference that corrupts later SRS writes | KN-05 asserts the progress row is gone after a cascade delete; the repository cascade tests cover the transaction; a Postgres log watch for P2003 during a cascade delete catches a regression.        |
| 2   | **Study sync not idempotent / double-applying grades** (duplicate `historico` entries)        | Double-applying a session corrupts the SRS state and the statistics                                                                                     | The sync is idempotent per `sessionId`; ST-05 asserts exactly one sync and exactly N `historico` entries; a `SELECT count(*) FROM historico entries WHERE sessionId=…` check catches a replay.         |
| 3   | **Day-boundary (America/Sao_Paulo) misapplication in streaks and statistics**                 | A review counted on the wrong day silently skews the streak and the per-day statistics                                                                  | The SRS and stats use `America/Sao_Paulo` day keys (`yyyy-MM-dd`); NB-02 and the streak assertions verify a review at a UTC time that straddles the São Paulo midnight lands on the correct local day. |

---

## Appendix A — Error envelope & codes (reference)

Every API failure returns:

```json
{ "error": { "code": "<ErrorCode>", "message": "<human-readable>", "details": {} } }
```

`ErrorCode ∈ { VALIDATION_ERROR, NOT_FOUND, CONFLICT, INTERNAL_ERROR }`. Prisma helpers: `isPrismaNotFound` (P2025), `isPrismaForeignKey` (P2003), `isPrismaUniqueViolation` (P2002).

## Appendix B — SRS reference

Grades: `1 (Missed) · 3 (Hard) · 4 (Good) · 5 (Easy)`. EF floor 1.3, initial 2.5. Intervals: `q<3 → 1d (reps 0)`; `reps 0 → 1d`; `reps 1 → 6d`; `reps>1 → intervaloDias × EF`. Memory stages: long-term `intervaloDias > 21`; recent `>= 1`; not-learned otherwise. `historico` entry: `{date, grade, game?}`.

## Appendix C — Design tokens (reference)

`--bg-primary #0a192f` · `--bg-secondary #112240` · `--primary #64ffda` · `--accent #fbbf24` · `--text-primary #ccd6f6` · `--text-secondary #8892b0` · `--error #f87171`. Durations 150/250/300ms. Single dark theme (`.dark` ≡ `:root`). Global sapphire `:focus-visible` ring.
