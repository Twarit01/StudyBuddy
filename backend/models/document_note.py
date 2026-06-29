from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from core.database import Base


class DocumentNote(Base):
    __tablename__ = "document_notes"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id      = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_num         = Column(Integer, nullable=False)
    highlighted_text = Column(Text, nullable=False)
    ai_explanation   = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
