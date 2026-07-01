import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.flashcard import Flashcard
from services.flashcard_generator import (
    generate_flashcards,
    calculate_sm2,
    get_next_review_date,
    get_due_cards_count
)
from services.xp_service import award_xp, update_streak

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateFlashcardsRequest(BaseModel):
    topic: Optional[str] = None
    count: int = 10
    document_id: Optional[int] = None


class ReviewCardRequest(BaseModel):
    quality: int   # 0-5 SM-2 rating


class FlashcardResponse(BaseModel):
    id: int
    front: str
    back: str
    topic: Optional[str]
    ease_factor: float
    interval: int
    repetitions: int
    next_review: datetime
    times_correct: int
    times_wrong: int
    created_at: datetime
    xp_awarded: Optional[int] = None

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=List[FlashcardResponse])
def generate_cards(
    request: GenerateFlashcardsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate flashcards from uploaded study material and save to DB.
    """
    if request.count < 1 or request.count > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="count must be between 1 and 30"
        )

    try:
        cards_data = generate_flashcards(
            user_id=current_user.id,
            topic=request.topic,
            count=request.count,
            document_id=request.document_id
        )
    except Exception as exc:
        logger.warning("Flashcard generation failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again later."
        )

    # Save all generated cards to database
    saved_cards = []
    for card_data in cards_data:
        card = Flashcard(
            owner_id=current_user.id,
            front=card_data["front"],
            back=card_data["back"],
            topic=card_data.get("topic"),
        )
        db.add(card)
        db.flush()   # get ID without full commit
        saved_cards.append(card)

    db.commit()

    # Refresh all to get updated fields
    for card in saved_cards:
        db.refresh(card)

    return saved_cards


@router.get("/", response_model=List[FlashcardResponse])
def get_all_flashcards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all flashcards for current user."""
    cards = (
        db.query(Flashcard)
        .filter(Flashcard.owner_id == current_user.id)
        .order_by(Flashcard.created_at.desc())
        .all()
    )
    return cards


@router.get("/due", response_model=List[FlashcardResponse])
def get_due_flashcards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all flashcards due for review today based on SM-2 schedule.
    This is what the dashboard shows as 'cards due today'.
    """
    now = datetime.utcnow()
    cards = (
        db.query(Flashcard)
        .filter(
            Flashcard.owner_id == current_user.id,
            Flashcard.next_review <= now
        )
        .order_by(Flashcard.next_review.asc())
        .all()
    )
    return cards


@router.post("/{card_id}/review", response_model=FlashcardResponse)
def review_flashcard(
    card_id: int,
    request: ReviewCardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a review for a flashcard.
    Updates SM-2 fields — ease factor, interval, next review date.

    Quality ratings:
    0 = complete blackout
    1 = wrong but recognized answer
    2 = wrong but easy recall
    3 = correct with effort
    4 = correct with hesitation
    5 = perfect recall
    """
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="quality must be between 0 and 5"
        )

    card = (
        db.query(Flashcard)
        .filter(
            Flashcard.id == card_id,
            Flashcard.owner_id == current_user.id
        )
        .first()
    )

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found"
        )

    # Run SM-2 algorithm
    new_ease, new_interval, new_reps = calculate_sm2(
        ease_factor=card.ease_factor,
        interval=card.interval,
        repetitions=card.repetitions,
        quality=request.quality
    )

    # Update card fields
    card.ease_factor = new_ease
    card.interval = new_interval
    card.repetitions = new_reps
    card.next_review = get_next_review_date(new_interval)

    # Update stats
    if request.quality >= 3:
        card.times_correct += 1
    else:
        card.times_wrong += 1

    db.commit()
    db.refresh(card)

    # ── Award XP ──
    total_xp = 0
    xp_result = award_xp(db, current_user, "flashcard_reviewed")
    total_xp += xp_result.get("awarded", 0)

    # Bonus XP when a card becomes "mastered" (long interval = well retained)
    if new_interval >= 21 and card.repetitions >= 3:
        mastery_result = award_xp(db, current_user, "flashcard_mastered")
        total_xp += mastery_result.get("awarded", 0)

    update_streak(db, current_user)

    response = FlashcardResponse.model_validate(card)
    response.xp_awarded = total_xp

    return response


@router.get("/stats")
def get_flashcard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get flashcard statistics for the progress dashboard.
    """
    all_cards = (
        db.query(Flashcard)
        .filter(Flashcard.owner_id == current_user.id)
        .all()
    )

    due_count = get_due_cards_count(all_cards)
    mastered = sum(1 for c in all_cards if c.repetitions >= 3 and c.ease_factor >= 2.5)
    learning = sum(1 for c in all_cards if c.repetitions > 0 and c.repetitions < 3)
    new_cards = sum(1 for c in all_cards if c.repetitions == 0)

    return {
        "total": len(all_cards),
        "due_today": due_count,
        "mastered": mastered,
        "learning": learning,
        "new": new_cards
    }


@router.delete("/{card_id}")
def delete_flashcard(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a single flashcard."""
    card = (
        db.query(Flashcard)
        .filter(
            Flashcard.id == card_id,
            Flashcard.owner_id == current_user.id
        )
        .first()
    )

    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flashcard not found"
        )

    db.delete(card)
    db.commit()

    return {"message": "Flashcard deleted successfully"}


@router.delete("/")
def delete_all_flashcards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all flashcards for current user."""
    db.query(Flashcard).filter(
        Flashcard.owner_id == current_user.id
    ).delete()
    db.commit()

    return {"message": "All flashcards deleted successfully"}
