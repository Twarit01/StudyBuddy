from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    front = Column(Text, nullable=False)              # question / concept
    back = Column(Text, nullable=False)               # answer / explanation
    topic = Column(String, nullable=True)

    # SM-2 spaced repetition fields
    ease_factor = Column(Float, default=2.5)          # how easy this card is (SM-2)
    interval = Column(Integer, default=1)             # days until next review
    repetitions = Column(Integer, default=0)          # how many times reviewed
    next_review = Column(DateTime, default=datetime.utcnow)  # when to show next

    # Stats
    times_correct = Column(Integer, default=0)
    times_wrong = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="flashcards")