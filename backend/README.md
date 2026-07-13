# ClassroomAI — backend

The FastAPI application lives in the **`app/` package at the repository root** (next to `requirements.txt`). This file documents how it fits together; it is not a separate Python package named `backend`.

FastAPI exposes `/api/v1` JSON and multipart endpoints. The UI (Vite dev server) proxies `/api` to this app (see `frontend/vite.config.ts`).

## Run locally

From the **repository root** (not this folder):

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill OPENAI_API_KEY, SECRET_KEY, DATABASE_URL, etc.
python scripts/init_db.py --init   # optional; tables also created on startup
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

OpenAPI docs: `http://127.0.0.1:8000/docs`.

## Database models

| Model | File | Purpose |
|-------|------|---------|
| `User` | `app/models/user.py` | Accounts + `UserRole` (teacher, student, course_creator, admin) |
| `TeacherGroup`, `GroupMember`, `GroupAssignment` | `app/models/groups.py` | Class rosters and lesson assignments with `content_snapshot` JSON |
| `QuizAttempt` | `app/models/quiz_attempt.py` | Server-persisted quiz submissions and scores |

Default database: SQLite (`classroom_ai.db`). Set `DATABASE_URL` for PostgreSQL in production.

## API surface (beyond content generation)

| Router | Prefix | Notes |
|--------|--------|-------|
| `auth.py` | `/auth` | Register, login, profile, admin user list |
| `groups.py` | `/groups` | CRUD groups, members, assign project snapshots |
| `assignments.py` | `/assignments` | Student: list my assigned lessons (+ last quiz stats) |
| `quiz_attempts.py` | `/quiz-attempts` | Submit quiz, student history, teacher group scoreboard |
| `usage.py` | `/usage` | Usage summary for current user |
| `explain.py`, `quiz.py`, `slides.py`, … | feature routes | AI content generation (JWT required) |

All routes except register/login are protected with JWT bearer tokens (`app/core/deps.py`).

## High-level flow

1. **Config** (`app/core/config.py`) loads environment (API keys, `DATABASE_URL`, `SECRET_KEY`, CORS, Ollama URL, etc.).

2. **Router** (`app/api/v1/router.py`) mounts feature routers under prefix `/api/v1`.

3. **LLM abstraction** (`app/services/llm/`): `get_llm_provider()` returns OpenAI or Ollama. Vision requests use image+text messages for screenshots.

4. **Explain** is the core lesson generator:
   - Endpoints: `POST /explain/text`, `/explain/text-form`, `/explain/image`, `/explain/images` (`app/api/v1/endpoints/explain.py`).
   - Implementation: `app/services/explanation.py` asks the model for **strict JSON** (markdown explanation, examples, visual briefs, optional `mermaid_diagram`, video prompt, etc.).

5. **Downstream features** each have a thin endpoint + service module (quiz, slides, flashcards, infographic, illustration, audio, video).

6. **Groups & assignments**: Teachers POST a full project snapshot to `POST /groups/{id}/assignments`. Students resolve lessons via email membership (`app/services/student_assignments.py`, `group_memberships.py`).

7. **Quiz attempts**: `app/services/quiz_scoring.py` scores answers against the assignment snapshot; results stored in `quiz_attempts` for cross-device sync and teacher reporting.

## Request path (typical “full lesson” from the UI)

The React app calls **Explain** first, then (client-side) quiz, slides, flashcards, infographic, and audio in sequence. Each step is a separate HTTP request. Teacher project state lives in the browser until **Assign to Group** copies a snapshot to the database.

## Diagram / Mermaid notes

Invalid Mermaid from models used to surface as error SVGs in the browser. The frontend validates with `mermaid.parse()` and rejects SVGs that still contain Mermaid’s error text. The prompt in `explanation.py` instructs ASCII node IDs and quoted labels to reduce syntax errors.
