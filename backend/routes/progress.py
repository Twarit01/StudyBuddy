from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.quiz_attempt import QuizAttempt
from models.flashcard import Flashcard
from models.chat_session import Message
from services.study_planner import generate_study_plan, get_weak_topics, get_due_cards_count

router = APIRouter()


@router.post("/study-plan")
def get_study_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a personalized AI study plan based on:
    - Weak topics from quiz history
    - Flashcards due today
    """
    # Get quiz history
    quiz_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.owner_id == current_user.id)
        .all()
    )

    # Get flashcards
    flashcards = (
        db.query(Flashcard)
        .filter(Flashcard.owner_id == current_user.id)
        .all()
    )

    # Get weak topics
    weak_topics = get_weak_topics(quiz_attempts)

    # Get due cards count
    due_count = get_due_cards_count(flashcards)

    # Generate AI study plan
    plan = generate_study_plan(
        weak_topics=weak_topics,
        due_cards_count=due_count,
        available_hours=2.0
    )

    return {
        "study_plan": plan,
        "weak_topics": weak_topics,
        "due_cards_today": due_count
    }