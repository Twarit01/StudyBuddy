from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    topic = Column(String, nullable=True)             # e.g. "Thermodynamics"
    quiz_type = Column(String, nullable=False)        # "mcq", "short", "formula"
    difficulty = Column(String, default="medium")     # "easy", "medium", "hard"

    # Results
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, default=0)
    score_percentage = Column(Float, default=0.0)

    # Full quiz data stored as JSON string
    questions_data = Column(Text, nullable=True)      # JSON: full questions + answers

    # Timed exam mode
    time_taken_seconds = Column(Integer, nullable=True)
    is_timed_exam = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="quiz_attempts")