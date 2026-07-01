from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base


class XPEvent(Base):
    """
    Records every XP-earning action for audit trail and history.
    """
    __tablename__ = "xp_events"

    id         = Column(Integer, primary_key=True, index=True)
    owner_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount     = Column(Integer, nullable=False)
    reason     = Column(String, nullable=False)   # e.g. "quiz_completed", "perfect_score"
    label      = Column(String, nullable=False)   # human readable e.g. "Completed a quiz"
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="xp_events")