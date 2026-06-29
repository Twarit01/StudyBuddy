from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from core.database import Base


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id  = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    last_page    = Column(Integer, default=1)
    total_pages  = Column(Integer, default=1)
    percent      = Column(Float, default=0.0)
    last_read_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "document_id", name="uq_reading_progress_user_doc"),
    )
