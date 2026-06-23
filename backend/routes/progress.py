from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.quiz_attempt import QuizAttempt
from models.quiz_mistake import QuizMistake
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

    open_mistakes = (
        db.query(QuizMistake)
        .filter(
            QuizMistake.owner_id == current_user.id,
            QuizMistake.is_resolved == False
        )
        .order_by(QuizMistake.created_at.desc())
        .limit(10)
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

    weak_only = [t for t in weak_topics if t["is_weak"]]
    today_tasks = []
    if due_count > 0:
        today_tasks.append({
            "type": "flashcards",
            "title": f"Review {due_count} due flashcard{'s' if due_count != 1 else ''}",
            "minutes": min(30, max(10, due_count * 2)),
            "priority": "high"
        })
    if open_mistakes:
        today_tasks.append({
            "type": "mistakes",
            "title": f"Retry {min(len(open_mistakes), 5)} saved quiz mistake{'s' if len(open_mistakes) != 1 else ''}",
            "minutes": 20,
            "priority": "high"
        })
    for topic in weak_only[:3]:
        today_tasks.append({
            "type": "quiz",
            "title": f"Practice {topic['topic']} with a short quiz",
            "minutes": 25,
            "priority": "medium"
        })
    if not today_tasks:
        today_tasks.append({
            "type": "explore",
            "title": "Upload a document or take a quiz to personalize your plan",
            "minutes": 20,
            "priority": "low"
        })

    weekly_plan = [
        {"day": "Today", "focus": today_tasks[0]["title"], "minutes": today_tasks[0]["minutes"]},
        {"day": "Tomorrow", "focus": weak_only[0]["topic"] if weak_only else "Review recent documents", "minutes": 45},
        {"day": "Day 3", "focus": "Flashcards and mistake notebook", "minutes": 35},
        {"day": "Day 4", "focus": weak_only[1]["topic"] if len(weak_only) > 1 else "Mixed quiz practice", "minutes": 45},
        {"day": "Day 5", "focus": "Timed quiz checkpoint", "minutes": 30},
    ]

    return {
        "study_plan": plan,
        "weak_topics": weak_topics,
        "due_cards_today": due_count,
        "open_mistakes": len(open_mistakes),
        "today_tasks": today_tasks,
        "weekly_plan": weekly_plan
    }
