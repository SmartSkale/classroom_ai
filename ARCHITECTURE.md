# ClassroomAI — Architecture Overview

A brief, end-to-end architecture of the ClassroomAI project: an AI-powered
educational content generator that turns chapter text, PDFs, or screenshots into
explanations, quizzes, slides, flashcards, audio, video, illustrations, and
infographics — all behind JWT-secured, role-based accounts.

---

## 1. High-Level System

```mermaid
flowchart TB
    subgraph Client["🖥️ Frontend — React + Vite + TS"]
        UI["AppRoot / App.tsx<br/>(tabs: Learn, Quiz, Slides,<br/>Flashcards, Audio, Video, etc.)"]
        AUTHCTX["AuthContext + auth.ts<br/>(token in localStorage)"]
        APIC["api.ts<br/>(fetch + Bearer token)"]
    end

    subgraph Server["⚙️ Backend — FastAPI (app/)"]
        MW["CORS middleware<br/>+ /api/v1 router"]
        AUTHEP["Auth endpoints<br/>(public)"]
        GUARD["get_current_user<br/>(JWT dependency)"]
        PROT["Protected endpoints<br/>explain · quiz · slides ·<br/>flashcards · audio · video ·<br/>illustration · infographic"]
        SVC["Services layer<br/>(business logic)"]
    end

    subgraph Data["🗄️ Persistence"]
        DB["SQLAlchemy ORM<br/>SQLite (dev) / PostgreSQL (prod)<br/>users table"]
    end

    subgraph External["☁️ External / Local Providers"]
        OPENAI["OpenAI<br/>(GPT, DALL·E/Image, TTS, Sora)"]
        OLLAMA["Ollama<br/>(local LLM + vision)"]
        SD["Stable Diffusion WebUI<br/>(local images)"]
        PEXELS["Pexels API<br/>(stock photos/video)"]
        EDGE["Edge TTS<br/>(free narration)"]
    end

    UI --> AUTHCTX --> APIC
    APIC -->|HTTPS + Bearer JWT| MW
    MW --> AUTHEP
    MW --> GUARD --> PROT
    AUTHEP --> DB
    GUARD --> DB
    PROT --> SVC
    SVC --> OPENAI
    SVC --> OLLAMA
    SVC --> SD
    SVC --> PEXELS
    SVC --> EDGE
```

---

## 2. Backend Layered Architecture

The backend follows a clean, layered structure under `app/`:

```mermaid
flowchart LR
    subgraph API["API Layer — app/api/v1"]
        R["router.py"]
        E["endpoints/*.py<br/>(thin HTTP handlers)"]
    end

    subgraph Core["Core — app/core"]
        CFG["config.py<br/>(Settings / .env)"]
        SEC["security.py<br/>(bcrypt + JWT)"]
        DEP["deps.py<br/>(current user, roles)"]
    end

    subgraph Schemas["Schemas — app/schemas"]
        SCH["Pydantic models<br/>(request/response contracts)"]
    end

    subgraph Services["Services — app/services"]
        EXP["explanation.py"]
        QZ["quiz.py"]
        SL["slides.py"]
        FC["flashcards.py"]
        TTS["tts.py"]
        VID["video_*.py"]
        ILL["illustration_*.py"]
        PDF["pdf_extract.py"]
        LLM["llm/ (factory + providers)"]
    end

    subgraph DB["Data — app/db + app/models"]
        BASE["base.py (Declarative Base)"]
        SESS["session.py (engine, SessionLocal, init_db)"]
        USR["models/user.py (User, UserRole)"]
    end

    R --> E
    E --> SCH
    E --> DEP
    E --> Services
    DEP --> SEC
    DEP --> SESS
    Services --> CFG
    Services --> LLM
    SESS --> BASE
    USR --> BASE
```

**Responsibilities**

| Layer | Path | Role |
|-------|------|------|
| API | `app/api/v1/` | HTTP routing; auth routes public, everything else guarded by `get_current_user` |
| Schemas | `app/schemas/` | Pydantic request/response validation and contracts |
| Core | `app/core/` | Settings (`config.py`), password hashing + JWT (`security.py`), DI dependencies (`deps.py`) |
| Services | `app/services/` | All business logic and provider integrations |
| Data | `app/db/`, `app/models/` | SQLAlchemy engine/session, declarative base, `User` model |
| Entry | `app/main.py` | FastAPI app, CORS, startup `init_db()` + admin bootstrap |

---

## 3. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as Frontend (auth.ts)
    participant API as FastAPI (/auth)
    participant SEC as security.py
    participant DB as Database

    U->>FE: Register / Login (email, password)
    FE->>API: POST /api/v1/auth/register or /login
    API->>SEC: hash_password / verify_password (bcrypt)
    API->>DB: create / lookup User (role-checked)
    API->>SEC: create JWT (HS256, SECRET_KEY)
    API-->>FE: { access_token, token_type }
    FE->>FE: store token (localStorage)

    Note over U,DB: Every subsequent content request

    U->>FE: Use a feature (e.g. Generate Quiz)
    FE->>API: POST /api/v1/quiz/generate<br/>Authorization: Bearer <token>
    API->>SEC: decode + validate JWT
    API->>DB: load current user
    alt valid token (and role if required)
        API-->>FE: 200 + generated content
    else invalid / expired
        API-->>FE: 401 Unauthorized
    end
```

- **Roles:** `teacher`, `student`, `course_creator`, `admin` (`UserRole` enum).
- Public registration allowed for non-admin roles; admins created via
  `BOOTSTRAP_ADMIN_*` settings on startup or `scripts/init_db.py`.
- Admin-only endpoints (e.g. list users) enforce a role check on top of auth.

---

## 4. Content Generation Pipeline (Learn flow example)

```mermaid
flowchart TD
    IN["Input: chapter text / PDF / images"] --> EP["explain endpoint<br/>(text-form | images | pdf)"]
    EP --> EXTRACT{"PDF or image?"}
    EXTRACT -->|PDF| PDFX["pdf_extract.py<br/>(text + tables)"]
    EXTRACT -->|Images| VISION["vision-capable LLM"]
    EXTRACT -->|Text| TEXT["raw text"]
    PDFX --> SVC["explanation.py"]
    VISION --> SVC
    TEXT --> SVC
    SVC --> FACT["llm/factory.py<br/>get_llm_provider()"]
    FACT -->|stack=openai| OAI["OpenAIProvider"]
    FACT -->|stack=opensource| OLL["OllamaProvider"]
    OAI --> JSON["LLM returns JSON lesson"]
    OLL --> JSON
    JSON --> PARSE["parse + sanitize<br/>(Mermaid, visual briefs)"]
    PARSE --> IMG["optionally generate<br/>visual-brief images"]
    IMG --> OUT["ExplainResponse<br/>(markdown, examples,<br/>mermaid, visual briefs)"]
    OUT --> REUSE["Reused as context for<br/>Quiz · Slides · Flashcards ·<br/>Audio · Video · Infographic"]
```

The generated explanation/context text is reused across the other modules, so a
single source produces a full lesson package.

---

## 5. Provider Abstraction (pluggable AI backends)

Every feature picks a provider at runtime via a `stack` parameter
(`openai` vs `opensource`) and the `llm/factory.py` factory:

```mermaid
flowchart LR
    CALL["Service call<br/>(stack: openai | opensource)"] --> FACT["get_llm_provider()"]
    FACT --> PROTO["LLMProvider protocol<br/>(complete_chat, ...)"]
    PROTO --> O["OpenAIProvider"]
    PROTO --> L["OllamaProvider<br/>(text + vision)"]

    subgraph Images
      IO["illustration_openai.py"]
      IS["illustration_opensource.py (SD WebUI)"]
      PX["pexels_stock.py"]
    end

    subgraph Audio
      TO["OpenAI TTS"]
      TE["Edge TTS"]
    end

    subgraph Video
      VO["video_openai.py (Sora)"]
      VS["video_opensource.py (local MP4)"]
      VP["video_pexels.py (stock)"]
      VL["video_lesson_overview.py<br/>(narrated explainer)"]
    end
```

This keeps each capability swappable between **cloud (OpenAI)**, **local/free
(Ollama, Stable Diffusion, Edge TTS, local animation)**, and **stock (Pexels)**.

---

## 6. API Surface (v1)

| Group | Endpoint(s) | Auth |
|-------|-------------|------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/users` (admin) | public / token |
| Explain | `POST /explain/text`, `/explain/text-form`, `/explain/image`, `/explain/images`, `/explain/pdf` | Bearer |
| Quiz | `POST /quiz/generate` | Bearer |
| Slides | `POST /slides/generate`, `GET /slides/{id}/file` (.pptx) | Bearer |
| Flashcards | `POST /flashcards/generate` | Bearer |
| Audio | `POST /audio/speech`, `GET /audio/{id}/file` (.mp3) | Bearer |
| Video | `POST /video/jobs`, `GET /video/jobs/{id}`, `GET /video/jobs/{id}/file` | Bearer |
| Illustration | `POST /illustration` | Bearer |
| Infographic | `POST /infographic/generate` | Bearer |
| System | `GET /` (root), `GET /health` | public |

All routes are mounted under the `/api/v1` prefix. The frontend (Vite dev server)
proxies `/api` to the backend.

---

## 7. Technology Stack

**Backend:** FastAPI · Pydantic (+ pydantic-settings) · SQLAlchemy ·
python-jose (JWT) · bcrypt · python-pptx · pdfplumber · imageio · edge-tts ·
OpenAI SDK · Ollama.

**Frontend:** React · Vite · TypeScript · Mermaid (diagram rendering) · Axios/fetch.

**Persistence:** SQLite by default (`classroom_ai.db`), PostgreSQL for production
via `DATABASE_URL`.

**Config:** `.env` (real secrets, gitignored) layered over `.env.example`,
loaded by `app/core/config.py`.

---

## 8. Request Lifecycle (summary)

1. User authenticates → receives a JWT, stored client-side.
2. Frontend `api.ts` attaches `Authorization: Bearer <token>` to every call.
3. FastAPI router routes the request; protected routes run `get_current_user`.
4. The endpoint validates input via a Pydantic schema and calls a service.
5. The service selects a provider through `llm/factory.py` and does the work
   (LLM call, image/audio/video generation, PPTX build, etc.).
6. Results return as JSON, or as downloadable files (PPTX/MP3/MP4) via a
   second `GET .../file` request for job-style outputs.
