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

The app ships with **user accounts and role-based access** (teacher, student, course creator, admin), so every content-generation feature sits behind secure login.



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
📱 React Frontend (What you see)
   ↓ (login / register, then sends chapter text, PDF, or images)
🔐 Auth Layer (JWT login, role-based access, SQL database)
   ↓ (verifies the user, then forwards the request)
⚙️ FastAPI Python Backend (does the work)
   ├─ Explain Module (generates explanations)
   ├─ Quiz Module (creates questions)
   ├─ Slides Module (builds PowerPoint decks)
   ├─ Flashcards Module (creates study cards)
   ├─ Audio Module (converts text to speech)
   ├─ Video Module (creates short clips)
   ├─ Illustration Module (finds or generates images)
   └─ Infographic Module (creates visual summaries)
   ↓ (sends back results)
📥 Results (download PowerPoint, listen to audio, etc.)
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
- **Sign up / log in**: Email + password accounts with secure password hashing (bcrypt)
- **JWT tokens**: Login returns a bearer token used to access every content feature
- **Role-based access**: Four roles — `teacher`, `student`, `course_creator`, and `admin`
  - Public registration is allowed for non-admin roles
  - Admin accounts are created via the bootstrap setting or the `init_db` script (never via public signup)
  - Admin-only endpoints (e.g. listing all users) are protected by role checks
- **Persistent storage**: Users are stored in a SQL database (SQLite by default, PostgreSQL for production)
- **Best For**: Securing the app and tailoring access for different kinds of users

**Key endpoints:**
- `POST /api/v1/auth/register` — create an account
- `POST /api/v1/auth/login` — get a bearer token (form: `username=email`, `password`)
- `GET /api/v1/auth/me` — current user profile (requires token)
- `GET /api/v1/auth/users` — list all users (admin only)

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

1. **Python 3.9 or higher** installed on your computer
2. **Git** (for cloning the repository)
3. **API Keys** (choose at least one):
   - **OpenAI**: Sign up at https://openai.com and create an API key (costs money per usage)
   - OR use **Ollama** (free, local LLM)
4. **Node.js** (for the web interface, optional)
5. **Optional APIs**:
   - Pexels API key for stock photos (free)
   - Stable Diffusion WebUI for local image generation

### Step 1: Clone the Repository

```bash
# Open terminal/command prompt and run:
git clone https://github.com/your-repo/classroom-ai.git
cd classroom-ai
```

### Step 2: Set Up Python Backend

```bash
# Create a virtual environment (isolates dependencies)
python -m venv .venv

# Activate it:
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install all Python libraries
pip install -r requirements.txt
```

### Step 3: Configure API Keys and Settings

```bash
# Create a .env file (configuration file)
cp .env.example .env

# Open .env in a text editor and add your settings:
# For OpenAI (cloud-based):
OPENAI_API_KEY=sk-your-actual-key-here
LLM_PROVIDER=openai
OPENAI_CHAT_MODEL=gpt-4o-mini

# OR for Ollama (local, free):
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.2

# Database (SQLite by default; PostgreSQL for production):
DATABASE_URL=sqlite:///./classroom_ai.db

# Authentication (JWT) — use a long random string in production:
SECRET_KEY=change-me-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Optional: auto-create the first admin on startup (only if no admin exists):
# BOOTSTRAP_ADMIN_EMAIL=admin@example.com
# BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
# BOOTSTRAP_ADMIN_NAME=Admin

# For stock photos (optional):
PEXELS_API_KEY=your-pexels-key-here

# For local image generation (optional):
SD_WEBUI_URL=http://127.0.0.1:7860
```

**Note**: Never share your `.env` file – it contains secrets!

### Step 4: Initialize the Database

The database tables are created automatically when the backend starts, but you can also set them up (and create an admin) ahead of time:

```bash
# Just create the tables
python scripts/init_db.py --init

# Create the tables AND an admin account
python scripts/init_db.py --admin-email admin@example.com --admin-password "your-secure-password" --admin-name "Admin"
```

By default this creates a local SQLite file (`classroom_ai.db`) in the project root. Set `DATABASE_URL` to a PostgreSQL URL for production.

### Step 5: Start the Backend Server

```bash
# Make sure virtual environment is activated, then:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
Uvicorn running on http://127.0.0.1:8000
```

✅ **Backend is now running!**

### Step 6: Set Up Frontend (Optional but Recommended)

```bash
# In a new terminal window:
cd frontend
npm install
npm run dev
```

You should see:
```
Vite server running at http://localhost:5173
```

✅ **Frontend is now running!**

### Step 7: Access the Application

- **Web Interface**: Open http://localhost:5173 in your browser
- **API Documentation**: Open http://localhost:8000/docs
- **Test Backend**: Open http://localhost:8000

---

## 📋 How to Use ClassroomAI

### Using the Web Interface (Easiest)

1. **Open** http://localhost:5173
2. **Register or log in** with your email and password
3. **Paste** your chapter text or upload a PDF/images
4. **Choose language** (English, Hindi, Roman Hindi)
5. **Click** "Generate Explanation"
6. **See results** – explanation, diagram, and suggestions
7. **Generate quiz, slides, audio, etc.** from the same content
8. **Download** PowerPoint, save audio, etc.

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

---

## 📁 Project Structure (What's Where)

```
classroom-ai/
│
├── app/                          # Python backend
│   ├── main.py                   # Main FastAPI app (+ admin bootstrap)
│   ├── core/
│   │   ├── config.py             # Configuration settings
│   │   ├── security.py           # Password hashing + JWT tokens
│   │   └── deps.py               # Auth dependencies (current user, roles)
│   ├── db/
│   │   ├── base.py               # SQLAlchemy declarative base
│   │   └── session.py            # DB engine, session, init_db
│   ├── models/
│   │   └── user.py               # User model + UserRole enum
│   ├── api/
│   │   └── v1/
│   │       ├── router.py         # All routes (auth public, rest protected)
│   │       └── endpoints/        # Individual endpoints
│   │           ├── auth.py       # Register / login / me / users
│   │           ├── explain.py    # Explanation endpoint
│   │           ├── quiz.py       # Quiz endpoint
│   │           ├── slides.py     # Slides endpoint
│   │           ├── flashcards.py # Flashcards endpoint
│   │           ├── audio.py      # Audio endpoint
│   │           ├── video.py      # Video endpoint
│   │           ├── illustration.py
│   │           └── infographic.py
│   ├── services/                 # Actual business logic
│   │   ├── explanation.py        # Generates explanations
│   │   ├── quiz.py               # Generates quizzes
│   │   ├── slides.py             # Creates PowerPoint
│   │   ├── flashcards.py         # Creates flashcards
│   │   ├── tts.py                # Text to speech
│   │   ├── video_*.py            # Video generation
│   │   ├── illustration_*.py     # Image generation
│   │   ├── pdf_extract.py        # Reads PDF files
│   │   └── llm/                  # LLM provider abstraction
│   │       ├── protocol.py       # LLM interface
│   │       ├── openai_provider.py
│   │       ├── ollama_provider.py
│   │       └── factory.py        # Creates right LLM provider
│   └── schemas/                  # Data structure definitions
│       ├── auth.py               # Auth request/response models
│       └── ...                   # Explain, quiz, slides, etc.
│
├── scripts/
│   └── init_db.py                # Create tables / bootstrap admin
│
├── frontend/                     # React web interface
│   ├── src/
│   │   ├── AppRoot.tsx           # Routes between auth and main app
│   │   ├── AuthContext.tsx       # Holds the logged-in user + token
│   │   ├── AuthPage.tsx          # Login / register screen
│   │   ├── auth.ts               # Auth API calls + token storage
│   │   ├── App.tsx               # Main app component
│   │   ├── api.ts                # Calls backend API (with token)
│   │   └── components/           # React components
│   ├── package.json              # Frontend dependencies
│   └── vite.config.ts            # Frontend build config
│
├── requirements.txt              # Python dependencies (what to install)
├── .env.example                  # Example configuration
├── .env                          # Your actual secrets (gitignored)
├── classroom_ai.db               # SQLite database (created at runtime)
└── Readme.md                     # This guide

Key Directories Explained:
- app/services/    = Where the real work happens
- app/api/v1/      = Web endpoints (what frontend calls)
- app/core/        = Configuration, security, and auth dependencies
- app/db/          = Database engine and session setup
- app/models/      = Database tables (e.g. users)
- scripts/         = Setup helpers (database init, admin creation)
```

---

## 🎓 Common Use Cases

### Use Case 1: Teacher Preparing for a Class

**Steps:**
1. Paste chapter from textbook into ClassroomAI
2. Generate explanation (1 minute)
3. Generate slides for presenting (2 minutes)
4. Generate quiz for students (1 minute)
5. **Result**: Ready to teach tomorrow!

### Use Case 2: Student Studying for Exam

**Steps:**
1. Take screenshots of textbook pages
2. Upload to ClassroomAI
3. Generate flashcards for memorization
4. Listen to audio narration while exercising
5. Take quiz to test knowledge
6. **Result**: Well-prepared for exam!

### Use Case 3: Course Creator Building Online Course

**Steps:**
1. Upload 50 chapter PDFs to ClassroomAI
2. Batch generate explanations for all
3. Generate quizzes, slides, and audio
4. Download all materials
5. **Result**: Complete course ready to publish!

---

## 🐛 Troubleshooting

### Problem: "Backend connection error"

**Solution:**
- Make sure backend is running: `uvicorn app.main:app --reload`
- Check it's on http://127.0.0.1:8000
- Try opening http://127.0.0.1:8000/docs in browser

### Problem: "API key error" or "Authentication failed"

**Solution:**
1. Check your `.env` file exists
2. Verify API key is correct (copy from website again)
3. If using OpenAI, make sure account has payment method
4. If using Ollama, make sure it's running: `ollama serve`

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
| **React** | Web framework for UI |
| **Vite** | Fast development server |
| **TypeScript** | Typed JavaScript (fewer bugs) |
| **Mermaid** | Diagram rendering |

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
- Integration with learning management systems (LMS)
- Analytics on quiz performance
- Student collaboration features
- Mobile app

---

## 💬 Quick Reference Commands

### Starting the Application

```bash
# Setup (first time only)
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate        # Mac/Linux
pip install -r requirements.txt
cp .env.example .env

# Edit .env with your API keys and SECRET_KEY

# Initialize the database (and optionally create an admin)
python scripts/init_db.py --init
# python scripts/init_db.py --admin-email admin@example.com --admin-password "your-password"

# Run backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, run frontend (optional)
cd frontend
npm install
npm run dev
```

### Stopping the Application

```bash
# Press Ctrl+C in both terminal windows
```

### Checking What's Running

```bash
# Check if backend is accessible
curl http://127.0.0.1:8000/docs

# Check if frontend is accessible
# Open http://localhost:5173 in browser
```

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
| **Role** | A user's permission level (teacher, student, course creator, admin) |
| **ORM / SQLAlchemy** | Tool that lets Python talk to a database without raw SQL |
| **FastAPI** | Framework for quickly building web services in Python |
| **React** | Framework for building interactive web pages |
| **Vite** | Fast tool for building and running React apps |
| **Python** | Programming language used for backend |
| **TypeScript** | Enhanced version of JavaScript with better error checking |
| **GitHub** | Website where code is stored and shared |
| **.env file** | File where you store secret settings (never share!) |
| **Virtual Environment** | Isolated Python setup on your computer |
| **Virtual Environment** | Isolated area on your computer for Python libraries |
| **PPT / PowerPoint** | Presentation software with slides |
| **MP3** | Audio file format (like music files) |
| **MP4** | Video file format |
| **PDF** | Document format (like printable pages) |
| **Mermaid Diagram** | Tool for drawing flowcharts and diagrams |

---

**Last Updated**: June 2026
**Version**: 1.1
**Status**: Complete & Ready to Use
