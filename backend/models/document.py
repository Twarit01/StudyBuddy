from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)        # pdf, docx, txt
    file_size = Column(Integer, nullable=False)       # in bytes
    
    # Tracking
    chunk_count = Column(Integer, default=0)          # how many chunks extracted
    is_processed = Column(Boolean, default=False)     # embedding done?
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="documents")

# Fix missing import
from sqlalchemy import Boolean