from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import engine, Base
import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")
    yield
    print("👋 Shutting down StudyBuddy API")


app = FastAPI(
    title="StudyBuddy API",
    description="AI-powered study assistant for engineering students",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes.auth       import router as auth_router
from routes.documents  import router as documents_router
from routes.chat       import router as chat_router
from routes.quiz       import router as quiz_router
from routes.flashcards import router as flashcards_router
from routes.progress   import router as progress_router
from routes.subjects   import router as subjects_router
from routes.reader     import router as reader_router

app.include_router(auth_router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(subjects_router,   prefix="/api/subjects",   tags=["Subjects"])
app.include_router(documents_router,  prefix="/api/documents",  tags=["Documents"])
app.include_router(reader_router,     prefix="/api/reader",     tags=["Reader"])
app.include_router(chat_router,       prefix="/api/chat",       tags=["Chat"])
app.include_router(quiz_router,       prefix="/api/quiz",       tags=["Quiz"])
app.include_router(flashcards_router, prefix="/api/flashcards", tags=["Flashcards"])
app.include_router(progress_router,   prefix="/api/progress",   tags=["Progress"])


@app.get("/api/health")
def health_check():
    return {"status": "running", "message": "StudyBuddy API is live"}