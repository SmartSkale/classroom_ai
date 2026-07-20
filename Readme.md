# ClassroomAI - Complete Guide

## 🎯 What is ClassroomAI?

ClassroomAI is an **AI-powered educational content generator** that turns textbook chapters, PDFs, or screenshots into complete, ready-to-use lesson packages. Imagine uploading a single page from a textbook and getting back:

- ✅ **Clear explanations** of the topic
- ✅ **Quiz questions** based on the content
- ✅ **Presentation slides** (PowerPoint) you can teach from
- ✅ **Flashcards** for students to review
- ✅ **Audio narration** of the lessons
- ✅ **Illustrations or stock images** to visualize concepts
- ✅ **Infographics** for complex ideas
- ✅ **Short educational videos** (using various methods)
- ✅ **Mermaid diagrams** for processes and sequences

All from a **single source** – the chapter text, PDF, or images you provide.

The app ships with **user accounts and role-based access** (teacher, student, course creator, parent, admin), a **server-persisted Project Library**, **class groups** for distributing lessons, and **server-persisted quiz results** — so teachers and students can work across devices.

### Who it's for

| Role | What they do in the app |
|------|-------------------------|
| **Teacher / course creator** | Upload chapters, generate materials, manage a **Project Library**, create **class groups**, assign lessons to groups, view **quiz scores** |
| **Parent** | Same as teachers for upload, generation, and **Project Library** — **no** class groups or assign-to-group |
| **Student** | Log in (or open a shared link), see **My Lessons**, read explanations, take quizzes, review results, study flashcards/audio/video |
| **Admin** | User management (`GET /auth/users`) |

---

## 🔧 How It's Made (Technical Overview)

### The Brain: AI Models

ClassroomAI uses **two types of AI**:

1. **Text Generation** (creates explanations, quizzes, etc.)
   - Cloud Option: **OpenAI GPT-4** (powerful but costs money)
   - Local Option: **Ollama** (free, runs on your computer)

2. **Image Generation** (creates illustrations and infographics)
   - Cloud Option: **OpenAI DALL-E** (through your OpenAI account)
   - Local Option: **Stable Diffusion WebUI** (free, runs locally)
   - Stock Option: **Pexels API** (free stock photos)

### The System: Python Backend + React Frontend

```
📱 React Frontend (Vite + React 19 + TypeScript)
   ↓ login / register (JWT)
🔐 Auth + SQL database (users, projects, groups, assignments, quiz attempts)
   ↓
⚙️ FastAPI Python Backend
   ├─ Auth (register, login, profile, password)
   ├─ Projects (teacher Project Library — full generation jobs)
   ├─ Groups (teacher class groups + student emails)
   ├─ Assignments (lesson snapshots assigned to groups)
   ├─ Quiz attempts (server-side scoring + teacher reports)
   ├─ Explain, Quiz, Slides, Flashcards, Audio, Video, Illustration, Infographic
   ↓
💾 Storage
   └─ Database: users, projects, teacher_groups, group_members,
                group_assignments, quiz_attempts
```

### The Flow: What Happens Inside

1. **User uploads** chapter text, PDF, or screenshots
2. **Backend extracts** text (handles PDFs with tables, OCR for scanned images)
3. **LLM processes** the text and creates an explanation
4. **Other modules reuse** this explanation to create:
   - Quiz questions
   - Slide outlines
   - Flashcard content
   - Video scripts
5. **Results are generated** and made available for download

---

## 📊 Core Features Explained

### 0. **Accounts & Access Control (Authentication Module)**
- **Register / log in**: Email + password accounts with secure password hashing (bcrypt)
- **JWT tokens**: Login returns a bearer token used to access every content feature
- **Role-based access**: Five roles — `teacher`, `student`, `course_creator`, `parent`, and `admin`
  - Public registration is allowed for non-admin roles
  - Parents share Project Library / upload access with teachers, but cannot create groups or assign lessons
  - Admin accounts are created via the bootstrap setting or the `init_db` script (never via public registration)
  - Admin-only endpoints (e.g. listing all users) are protected by role checks
- **Persistent storage**: Users are stored in a SQL database (SQLite by default, PostgreSQL for production)
- **Best For**: Securing the app and tailoring access for different kinds of users

**Key endpoints:**
- `POST /api/v1/auth/register` — create an account
- `POST /api/v1/auth/login` — get a bearer token (form: `username=email`, `password`)
- `GET /api/v1/auth/me` — current user profile (requires token)
- `PATCH /api/v1/auth/me` — update name / email
- `POST /api/v1/auth/change-password` — change password
- `GET /api/v1/auth/users` — list all users (admin only)
- `GET /api/v1/usage/current` — usage summary for the logged-in user

> ⚠️ **Content generation endpoints require a valid bearer token.** Project, group, assignment, and quiz-attempt APIs also require authentication.

### 0a. **Project Library (Server-persisted teacher projects)**

Generated lessons are stored in the database (not only in the browser), so teachers can open the **Project Library** on any device.

- **Auto-save** — while generation runs, the frontend upserts the full job snapshot to the server (debounced)
- **Library & dashboard** — list, open, regenerate, download ZIP, and delete projects from the API
- **Assign to Group** — still copies a `content_snapshot` onto the assignment so students load the lesson independently
- **Migration** — if a teacher still has older `localStorage` jobs and the DB library is empty, those jobs are uploaded once and then cleared from the browser

**Teacher UI:** `/library`, **Recent Projects** on `/dashboard`, generation progress on `/processing`.

**Key endpoints (teacher / course creator / parent / admin):**
- `GET /api/v1/projects` — list project metadata (newest first)
- `GET /api/v1/projects/jobs` — full job snapshots (hydrates `GenerationContext`)
- `GET /api/v1/projects/{id}` — one project + job
- `PUT /api/v1/projects/{id}` — create or update a project from a job snapshot
- `DELETE /api/v1/projects/{id}` — delete a project

### 0b. **Class Groups & Assignments (Teacher → Student distribution)**

Teachers can organize students and push lessons without relying on copy-paste links alone.

- **Create groups** — e.g. “Biology Period 2”
- **Add student emails** — comma or newline separated; students are linked when they register/login with that email
- **Assign content** — from **Project Library**, pick a group; the full lesson snapshot is stored on the server
- **Students** see assigned lessons on **My Lessons** (`/dashboard`) and can open explanation, quiz, flashcards, audio, video

**Teacher UI:** `/groups`, **Assign to Group** on library cards, **Quiz Scores** per assignment on the group page.

**Key endpoints (teacher / course creator / admin — not parents):**
- `GET/POST /api/v1/groups` — list / create groups
- `GET/PATCH/DELETE /api/v1/groups/{id}` — manage a group
- `POST /api/v1/groups/{id}/members` — add student emails
- `DELETE /api/v1/groups/{id}/members/{member_id}` — remove a student
- `POST /api/v1/groups/{id}/assignments` — assign a project snapshot to the group
- `GET /api/v1/groups/{id}/assignments` — list assignments for a group
- `GET /api/v1/quiz-attempts/groups/{group_id}/projects/{project_id}` — class quiz scoreboard

**Key endpoints (student):**
- `GET /api/v1/assignments` — my assigned lessons (includes `last_quiz_percent` when taken)

**Shared link (optional):** `/q/{projectId}` — student logs in, lesson is added to My Lessons (works best when teacher also used **Share** or **Assign to Group** so content exists on the server).

### 0c. **Quiz Attempts (Server-persisted results)**

Quiz scores are stored in the database (not only in the browser), so students can switch devices and teachers can view class results.

- **Submit:** server scores answers against the assignment `content_snapshot` (trusted source)
- **Retries:** each attempt is saved; latest attempt is shown by default
- **Pass threshold:** 60% correct (configurable in frontend constants)

**Key endpoints:**
- `POST /api/v1/quiz-attempts/submit` — submit answers; returns scored result
- `GET /api/v1/quiz-attempts/{project_id}` — latest result for current student
- `GET /api/v1/quiz-attempts/{project_id}/history` — all attempts for current student

> ⚠️ **All content endpoints (explain, quiz, slides, flashcards, audio, video, illustration, infographic) require a valid bearer token.** Register/log in first, then send the token as `Authorization: Bearer <token>`.

### 1. **Learn (Explanation Module)**
- **Input**: Chapter text, PDF, or images of textbook pages
- **Output**: Structured explanation in your chosen language
- **Bonus**: Auto-generates Mermaid diagrams for processes
- **Best For**: Understanding new topics

**Example:**
- Input: "Chapter on Photosynthesis"
- Output: Clear explanation + diagram showing how light becomes energy

### 2. **Quiz Module**
- **Input**: Chapter text + generated explanation
- **Output**: Multiple-choice questions with correct answers and explanations
- **Customizable**: Difficulty level, number of questions
- **Best For**: Checking student understanding

**Example:**
- Question: "Which part of the plant captures sunlight?"
- Options: A) Roots, B) Leaves, C) Stem, D) Flower
- Answer: B (with explanation)

### 3. **Slides Module**
- **Input**: Lesson explanation
- **Output**: Ready-to-present PowerPoint deck with:
  - Hero title slide
  - Content slides with dark theme
  - Professional gradients or stock photos
  - Speaker notes with credits
- **Best For**: Teaching a class or presenting

**Customization Options:**
- Use generated gradients (free, no API needed)
- Use stock photos (if you have Pexels API key)
- Adjust number and content of slides

### 4. **Flashcards Module**
- **Input**: Lesson content
- **Output**: Question-answer pairs for quick review
- **Best For**: Self-study and memorization

**Example:**
- Front: "What is photosynthesis?"
- Back: "Process where plants convert light to chemical energy"

### 5. **Audio Module**
- **Input**: Text content
- **Output**: MP3 file of spoken narration
- **Voices Available**:
  - OpenAI TTS (if using OpenAI)
  - Edge TTS (free, high quality)
- **Best For**: Audio learners and commuters

### 6. **Illustration Module**
- **Input**: Visual brief from the lesson
- **Output**: Image (one of three methods)
  - AI-generated (OpenAI or Stable Diffusion)
  - Stock photo (Pexels)
- **Best For**: Making concepts visual

### 7. **Infographic Module**
- **Input**: Topic and key points
- **Output**: Single infographic-style image
- **Best For**: Summarizing complex topics visually

### 8. **Video Module** (Three Options)

**A. Local Animation** (Free, server-generated)
- Creates lightweight MP4 animations
- No external API calls
- Best for quick lesson summaries

**B. OpenAI Sora** (Premium, high quality)
- Uses OpenAI's video generation API
- Creates cinematic educational clips
- Requires account with video API access

**C. Pexels Stock Video** (Free)
- Searches Pexels stock video library
- Downloads real footage by keywords
- No generation needed, just retrieval

**D. Lesson Overview** (Notebook LM style)
- AI writes narration script from lesson text
- Converts to speech
- Stitches together MP4 with visuals
- Creates a full multi-segment educational video

---

## 🚀 Getting Started (Step-by-Step)

### Prerequisites (What You Need)

**Before installing**, you need:

1. **Python 3.9+** (3.11+ recommended)
2. **Node.js 18+** and npm (for the React UI)
3. **Git** (to clone the repository)
4. **At least one LLM option**:
   - **OpenAI** API key ([platform.openai.com](https://platform.openai.com/api-keys)) — cloud, paid
   - **or Ollama** ([ollama.ai](https://ollama.ai)) — free, runs on your machine
5. **Optional**:
   - [Pexels API](https://www.pexels.com/api/) key for stock photos in slides
   - Stable Diffusion WebUI for local image generation
   - SMTP credentials (e.g. Gmail App Password) for group/assignment email notifications

> **Auth today:** email + password with JWT (not Google Sign-In).  
> **LLMs today:** `openai` or `ollama` only (Gemini is not wired up yet).

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-repo/classroom-ai.git
cd classroom_ai
```

### Step 2: Set Up the Python Backend

From the **repository root** (where `requirements.txt` and `app/` live):

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
# (or: uv sync  — if you use the uv.lock / pyproject.toml setup)
```

### Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`. Minimum useful settings:

```env
# --- LLM (pick one) ---
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-actual-key-here
OPENAI_CHAT_MODEL=gpt-4o-mini

# OR local Ollama:
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_CHAT_MODEL=llama3.2

# Allow the Vite dev server to call the API
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173

# --- Database ---
DATABASE_URL=sqlite:///./classroom_ai.db

# --- JWT auth ---
SECRET_KEY=change-me-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Optional first admin (only created if no admin exists yet):
# BOOTSTRAP_ADMIN_EMAIL=admin@example.com
# BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
# BOOTSTRAP_ADMIN_NAME=Admin

# Optional image / stock APIs:
# PEXELS_API_KEY=
# IMAGE_GENERATION_MODEL=gpt-image-2
# IMAGE_GENERATION_QUALITY=medium
# SD_WEBUI_URL=http://127.0.0.1:7860

# Optional SMTP (group / assignment emails) — see Configuration Guide below
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=you@gmail.com
# SMTP_PASSWORD=your-16-char-app-password
# SMTP_USE_TLS=true
# EMAIL_FROM=Classroom AI <you@gmail.com>
# FRONTEND_URL=http://localhost:5173
```

**Notes:**
- Never commit `.env` — it holds secrets.
- After changing `.env`, **fully restart** uvicorn. `--reload` does not pick up env changes (settings are cached).

Generate a strong `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Step 4: Initialize the Database (Optional)

Tables are also created automatically when the backend starts. To init early (and create an admin):

```bash
python scripts/init_db.py --init

python scripts/init_db.py \
  --admin-email admin@example.com \
  --admin-password "your-secure-password" \
  --admin-name "Admin"
```

Default DB file: `classroom_ai.db` in the project root. Use a PostgreSQL `DATABASE_URL` for production.

### Step 5: Start the Backend

```bash
# venv still activated, from repo root:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see something like:

```
Uvicorn running on http://127.0.0.1:8000
```

- API docs: http://127.0.0.1:8000/docs  
- Health/root: http://127.0.0.1:8000  

### Step 6: Set Up and Start the Frontend

In a **second** terminal:

```bash
cd frontend
cp .env.example .env   # optional; default is fine for local dev
npm install
npm run dev
```

`frontend/.env` typically only needs:

```env
# Vite proxies /api → http://127.0.0.1:8000 in development
VITE_API_BASE_URL=/api/v1
```

You should see Vite at **http://localhost:5173**.

### Step 7: Verify Local Setup

| Check | URL / action |
|-------|----------------|
| Frontend | Open http://localhost:5173 |
| API docs | Open http://127.0.0.1:8000/docs |
| Register | Create a teacher/student account in the UI |
| Generate | Upload a short chapter and run a generation |

Keep **both** terminals running (backend on `:8000`, frontend on `:5173`).

---

## 📋 How to Use ClassroomAI

### Teacher workflow (web UI)

1. **Register / log in** as **Teacher** or **Course creator**
2. **Upload** a chapter (`/upload`) — paste text or drop a PDF; select outputs (explanation, quiz, slides, etc.)
3. **Processing** — watch generation progress; project auto-saves to the server **Project Library**
4. **Project Library** (`/library`) — open outputs on any device, download ZIP, regenerate, **Assign to Group**, delete
5. **Class Groups** (`/groups`) — create a group, add student emails, view assignments and **Quiz Scores**
6. **Explanation** (`/projects/:id`) — review lesson, **Edit** source, download materials, jump to quiz/slides/etc.

### Parent workflow (web UI)

Parents have the same content-creation access as teachers, but **cannot** create class groups or assign lessons to groups.

1. **Register / log in** as **Parent**
2. **Upload** a chapter (`/upload`) — paste text or drop a PDF; select outputs
3. **Processing** — watch generation progress; project auto-saves to the **Project Library**
4. **Project Library** (`/library`) — open outputs, download ZIP, regenerate, delete (no **Assign to Group**)
5. **Share** — use **Share with Students** on a quiz or explanation page so your child can open the lesson
6. **Explanation** (`/projects/:id`) — review lesson, download materials, jump to quiz/slides/etc.

> Parents do not see **Groups** in the sidebar and are blocked from group/assignment APIs (403).

### Student workflow (web UI)

1. **Register / log in** as **Student**, or open a teacher **shared link** (`/q/:id`)
2. **My Lessons** (`/dashboard`) — assigned content from your groups (live “Assigned …” timestamps)
3. **Read explanation** → **Take quiz** → **Quiz results** (wrong answers with explanations)
4. **Flashcards**, **Audio**, **Video** — study modes without teacher-only controls (no upload/library/regenerate)

### Using the Web Interface (quick start)

1. **Open** http://localhost:5173
2. **Register or log in** with your email, password, and role
3. **Teachers / parents:** go to **Upload** and create a project
4. **Students:** open **My Lessons** after your teacher assigns content or shares a link
5. **Download** slides, audio, or full ZIP from the library or explanation page

### Using the API (For Developers)

All content endpoints are protected. First register and log in to obtain a bearer token, then include it on every request.

**Register an account:**

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "supersecret",
    "full_name": "Jane Teacher",
    "role": "teacher"
  }'
```

**Log in to get a token:**

```bash
# Login uses form-encoded data; username is your email
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -d "username=teacher@example.com" \
  -d "password=supersecret"
# → {"access_token": "eyJhbGci...", "token_type": "bearer"}
```

**Generate an Explanation (with token):**

```bash
curl -X POST "http://localhost:8000/api/v1/explain/text" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chapter_text": "Photosynthesis is the process...",
    "language": "English",
    "topic_hint": "Biology"
  }'
```

**Generate a Quiz:**

```bash
curl -X POST "http://localhost:8000/api/v1/quiz/generate" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chapter_text": "Photosynthesis is the process...",
    "difficulty": "medium",
    "num_questions": 5
  }'
```

**Generate Slides:**

```bash
curl -X POST "http://localhost:8000/api/v1/slides/generate" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Photosynthesis",
    "content": "Explanation text here...",
    "slide_count": 8
  }'
```

See the full API documentation at http://localhost:8000/docs when the server is running.

---

## 🛠️ Configuration Guide

### Choose Your AI Provider

**Option 1: Use OpenAI (Cloud, Easiest)**

Pros:
- High quality, latest models
- No installation needed

Cons:
- Costs money (typically $0.001-0.01 per request)
- Requires internet connection

**Setup:**
1. Go to https://openai.com
2. Create account and add payment method
3. Get API key from API keys page
4. Add to `.env`: `OPENAI_API_KEY=sk-your-key`

**Option 2: Use Ollama (Local, Free)**

Pros:
- Completely free
- Works offline
- Privacy (no data sent to cloud)

Cons:
- Slower (depends on your computer)
- Requires 8GB+ RAM

**Setup:**
1. Download Ollama from https://ollama.ai
2. Run: `ollama pull llama3.2` (downloads AI model)
3. Run: `ollama serve` (starts the server)
4. Add to `.env`:
   ```
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   ```

### Add Stock Photos (Optional)

To use real stock photos instead of gradients in slides:

1. Go to https://www.pexels.com/api/
2. Create account
3. Get API key
4. Add to `.env`: `PEXELS_API_KEY=your-key`

### Add Local Image Generation (Optional)

To generate images locally without API costs:

1. Install Stable Diffusion WebUI: https://github.com/AUTOMATIC1111/stable-diffusion-webui
2. Run it (follow their instructions)
3. Add to `.env`: `SD_WEBUI_URL=http://127.0.0.1:7860`

### Configure Authentication & Database

1. **Set a secret key** (used to sign JWT tokens):
   - Add to `.env`: `SECRET_KEY=<long-random-string>`
   - Generate one with: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
2. **Choose token lifetime**: `ACCESS_TOKEN_EXPIRE_MINUTES=10080` (7 days by default)
3. **Pick a database**:
   - SQLite (default): `DATABASE_URL=sqlite:///./classroom_ai.db`
   - PostgreSQL: `DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/classroom_ai`
4. **Create the first admin** (either option):
   - Bootstrap on startup: set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env`
   - Or run: `python scripts/init_db.py --admin-email admin@example.com --admin-password "your-password"`

Login is **email + password** (JWT). There is no Google Sign-In / OAuth client ID in the app yet — a Google Cloud OAuth client will not affect the login page until that feature is added.

### Configure SMTP Email Notifications (Optional)

When configured, the backend emails students when they are **added to a group** or **assigned a lesson**. Group/assignment APIs still succeed if SMTP is unset (emails are skipped).

1. Choose an SMTP provider (Gmail, Outlook, Mailgun SMTP, etc.).
2. Add to root `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=true
EMAIL_FROM=Classroom AI <you@gmail.com>
FRONTEND_URL=http://localhost:5173
```

3. **Gmail:** enable [2-Step Verification](https://myaccount.google.com/security), then create an [App Password](https://myaccount.google.com/apppasswords). Put that 16-character password in `SMTP_PASSWORD` (not your normal Gmail password). Using a regular password often fails with `Application-specific password required`.
4. Restart uvicorn after editing `.env`.

Leave `SMTP_HOST` empty to disable sending.

### Gemini / Google Sign-In (Not Supported Yet)

| Feature | Status |
|---------|--------|
| **Gemini API** as `LLM_PROVIDER` | Not implemented — use `openai` or `ollama` |
| **Google OAuth / Sign-In** (`GOOGLE_CLIENT_ID`, etc.) | Not implemented — register/login with email + password |

If you need either, they must be added in code first (LLM factory + auth endpoints/UI); documenting env vars alone will not enable them.

---

## 📁 Project Structure (What's Where)

```
classroom_ai/
│
├── app/                          # Python backend (FastAPI)
│   ├── main.py                   # App entry + CORS + admin bootstrap
│   ├── core/
│   │   ├── config.py             # Settings from .env
│   │   ├── security.py           # Password hashing + JWT tokens
│   │   └── deps.py               # Auth dependencies (current user, roles)
│   ├── db/
│   │   ├── base.py               # SQLAlchemy declarative base
│   │   └── session.py            # DB engine, session, init_db
│   ├── models/
│   │   ├── user.py               # User model + UserRole enum
│   │   ├── project.py            # Project (teacher library + job_data JSON)
│   │   ├── groups.py             # TeacherGroup, GroupMember, GroupAssignment
│   │   └── quiz_attempt.py       # QuizAttempt (server-side quiz results)
│   ├── api/
│   │   └── v1/
│   │       ├── router.py         # All routes (auth public, rest protected)
│   │       └── endpoints/        # Thin HTTP handlers
│   │           ├── auth.py       # Register / login / me / profile / users
│   │           ├── projects.py   # Teacher Project Library CRUD
│   │           ├── groups.py     # Class groups + members + assignments
│   │           ├── assignments.py  # Student: my assigned lessons
│   │           ├── quiz_attempts.py # Submit quiz + teacher scoreboard
│   │           ├── usage.py      # Usage summary
│   │           ├── explain.py    # Explanation
│   │           ├── quiz.py       # Quiz generation
│   │           ├── slides.py     # Slides
│   │           ├── flashcards.py # Flashcards
│   │           ├── audio.py      # Audio narration
│   │           ├── video.py      # Video lessons
│   │           ├── illustration.py
│   │           └── infographic.py
│   ├── services/                 # Business logic
│   │   ├── explanation.py        # Generates explanations
│   │   ├── quiz.py               # Generates quizzes
│   │   ├── quiz_scoring.py       # Server-side quiz scoring
│   │   ├── student_assignments.py # Resolve student ↔ group assignments
│   │   ├── group_memberships.py  # Link invites to user accounts
│   │   ├── email.py              # SMTP notifications (group / assignment)
│   │   ├── slides.py             # Creates PowerPoint
│   │   ├── flashcards.py         # Creates flashcards
│   │   ├── tts.py                # Text-to-speech
│   │   ├── infographic.py        # Infographic generation
│   │   ├── pdf_extract.py        # PDF / image text extraction
│   │   ├── pexels_stock.py       # Pexels stock photo helpers
│   │   ├── video_openai.py       # OpenAI / Sora video
│   │   ├── video_opensource.py   # Local / ffmpeg video pipeline
│   │   ├── video_pexels.py       # Stock-footage video
│   │   ├── video_lesson_overview.py
│   │   ├── illustration_openai.py
│   │   ├── illustration_opensource.py
│   │   └── llm/                  # LLM provider abstraction
│   │       ├── factory.py        # get_llm_provider (OpenAI vs Ollama)
│   │       ├── openai_provider.py
│   │       ├── ollama_provider.py
│   │       ├── protocol.py
│   │       └── types.py
│   └── schemas/                  # Pydantic request/response models
│       ├── auth.py, projects.py, groups.py, quiz_attempts.py
│       ├── explain.py, quiz.py, slides.py, flashcards.py
│       ├── audio.py, video.py, illustration.py, infographic.py
│       ├── language.py, usage.py
│
├── scripts/
│   └── init_db.py                # Create tables / bootstrap admin
│
├── backend/
│   └── README.md                 # Backend docs (app/ lives at repo root)
│
├── frontend/                     # React 19 + Vite + TypeScript SPA
│   ├── public/                   # favicon, icons, robots.txt
│   ├── src/
│   │   ├── pages/                # Home, Login, Dashboard, StudentDashboard,
│   │   │                         # Library, Groups, Upload, Processing,
│   │   │                         # Explanation, Quiz, QuizTake, QuizResults,
│   │   │                         # Slides, Flashcards, Audio, Video,
│   │   │                         # Infographic, SharedLesson, Profile, ComingSoon
│   │   ├── layouts/              # MainLayout, AuthLayout, DashboardLayout
│   │   ├── components/           # Navbar, Button, Modal, Loader,
│   │   │                         # DownloadAllButton, AssignToGroupModal,
│   │   │                         # MermaidDiagram, RelativeTime, …
│   │   ├── context/              # AuthContext + GenerationContext
│   │   ├── hooks/                # useAuth, useFetch, useRelativeTime
│   │   ├── services/             # api.ts, authService, projectService,
│   │   │                         # groupService, quizService, generationService, …
│   │   ├── store/                # Zustand auth slice (authSlice.ts)
│   │   ├── routes/               # AppRoutes.tsx (+ ProtectedRoute guard)
│   │   ├── styles/               # variables.css, global.css, interactive.css
│   │   ├── utils/                # projectStorage (types + legacy migration),
│   │   │                         # roles, downloadProjectBundle, flashcardPdf, …
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── .env.example
│   ├── README.md
│   └── vite.config.ts            # Dev proxy /api → backend :8000
│
├── requirements.txt              # Python dependencies
├── pyproject.toml                # uv / project metadata
├── uv.lock                       # Locked Python deps (uv)
├── .env.example
├── .python-version
├── classroom_ai.db               # SQLite (users, projects, groups, assignments, quiz_attempts)
├── ARCHITECTURE.md               # System architecture overview
├── FLOW_DOCUMENTATION.html       # Visual flow documentation
└── Readme.md
```

Key directories:
- `app/api/v1/endpoints/` — HTTP routes (auth, projects, groups, assignments, quiz-attempts, generation)
- `app/models/` — SQLAlchemy tables (users, projects, groups, quiz attempts)
- `app/schemas/` — Pydantic contracts for every API endpoint
- `app/services/` — Generation, scoring, PDF extraction, and LLM provider logic
- `frontend/src/pages/` — Role-aware UI (teacher library/groups vs student dashboard)
- `frontend/src/context/` — `AuthContext` (session) + `GenerationContext` (teacher jobs → `/projects` API)
- `frontend/src/services/` — API clients (`projectService`, `groupService`, `quizService`, `generationService`, …)

### Data storage (what lives where)

| Data | Storage | Notes |
|------|---------|--------|
| Users, groups, members, assignments, quiz attempts | **SQLite / PostgreSQL** | Created on backend startup (`init_db`) |
| Teacher project jobs (generated content) | **Database** (`projects` table) | Full job JSON in `job_data`; owned by teacher; syncs across devices |
| Assignment `content_snapshot` | **Database JSON** | Students load lesson on any device |
| Quiz results (production path) | **Database** | `quiz_attempts` table; browser cache is optional only |
| Legacy browser project keys | **Migrated once** | Old `classroomai.jobs` / `classroomai.projects` uploaded if the DB library is empty, then cleared |

---

## 🎓 Common Use Cases

### Use Case 1: Teacher Preparing for a Class

**Steps:**
1. Upload a chapter and select outputs (explanation, quiz, slides, …)
2. Review materials in **Project Library**
3. Create a **class group** and add student emails
4. **Assign to Group** so students see the lesson on **My Lessons**
5. After class, open **Quiz Scores** on the group page

### Use Case 2: Student Studying for Exam

**Steps:**
1. Log in as student (or open teacher’s `/q/...` link)
2. Open assigned lesson from **My Lessons**
3. Read explanation → take quiz → review wrong answers
4. Use flashcards and audio on the same lesson
5. **Result:** Progress saved on the server (quiz score syncs across devices)

### Use Case 3: Course Creator Building Online Course

**Steps:**
1. Generate explanations, quizzes, and slides per chapter
2. Organize students into groups (e.g. by cohort)
3. Assign each chapter to the right group
4. Download ZIP bundles from the library for offline archives
5. **Result:** Structured course with tracked quiz performance

---

## 🐛 Troubleshooting

### Problem: "Backend connection error"

**Solution:**
- Make sure backend is running: `uvicorn app.main:app --reload`
- Check it's on http://127.0.0.1:8000
- Try opening http://127.0.0.1:8000/docs in browser

### Problem: "API key error" or "Authentication failed"

**Solution:**
1. Check your `.env` file exists at the **repo root** (not only under `frontend/`)
2. Verify API key is correct (copy from website again)
3. If using OpenAI, make sure account has payment method
4. If using Ollama, make sure it's running: `ollama serve`
5. Restart uvicorn after any `.env` change

### Problem: SMTP / Gmail “Application-specific password required”

**Solution:**
- Use a Google [App Password](https://myaccount.google.com/apppasswords), not your normal Gmail password
- Confirm `SMTP_HOST`, `SMTP_USERNAME`, and `SMTP_PASSWORD` are set, then restart the API

### Problem: "401 Unauthorized" / "Could not validate credentials"

**Solution:**
- Content endpoints require login — register and log in first
- Pass the token on requests: `Authorization: Bearer <token>`
- Tokens expire (default 7 days); log in again to get a fresh one
- Make sure `SECRET_KEY` in `.env` hasn't changed since the token was issued (changing it invalidates existing tokens)

### Problem: "Admin account cannot be created via public registration"

**Solution:**
- This is expected — admins can't be made through `POST /auth/register`
- Use the bootstrap settings in `.env`, or run `python scripts/init_db.py --admin-email ... --admin-password ...`

### Problem: "Module not found" error

**Solution:**
```bash
# Make sure virtual environment is activated
# Windows: .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt
```

### Problem: "PDF upload not working"

**Solution:**
- Check file is actually a PDF (not image of PDF)
- Try a smaller PDF first
- Check that `pdfplumber` is installed: `pip list | grep pdfplumber`

### Problem: "Images not generating"

**Solution:**
- If using OpenAI: check you have DALL-E API access
- If using local: start Stable Diffusion WebUI first
- If using stock: check Pexels API key is valid

### Problem: "Slow responses" or "Takes too long"

**Solution:**
- If using Ollama locally: your computer might be slow
  - Try smaller model: `ollama pull llama2` (smaller, faster)
  - Close other programs to free RAM
- If using OpenAI: check internet connection

---

## 📊 Technology Stack

### Backend Technologies

| Component | Purpose | What It Does |
|-----------|---------|-------------|
| **FastAPI** | Web framework | Handles requests, serves API |
| **Python 3.9+** | Language | All backend code |
| **Pydantic** | Data validation | Makes sure data is correct format |
| **SQLAlchemy** | ORM / database | Stores users (SQLite or PostgreSQL) |
| **python-jose** | JWT tokens | Signs and verifies login tokens |
| **bcrypt** | Password hashing | Securely stores passwords |
| **OpenAI SDK** | Cloud AI | Calls OpenAI API |
| **Ollama** | Local AI | Runs AI models locally |
| **python-pptx** | PowerPoint | Creates slide decks |
| **pdfplumber** | PDF reading | Extracts text from PDFs |
| **imageio** | Image processing | Handles video/image creation |
| **edge-tts** | Text to speech | Free voice narration |

### Frontend Technologies

| Component | Purpose |
|-----------|---------|
| **React** | UI framework (React 19) |
| **Vite** | Dev server + production build |
| **TypeScript** | Typed JavaScript |
| **React Router** | Pages, protected routes, shared links (`/q/:id`) |
| **Zustand** | Auth state |
| **Axios** | API client with JWT interceptor |
| **Mermaid** | Diagram rendering in explanations |
| **JSZip** | Download-all materials bundle |

---

## 🔐 Security & Privacy

### What You Should Know

1. **API Keys**: 
   - Keep `.env` file private (added to `.gitignore` automatically)
   - Never commit `.env` to Git
   - Rotate keys if accidentally exposed

2. **Data**:
   - Using OpenAI: Your content is sent to their servers
   - Using Ollama: Everything stays on your computer
   - Consider privacy before uploading sensitive content

3. **Best Practices**:
   - Run on private network for sensitive data
   - Use Ollama for confidential materials
   - Audit generated content before using in classes

---

## 📈 Performance Tips

### For Faster Results

1. **Use OpenAI instead of Ollama**
   - Cloud models are faster (trade: costs money)
   - Ollama on local PC is slower but free

2. **Use smaller models**
   - `gpt-4o-mini` is faster than `gpt-4`
   - `llama2` is faster than `llama3.2`

3. **Generate in batch**
   - Create multiple quizzes at once
   - Let slides and flashcards generate while you work on audio

### For Lower Costs

1. **Use Ollama** (free, local)
2. **Use free stock photos** instead of AI image generation
3. **Generate once**, reuse content multiple times
4. **Use smaller API models** if quality permits

---

## 🤝 Contributing & Support

### Need Help?

1. **Check error message carefully** – often tells you exactly what's wrong
2. **Read troubleshooting section** above
3. **Check API docs** at http://localhost:8000/docs
4. **Open an issue** on GitHub with:
   - What you tried
   - Error message
   - Your configuration (without API keys!)

### Want to Contribute?

1. Fork repository
2. Create feature branch: `git checkout -b my-feature`
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## 📝 License & Terms

- **License**: [Check LICENSE file in repo]
- **Attribution**: If using generated content in production, consider crediting ClassroomAI
- **API Terms**: Follow terms of service for OpenAI, Pexels, etc.

---

## 🎉 What's Next?

### Ideas for Using ClassroomAI

1. **Flip Your Classroom**: Generate materials for students to study before class
2. **Create Content Library**: Build repository of lessons in multiple formats
3. **Support Multiple Learners**: Provide slides for visual learners, audio for auditory, flashcards for kinesthetic
4. **Accessibility**: Audio and captions help students with disabilities
5. **Multiple Languages**: Generate materials in student's native language

### Future Features (Roadmap)

- Batch processing for multiple chapters
- Custom branding for slides
- LMS integrations (Canvas, Moodle, Google Classroom)
- Google Sign-In (OAuth) and Gemini LLM provider
- Alembic migrations for production database upgrades
- Mobile app

**Recently added:** server-persisted Project Library (`projects` API), class groups, server-side quiz attempts, student/teacher journeys, profile & usage UI, assign-to-group, SMTP email notifications for group invites and assignments.

---

## 💬 Quick Reference Commands

### Starting the Application

```bash
# Setup (first time only) — from repo root
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate        # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
# Edit .env: OPENAI_API_KEY (or Ollama), SECRET_KEY, optional SMTP_*

python scripts/init_db.py --init
# python scripts/init_db.py --admin-email admin@example.com --admin-password "your-password"

# Terminal 1 — backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd frontend
cp .env.example .env            # optional
npm install
npm run dev
```

Then open http://localhost:5173 (UI) and http://127.0.0.1:8000/docs (API).

### Stopping the Application

```bash
# Press Ctrl+C in both terminal windows
```

### Checking What's Running

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs
# Open http://localhost:5173 in a browser
```

### After Editing `.env`

Stop and restart uvicorn (settings are cached; file watch alone is not enough).

---

## 📞 Contact & Resources

- **Documentation**: Open `FLOW_DOCUMENTATION.html` for detailed flow diagrams
- **API Docs**: http://localhost:8000/docs (when running)
- **Swagger UI**: http://localhost:8000 (when running)

---

**ClassroomAI – One Chapter In, A Whole Lesson Out! 🚀**

*Making education content creation fast, easy, and accessible to everyone.*

---

## Appendix: Glossary of Terms

| Term | Simple Explanation |
|------|-------------------|
| **API** | Way for programs to talk to each other |
| **Backend** | The computer program doing the work (invisible to user) |
| **Frontend** | The web page you see and click (user interface) |
| **API Key** | Secret password that proves you're allowed to use a service |
| **LLM** | Large Language Model – AI that understands and generates text |
| **JWT** | JSON Web Token – a signed token that proves you're logged in |
| **Bearer Token** | The login token you send with each request to access protected features |
| **Role** | A user's permission level (teacher, student, course creator, parent, admin) |
| **ORM / SQLAlchemy** | Tool that lets Python talk to a database without raw SQL |
| **FastAPI** | Framework for quickly building web services in Python |
| **React** | Framework for building interactive web pages |
| **Vite** | Fast tool for building and running React apps |
| **Python** | Programming language used for backend |
| **TypeScript** | Enhanced version of JavaScript with better error checking |
| **GitHub** | Website where code is stored and shared |
| **.env file** | File where you store secret settings (never share!) |
| **Virtual Environment** | Isolated area on your computer for Python libraries |
| **Class group** | Teacher-defined roster of student emails for assigning lessons |
| **Quiz attempt** | A submitted quiz stored in the database with score and review items |
| **PPT / PowerPoint** | Presentation software with slides |
| **MP3** | Audio file format (like music files) |
| **MP4** | Video file format |
| **PDF** | Document format (like printable pages) |
| **Mermaid Diagram** | Tool for drawing flowcharts and diagrams |

---

**Last Updated**: July 2026  
**Version**: 1.3  
**Status**: Teacher & student journeys, server Project Library, class groups, server quiz results
