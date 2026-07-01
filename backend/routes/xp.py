from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from services.xp_service import get_xp_summary

router = APIRouter()


class XPEventResponse(BaseModel):
    id: int
    amount: int
    reason: str
    label: str
    created_at: datetime

    class Config:
        from_attributes = True


class XPSummaryResponse(BaseModel):
    total_xp: int
    level: int
    xp_into_level: int
    xp_needed_for_next: int
    xp_progress_pct: float
    current_streak: int
    longest_streak: int
    recent_events: List[XPEventResponse]


@router.get("/summary", response_model=XPSummaryResponse)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's XP, level, streak, and recent XP history.
    Used by the dashboard and sidebar to display gamification stats.
    """
    return get_xp_summary(db, current_user)