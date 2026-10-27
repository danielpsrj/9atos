# Technical Specification Document - 9Atos Project

**Date:** October 2026
**Status:** Version 1.0 (Draft for Execution)
**Target Audience:** Engineering Team, Software Architects, UI/UX Designers, and Stakeholders.

---

## 1. Executive Vision and Product Objective

The **9Atos** is a gamified web platform focused on optimizing the study, memorization, and practical application of normative texts, legislation, and complex knowledge structures. 

The architectural differentiator of the system lies in the decoupling of the **knowledge base** and the **testing interface** (the games). A single concept registered in the database can be dynamically instantiated as a Flashcard, a Multiple Choice question, a Matching game, or a Fill-in-the-Blanks task. This is orchestrated by a central **Spaced Repetition System (SRS)** engine inspired by the SM-2 algorithm, ensuring long-term learning efficiency.

## 2. System Architecture

The system was designed to be lean, easily maintainable, and containerized, allowing isolated execution on modest infrastructures in V1, with horizontal scalability planned for V2.

### 2.1. Technology Stack
*   **Frontend & Backend (Functional Monolith):** Next.js (App Router, React 18+). Chosen for the unification of API routes and server-side rendering (SSR/RSC) for higher performance.
*   **Language:** TypeScript (Strict Mode mandatory throughout the repository).
*   **Database:** PostgreSQL 16+.
*   **ORM:** Prisma (strong typing and ease of migrations).
*   **Styling:** Tailwind CSS + Headless Components (Radix UI / Shadcn UI).
*   **Infrastructure:** Docker and Docker Compose (Containerization of App and Database in separate containers).

### 2.2. Logical Component Diagram

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

---

## 3. Database Structure (Relational Schema)

The database was designed to support multi-user expansion (V2) and categorization flexibility.

### 3.1. Prisma Schema (Main Excerpt)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Usuario {
  id             String    @id @default(uuid())
  nome           String
  email          String?   @unique
  ofensivaAtual  Int       @default(0)
  maiorOfensiva  Int       @default(0)
  ultimoAcesso   DateTime  @default(now())
  cadernos       Caderno[]
  progressos     ProgressoUsuario[]
}

// --- KNOWLEDGE HIERARCHY ---

model Area {
  id          String       @id @default(uuid())
  nome        String
  disciplinas Disciplina[]
}

model Disciplina {
  id          String    @id @default(uuid())
  nome        String
  iconeUrl    String?   // Mapping for icon library
  corHex      String?   // Discipline's theme color
  areaId      String
  area        Area      @relation(fields: [areaId], references: [id])
  topicos     Topico[]
}

model Topico {
  id           String     @id @default(uuid())
  nome         String
  disciplinaId String
  disciplina   Disciplina @relation(fields: [disciplinaId], references: [id])
  regras       Regra[]
}

model Regra {
  id              String   @id @default(uuid())
  topicoId        String
  topico          Topico   @relation(fields: [topicoId], references: [id])
  
  // Base Content
  pergunta        String
  respostaCerta   String
  justificativa   String?
  dica            String?
  
  // Distractors (stored as JSON array for flexibility)
  distratores     Json     @default("[]") 
  
  // Metadata
  nivelDificuldade Int     @default(1) // 1 to 5
  probabilidade    Float?  // Chance of appearing in an exam (0.0 to 1.0)
  
  progressos      ProgressoUsuario[]
  cadernos        RegraNoCaderno[]
}

// --- STUDY STRUCTURE ---

model Caderno {
  id          String           @id @default(uuid())
  usuarioId   String
  usuario     Usuario          @relation(fields: [usuarioId], references: [id])
  nome        String
  descricao   String?
  regras      RegraNoCaderno[]
}

model RegraNoCaderno {
  cadernoId String
  regraId   String
  caderno   Caderno @relation(fields: [cadernoId], references: [id], onDelete: Cascade)
  regra     Regra   @relation(fields: [regraId], references: [id], onDelete: Cascade)
  
  @@id([cadernoId, regraId])
}

// --- PROGRESS ENGINE (SRS) ---

model ProgressoUsuario {
  id              String   @id @default(uuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  regraId         String
  regra           Regra    @relation(fields: [regraId], references: [id])
  
  // Modified SM-2 Algorithm
  reps            Int      @default(0)    // Number of consecutive correct repetitions
  easeFactor      Float    @default(2.5)  // Initial ease factor
  intervaloDias   Float    @default(0)    // Interval until next review
  proximaRevisao  DateTime @default(now()) // Calculated date for next review
  historico       Json     @default("[]") // Log of dates and grades (1 to 4)

  @@unique([usuarioId, regraId])
}
```

---

## 4. The Spaced Repetition Engine (SRS Algorithm)

The application utilizes a variant of the **SM-2 (SuperMemo-2)** algorithm, adapted for server-side calculations.

### 4.1. Mathematical Logic
When a user interacts with a piece of content, they assign a **Response Quality ($q$)** from 0 to 5. In 9Atos, we will adapt this to 4 simplified feedback buttons:
*   `Missed (q=1)`: The interval is reset.
*   `Hard (q=3)`: Recalled with significant effort.
*   `Good (q=4)`: Recalled after some hesitation (Default).
*   `Easy (q=5)`: Immediate recall.

**Formulas:**
If $q < 3$ (Error):
*   $reps = 0$
*   $interval = 1$ day

If $q \ge 3$ (Success):
*   If $reps = 0 \rightarrow interval = 1$
*   If $reps = 1 \rightarrow interval = 6$
*   If $reps > 1 \rightarrow interval = interval_{previous} \times easeFactor$
*   $reps = reps + 1$

**Ease Factor Update ($easeFactor$):**
$$EF_{new} = EF_{current} + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$$
*Restriction:* The $easeFactor$ can never be less than `1.3`.

---

## 5. Design System and User Interface (UI)

### 5.1. Visual Identity: "Sapphire & Gold Abyss"
Specifically designed to minimize Eye Strain during heavy reading sessions, utilizing contrasts tested for accessibility (WCAG AA).

| Element | Color Name | Hex Code | UI Usage |
| :--- | :--- | :--- | :--- |
| **Main Background** | Midnight Ocean | `#0A192F` | Main application background (Body/Canvas). |
| **Secondary Background**| Submarine Waters | `#112240` | Content cards, side panels, modals. |
| **Primary Color** | Sapphire | `#64FFDA` | Main buttons, links, highlight typography, progress icons. |
| **Accent Color** | Gold / Amber | `#FBBF24` | Challenge Mode timers, Alerts, Streaks, Badges. |
| **Main Text** | Light Slate | `#CCD6F6` | Body text, questions, justifications. |
| **Secondary Text** | Muted Slate | `#8892B0` | Hints, dates, menu labels. |

### 5.2. Mockup Specification (Structural Wireframes)

#### Screen 1: Dashboard (Workspace)
*   **Layout:** CSS Grid, Left Side-navigation.
*   **Header:** 
    *   Title: "Overview".
    *   Right Side: Gamification Widget (Gold fire icon `#FBBF24` + "12 Days" Counter). Goal Widget (Target icon + "20/30 Rules").
*   **Body (Main Content):**
    *   "Your Notebooks" section.
    *   Grid Display (Cards in `#112240` style).
    *   Each Card contains: 
        *   Top tag indicating the Area.
        *   Notebook Title (e.g., Constitutional - Fundamental Rights).
        *   SVG Progress Ring (Circular Progress Bar) rendered using the Primary Color (`#64FFDA`). The percentage is calculated based on the notebook's rules that have $interval > 21$ days.
        *   "Study" button aligned to the bottom of the card.

#### Screen 2: Game Interface (e.g., Matching Game)
*   **Header:** Thin linear progress bar at the top. "Exit" button on the left. "Zen Mode" indicator or descending Timer (Gold) on the right.
*   **Game Area:**
    *   Two dynamic columns. Left Column: Concepts (Rules). Right Column: Definitions (Answers).
    *   Upon clicking a concept and its correct definition, an electrical beam (Sapphire Color) temporarily connects the two before they disappear (CSS fade-out animation).
    *   Mistakes emit a slight dark red highlight and increment an internal counter for the SRS payload (sent with $q=1$ at the end).

---

## 6. API and Integration Flows (RESTful)

The Next.js backend will provide the following APIs for internal communication:

### `POST /api/study/session/start`
Starts a study session by fetching the most urgent rules (based on `proximaRevisao` in the `ProgressoUsuario` table).
**Request Body:**
```json
{
  "cadernoId": "notebook-uuid",
  "limit": 20,
  "gameType": "flashcards" // or "match", "cloze"
}
```
**Response (200 OK):**
Array of `Regra` objects formatted for the frontend.

### `POST /api/study/session/sync`
Synchronizes the outcome of a study session in batches to avoid overwhelming the database with unitary requests.
**Request Body:**
```json
{
  "usuarioId": "user-uuid-1",
  "resultados": [
    { "regraId": "rule-uuid-1", "qualidade": 4 }, // Correct, default
    { "regraId": "rule-uuid-2", "qualidade": 1 }  // Completely missed
  ]
}
```

---

## 7. Internationalization (i18n)

The application must be *Locale-Aware* from day 1. V1 will support `pt-BR` and `en-US`.
*   **Implementation:** Use of the `next-intl` library.
*   **Structure:** Separate JSON dictionaries.
*   The content stored in the database (`pergunta`, `resposta`) will **not** be translated by the UI engine. The interface language affects buttons, menus, error messages, and reports.

---

## 8. Infrastructure and Deployment (DevOps)

### 8.1. Dockerfile (Next.js Multi-stage Build)
The project must utilize a multi-stage Dockerfile to ensure a lightweight production image (Alpine Linux), optimizing the `node_modules` cache.

### 8.2. docker-compose.yml (Standalone Production)
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:secret@db:5432/9atos
    depends_on:
      - db
    restart: always

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=9atos
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: always

volumes:
  db_data:
```
*Recommendation for Production:* In real environments, the `db` database should be migrated to RDS services (AWS) or equivalents to ensure automated backups and high availability.

---

## 9. Evolutionary Roadmap (Upcoming Versions)

This specification defines the strict scope for V1. However, the architectural design anticipates the following software evolution:

### Version 2: Multi-user and Generative AI (Q2/2027)
*   **JWT/OAuth Authentication:** Integration with NextAuth (Google, Apple Login).
*   **Ingesting AI Pipeline:** Integration with LLM APIs (e.g., Gemini/OpenAI). The user will upload a PDF (e.g., Civil Service Exam Notice or Law Book). A Python/FastAPI service (secondary microservice) will process the PDF, extract key concepts, generate plausible distractors, and inject the JSONs directly into the user's hierarchical structure.
*   **Social & Marketplace:** Ability to publish "Notebooks" publicly, allowing students to share mind maps and flashcard decks (similar to AnkiWeb).

### Version 3: Mobile Native (Q4/2027)
*   Exposure of the REST/GraphQL API for a native mobile client built in React Native or Flutter, maintaining a fluid offline experience (local synchronization with SQLite and subsequent sync to PostgreSQL in the cloud).

---
*Final Document - Requirements Specification - End*