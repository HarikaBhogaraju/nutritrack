# NutriTrack

A multi-user web app for tracking food, calories, and nutrition, with a built-in
Claude-powered chat that estimates the nutritional value of any food given a
recipe or restaurant menu description.

## Features in this scaffold

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
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── LogFood.jsx
    │   │   ├── Chat.jsx
    │   │   ├── Recipes.jsx
    │   │   └── Lookup.jsx     Barcode + photo
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## Running locally

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
uvicorn app.main:app --reload --port 8000
```

API is now at http://localhost:8000 and OpenAPI docs at
http://localhost:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App is at http://localhost:5173 and proxies `/api` to the backend.

## Going to production

- **Database**: switch `DATABASE_URL` in `.env` from SQLite to Postgres
  (`postgresql+psycopg://user:pass@host/db`); the SQLAlchemy code is
  driver-agnostic. Use Alembic for migrations once your schema changes.
- **Secrets**: rotate `JWT_SECRET` to a long random value. Never ship the
  example one.
- **Hosting**: backend runs anywhere that can serve a Python app
  (Fly.io, Render, Railway, AWS). Frontend is a static build (`npm run build`)
  hostable on Vercel/Netlify/Cloudflare Pages. Point the frontend's
  `VITE_API_BASE` env var at your backend URL.
- **Rate-limit + auth-protect** the `/api/chat/*` endpoints — every call costs
  Anthropic API tokens.

## Where to extend it next

- Add Alembic migrations.
- Add a meal concept (group entries: breakfast/lunch/dinner/snack).
- Cache OpenFoodFacts responses in your DB so common items log instantly.
- Replace SQLite with Postgres + pgvector to do semantic search over your past
  meals ("what did I usually eat for lunch when I hit my protein goal?").
- Wrap the Claude chat in a tool-use loop so it can call a `log_food` tool
  directly instead of just returning JSON the frontend logs.
