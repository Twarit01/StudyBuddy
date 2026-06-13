from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    # Relationships
    documents    = relationship("Document",    back_populates="owner", cascade="all, delete-orphan")
    chat_sessions= relationship("ChatSession", back_populates="owner", cascade="all, delete-orphan")
    quiz_attempts= relationship("QuizAttempt", back_populates="owner", cascade="all, delete-orphan")
    flashcards   = relationship("Flashcard",   back_populates="owner", cascade="all, delete-orphan")
    subjects     = relationship("Subject",     back_populates="owner", cascade="all, delete-orphan")