"""FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import auth, chat, foods, lookup, recipes


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="NutriTrack API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(foods.router, prefix="/api/foods", tags=["foods"])
    app.include_router(recipes.router, prefix="/api/recipes", tags=["recipes"])
    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    app.include_router(lookup.router, prefix="/api/lookup", tags=["lookup"])

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
