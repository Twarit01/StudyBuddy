from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id            = Column(Integer, primary_key=True, index=True)
    owner_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id    = Column(Integer, ForeignKey("subjects.id"), nullable=True)

    filename      = Column(String, nullable=False)   # local name (kept for fallback)
    original_name = Column(String, nullable=False)
    file_type     = Column(String, nullable=False)
    file_size     = Column(Integer, nullable=False)
    file_url      = Column(Text, nullable=True)       # Cloudinary URL (persistent storage)
    page_texts    = Column(Text, nullable=True)       # JSON: [{page_num, text}, ...] cached at upload

    # Processing
    chunk_count    = Column(Integer, default=0)
    is_processed   = Column(Boolean, default=False)

    # AI generated content
    summary        = Column(Text, nullable=True)       # auto summary
    formula_sheet  = Column(Text, nullable=True)       # extracted formulas

    created_at     = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner   = relationship("User",    back_populates="documents")
    subject = relationship("Subject", back_populates="documents")