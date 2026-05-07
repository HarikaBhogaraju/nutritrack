# NutriTrack

A multi-user web app for tracking food, calories, and nutrition, with a built-in
Claude-powered chat that estimates the nutritional value of any food given a
recipe or restaurant menu description.

## Features

- Email/password signup + login (JWT auth)
- Log food entries (name, servings, calories, protein, carbs, fat)
- Daily + weekly nutrition dashboard (totals + 7-day trend)
- Saved recipes / favorites you can re-log with one click
- Chat with Claude to get structured nutrition estimates from a recipe or menu
  description; results can be logged or saved as a recipe directly
- Barcode lookup via the free OpenFoodFacts API
- Photo recognition via Claude's vision API

## Architecture

```
nutritrack/
├── backend/        FastAPI + SQLAlchemy + SQLite (Postgres-ready)
│   ├── app/
│   │   ├── main.py            App entrypoint, CORS, router wiring
│   │   ├── config.py          Env-var-driven settings
│   │   ├── database.py        SQLAlchemy engine + session
│   │   ├── models.py          ORM models
│   │   ├── schemas.py         Pydantic request/response schemas
│   │   ├── auth.py            Password hashing + JWT + current-user dep
│   │   ├── claude_service.py  Claude SDK wrapper (chat + vision)
│   │   ├── barcode_service.py OpenFoodFacts lookup
│   │   └── routers/           auth, foods, recipes, chat, lookup
│   ├── requirements.txt
│   └── .env.example
└── frontend/       React + Vite + React Router
    ├── src/
    │   ├── api.js             Fetch wrapper + auth header
    │   ├── auth.jsx           Auth context + provider
    │   ├── App.jsx            Routes
    │   ├── pages/             Login, Signup, Dashboard, LogFood,
    │   │                       Chat, Recipes, Lookup
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Prerequisites

You need these installed on your machine before doing anything else:

- **Python 3.10 or newer** — check with `python3 --version`
- **Node.js 18 or newer** — check with `node --version`
- **npm** (ships with Node) — check with `npm --version`
- An **Anthropic API key** for the Claude features. Get one at
  https://console.anthropic.com/. (The app boots without it — only the chat
  and photo features will return 503 errors until you set it.)

If `python3` isn't found on macOS, install it with `brew install python@3.12`
or download from https://www.python.org/downloads/.

If `node` isn't found, install with `brew install node` or via
https://nodejs.org/.

---

## Running locally

You'll need **two terminals** open at the same time: one for the backend
(port 8000), one for the frontend (port 5173).

### Backend setup (do this once)

Open a terminal and run, line by line:

```bash
cd ~/Documents/Claude/Projects/NutriTrack/backend

# 1. Create a virtual environment (a sandbox for this project's Python deps).
python3 -m venv .venv

# 2. Activate it. Your prompt will gain a "(.venv)" prefix.
#    On macOS / Linux:
source .venv/bin/activate
#    On Windows (PowerShell):
#    .venv\Scripts\Activate.ps1

# 3. Install Python dependencies INTO the venv.
pip install -r requirements.txt

# 4. Create your local .env from the example template.
cp .env.example .env

# 5. Open .env in any editor and set ANTHROPIC_API_KEY.
#    Easiest from the terminal:
open -e .env          # macOS — opens in TextEdit
# or:  nano .env      # works anywhere
```

In `.env`, paste your key on the `ANTHROPIC_API_KEY=` line and save:

```
ANTHROPIC_API_KEY=sk-ant-api03-...your-key...
```

### Backend day-to-day (every time you start the server)

```bash
cd ~/Documents/Claude/Projects/NutriTrack/backend
source .venv/bin/activate
uvicorn app.main:app --reload --reload-dir app --port 8000
```

The `--reload-dir app` flag scopes the auto-reloader to your app code only.
Without it, uvicorn watches the entire `backend/` directory and will spuriously
restart whenever pip writes into `.venv/`, the SQLite file changes, etc.

You should see something like:

```
INFO:     Will watch for changes in these directories: ['.../backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

The API is now at **http://localhost:8000** and the auto-generated OpenAPI
docs are at **http://localhost:8000/docs** (great for poking endpoints).

The first run also creates a `nutritrack.db` SQLite file in the `backend/`
directory — that's your local database.

### Frontend setup (do this once)

In a **second** terminal:

```bash
cd ~/Documents/Claude/Projects/NutriTrack/frontend

# Install JavaScript dependencies into ./node_modules
npm install
```

This creates a `node_modules/` folder (~150 MB, gitignored). It'll take a
minute the first time.

### Frontend day-to-day

```bash
cd ~/Documents/Claude/Projects/NutriTrack/frontend
npm run dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser. Sign up, then start logging
food and chatting with Claude.

The Vite dev server proxies `/api/*` requests to the backend on port 8000, so
both servers must be running at the same time.

---

## Troubleshooting

### `zsh: command not found: uvicorn` (or pytest, alembic, etc.)

You haven't activated the virtual environment, or you're in a new terminal
that doesn't have it activated. Quick check:

```bash
which python3
# Activated venv:    /Users/.../NutriTrack/backend/.venv/bin/python3
# NOT activated:     /opt/homebrew/bin/python3  (or similar system path)
```

Fix by running `source .venv/bin/activate` from inside `backend/`.

If you don't want to remember activating the venv, you can always invoke
binaries directly:

```bash
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### `ModuleNotFoundError: No module named 'fastapi'` (or anthropic, sqlalchemy, etc.)

The venv is active but the deps weren't installed into it. Run:

```bash
pip install -r requirements.txt
```

(With venv activated. If `pip` itself errors, use `python3 -m pip install -r requirements.txt`.)

### `RuntimeError: ANTHROPIC_API_KEY is not set` when using chat or photo

You either forgot to create `.env`, forgot to put your key in it, or the key
line still has the placeholder. Confirm with:

```bash
grep ANTHROPIC_API_KEY backend/.env
```

The line should look like `ANTHROPIC_API_KEY=sk-ant-...`, not just
`ANTHROPIC_API_KEY=` with nothing after.

### `address already in use` on port 8000 or 5173

Something else is running on that port. Either kill it:

```bash
lsof -ti:8000 | xargs kill          # frees port 8000
lsof -ti:5173 | xargs kill          # frees port 5173
```

…or pick a different port:

```bash
uvicorn app.main:app --reload --port 8001
```

(If you change the backend port, also change the proxy `target` in
`frontend/vite.config.js`.)

### CORS errors in the browser console

The frontend is calling the backend cross-origin and Vite's proxy isn't
working. Make sure:
1. Backend is actually running on port 8000.
2. You opened the app at `http://localhost:5173` (not by double-clicking
   `index.html`).

### `bcrypt` install errors on Apple Silicon

Rare, but if `pip install -r requirements.txt` fails on bcrypt, install it
explicitly first:

```bash
pip install --upgrade pip
pip install bcrypt --no-binary bcrypt
pip install -r requirements.txt
```

### Database is in a weird state and I want to start over

```bash
rm backend/nutritrack.db
```

The next backend startup will recreate empty tables.

### Frontend changes don't show up

Vite hot-reloads automatically — refresh the browser. If that doesn't help,
stop `npm run dev` (Ctrl-C) and start it again.

### Backend keeps reloading even when I'm not editing code

Uvicorn's `--reload` watches *every* file under the working directory. If
something else writes there (e.g. `pip install` modifying `.venv/`, SQLite
flushing the db, an editor saving a swap file) it triggers a reload. Use
`--reload-dir app` to scope the watcher to just your source code:

```bash
uvicorn app.main:app --reload --reload-dir app --port 8000
```

---

## Going to production

- **Database**: switch `DATABASE_URL` in `.env` from SQLite to Postgres
  (`postgresql+psycopg://user:pass@host/db`); the SQLAlchemy code is
  driver-agnostic. Use Alembic for migrations once your schema changes.
- **Secrets**: rotate `JWT_SECRET` to a long random value. Generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Never ship
  the example one.
- **Hosting**: backend runs anywhere that can serve a Python app
  (Fly.io, Render, Railway, AWS). Frontend is a static build (`npm run build`)
  hostable on Vercel / Netlify / Cloudflare Pages. Point the frontend's
  `VITE_API_BASE` env var at your backend URL.
- **Rate-limit + auth-protect** the `/api/chat/*` endpoints — every call costs
  Anthropic API tokens.

## Where to extend it next

- Add Alembic migrations.
- Add a meal-grouping concept (breakfast / lunch / dinner / snack views).
- Cache OpenFoodFacts responses in your DB so common items log instantly.
- Replace SQLite with Postgres + pgvector to do semantic search over your past
  meals ("what did I usually eat for lunch when I hit my protein goal?").
- Wrap the Claude chat in a tool-use loop so it can call a `log_food` tool
  directly instead of just returning JSON the frontend logs.
