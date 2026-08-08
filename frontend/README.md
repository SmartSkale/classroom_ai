# ClassroomAI — frontend

Vite + React 19 + TypeScript SPA. The dev server proxies `/api` → `http://127.0.0.1:8000`, so the client calls the FastAPI app at `/api/v1/...` without CORS issues during development.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Ensure the backend is running on port 8000 (see the repo root README).

## Environment

Copy `.env.example` to `.env` and adjust if needed:

- `VITE_API_BASE_URL` — base path for API calls (default `/api/v1`).

## Folder structure

```
src/
├── assets/              # Images, icons, fonts
├── components/          # Reusable UI (Button, Modal, Loader, DownloadAllButton, RelativeTime, …)
├── pages/               # Screens (see routes below)
├── layouts/             # MainLayout, AuthLayout, DashboardLayout (sidebar nav)
├── services/            # API layer (api.ts, authService, projectService, groupService, …)
├── hooks/               # useAuth, useFetch, useRelativeTime
├── context/             # GenerationContext (teacher project jobs → /projects API)
├── store/               # Zustand auth slice (token + user)
├── routes/              # AppRoutes.tsx + ProtectedRoute guard
├── utils/               # constants, roles, projectStorage (types + legacy migration)
├── styles/              # variables.css, global.css, interactive.css
├── App.tsx              # BrowserRouter > providers > AppRoutes
├── main.tsx             # Entry point
└── index.css            # Global style imports
```

## Routes & roles

| Path | Page | Who sees it |
|------|------|-------------|
| `/` | Home | Everyone |
| `/login` | Login / register | Guests |
| `/dashboard` | Teacher dashboard **or** **My Lessons** (students) | Authenticated |
| `/library` | Project Library | Teachers / course creators / parents (students redirected) |
| `/groups` | Class groups & quiz scores | Teachers / course creators (not parents) |
| `/upload`, `/processing` | Create new lesson | Teachers / course creators / parents |
| `/projects/:id` | Explanation | Teachers + students (student-safe actions) |
| `/projects/:id/quiz/take` | Take quiz | Students |
| `/projects/:id/quiz/results` | Quiz results | Students |
| `/projects/:id/quiz`, `/slides`, `/flashcards`, `/audio`, `/video`, … | Content views | Role-aware (no regenerate/delete for students) |
| `/q/:id` | Shared lesson link | Students (login required) |
| `/profile` | Profile & password | Authenticated |

Role helpers live in `utils/roles.ts` (`canCreateContent`, `canManageGroups`, etc.).

## How it fits together

- **Auth**: `store/authSlice.ts` (Zustand) holds the JWT + user. `services/api.ts` attaches the token to every request. `context/AuthContext.tsx` restores the session on mount; use `useAuth()` in components.
- **Teacher projects**: `context/GenerationContext.tsx` tracks generation jobs and persists them to the **database** via `services/projectService.ts` (`GET/PUT/DELETE /projects`). Older browser `localStorage` jobs are migrated once if the library is empty.
- **Student lessons**: `services/groupService.ts` loads `GET /assignments` from the server. Assignment `content_snapshot` is the source of truth on any device.
- **Quiz results**: `services/quizService.ts` submits to `POST /quiz-attempts/submit` and loads latest scores from the API (browser cache is optional only).
- **Routing**: `routes/AppRoutes.tsx` wraps authenticated routes in `ProtectedRoute` and mounts teacher/student pages under `DashboardLayout`.

## Key services

| Service | Purpose |
|---------|---------|
| `authService.ts` | Register, login, profile, change password |
| `groupService.ts` | Groups, members, assignments, student lesson list |
| `quizService.ts` | Submit quiz attempts, fetch results / history |
| `generationService.ts` | Explain, quiz, slides, flashcards, audio, video API calls |
| `projectService.ts` | Project Library CRUD (`/projects`), recent projects, usage summary |

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve with any static host and forward `/api` to your backend (or set `VITE_API_BASE_URL` to your API domain) in production.
