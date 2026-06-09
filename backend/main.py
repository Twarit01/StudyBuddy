from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import engine, Base
import models  # triggers all model imports so tables get created


# ── Database startup ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup — creates all database tables if they don't exist.
    """
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")
    yield
    print("👋 Shutting down StudyBuddy API")


# ── App instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="StudyBuddy API",
    description="AI-powered study assistant for engineering students",
    version="1.0.0",
    lifespan=lifespan
)


# ── CORS ──────────────────────────────────────────────────────────────────────
# Allows the React frontend (localhost:5173) to call the FastAPI backend

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.chat import router as chat_router
from routes.quiz import router as quiz_router
from routes.flashcards import router as flashcards_router

app.include_router(auth_router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(documents_router,  prefix="/api/documents",  tags=["Documents"])
app.include_router(chat_router,       prefix="/api/chat",       tags=["Chat"])
app.include_router(quiz_router,       prefix="/api/quiz",       tags=["Quiz"])
app.include_router(flashcards_router, prefix="/api/flashcards", tags=["Flashcards"])


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status": "running",
        "message": "StudyBuddy API is live"
    }