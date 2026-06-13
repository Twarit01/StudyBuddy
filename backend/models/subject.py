from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Subject(Base):
    __tablename__ = "subjects"

    id         = Column(Integer, primary_key=True, index=True)
    owner_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    name       = Column(String, nullable=False)
    color      = Column(String, default="#7c6af7")   # hex color for UI
    emoji      = Column(String, default="📚")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner     = relationship("User", back_populates="subjects")
    documents = relationship("Document", back_populates="subject", cascade="all, delete-orphan")