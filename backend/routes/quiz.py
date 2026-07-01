import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.quiz_attempt import QuizAttempt
from models.quiz_mistake import QuizMistake
from services.quiz_generator import generate_quiz, evaluate_short_answer
from services.xp_service import award_xp, update_streak

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    topic: Optional[str] = "General Engineering"
    quiz_type: str = "mcq"           # mcq, short, formula
    difficulty: str = "medium"       # easy, medium, hard
    count: int = 5
    document_id: Optional[int] = None


class SubmitAnswerRequest(BaseModel):
    question: str
    student_answer: str
    expected_answer: str
    key_points: List[str] = Field(default_factory=list)


class QuizMistakeCreate(BaseModel):
    topic: Optional[str] = None
    quiz_type: str
    question: str
    student_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None


class SubmitQuizRequest(BaseModel):
    topic: Optional[str] = "General Engineering"
    quiz_type: str
    difficulty: str = "medium"
    total_questions: int
    correct_answers: int
    questions_data: Optional[str] = None  # JSON string of full quiz
    mistakes: List[QuizMistakeCreate] = Field(default_factory=list)
    time_taken_seconds: Optional[int] = None
    is_timed_exam: bool = False


class QuizAttemptResponse(BaseModel):
    id: int
    topic: Optional[str]
    quiz_type: str
    difficulty: str
    total_questions: int
    correct_answers: int
    score_percentage: float
    is_timed_exam: bool
    created_at: datetime

    class Config:
        from_attributes = True

class XPAwardInfo(BaseModel):
    awarded: int
    reason: str
    label: Optional[str] = None
    total_xp: Optional[int] = None
    level: Optional[int] = None
    leveled_up: Optional[bool] = None

class QuizSubmitResponse(QuizAttemptResponse):
    xp_events: List[XPAwardInfo] = Field(default_factory=list)
    total_xp_earned: int = 0
    current_streak: Optional[int] = None
    leveled_up: bool = False

class QuizMistakeResponse(BaseModel):
    id: int
    attempt_id: Optional[int]
    topic: Optional[str]
    quiz_type: str
    question: str
    student_answer: Optional[str]
    correct_answer: Optional[str]
    explanation: Optional[str]
    is_resolved: bool
    retry_count: int
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate_quiz_questions(
    request: GenerateQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate quiz questions using RAG from uploaded documents.
    Returns list of questions — not saved until student submits.
    """
    # Validate quiz type
    if request.quiz_type not in ["mcq", "short", "formula"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="quiz_type must be one of: mcq, short, formula"
        )

    # Validate difficulty
    if request.difficulty not in ["easy", "medium", "hard"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="difficulty must be one of: easy, medium, hard"
        )

    # Validate count
    if request.count < 1 or request.count > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="count must be between 1 and 20"
        )

    try:
        questions = generate_quiz(
            user_id=current_user.id,
            quiz_type=request.quiz_type,
            topic=request.topic,
            difficulty=request.difficulty,
            count=request.count,
            document_id=request.document_id
        )
    except Exception as exc:
        logger.warning("Quiz generation failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again later."
        )

    return {
        "topic": request.topic,
        "quiz_type": request.quiz_type,
        "difficulty": request.difficulty,
        "count": len(questions),
        "questions": questions
    }


@router.post("/evaluate-answer")
def evaluate_answer(
    request: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Evaluate a single short answer using Gemini.
    Called when student submits a short answer or formula question.
    """
    try:
        result = evaluate_short_answer(
            question=request.question,
            student_answer=request.student_answer,
            expected_answer=request.expected_answer,
            key_points=request.key_points
        )
    except Exception as exc:
        logger.warning("Answer evaluation failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again later."
        )

    return result


@router.post("/submit", response_model=QuizSubmitResponse)
def submit_quiz(
    request: SubmitQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a completed quiz attempt to the database.
    Called after student finishes a quiz — stores score for progress tracking.
    Also awards XP for completion, score bonuses, and daily streak.
    """
    if request.total_questions < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="total_questions must be at least 1"
        )

    if request.correct_answers < 0 or request.correct_answers > request.total_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="correct_answers must be between 0 and total_questions"
        )

    score_percentage = (
        round((request.correct_answers / request.total_questions) * 100, 1)
    )

    attempt = QuizAttempt(
        owner_id=current_user.id,
        topic=request.topic,
        quiz_type=request.quiz_type,
        difficulty=request.difficulty,
        total_questions=request.total_questions,
        correct_answers=request.correct_answers,
        score_percentage=score_percentage,
        questions_data=request.questions_data,
        time_taken_seconds=request.time_taken_seconds,
        is_timed_exam=request.is_timed_exam
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    for mistake_data in request.mistakes or []:
        mistake = QuizMistake(
            owner_id=current_user.id,
            attempt_id=attempt.id,
            topic=mistake_data.topic or request.topic,
            quiz_type=mistake_data.quiz_type,
            question=mistake_data.question,
            student_answer=mistake_data.student_answer,
            correct_answer=mistake_data.correct_answer,
            explanation=mistake_data.explanation
        )
        db.add(mistake)

    if request.mistakes:
        db.commit()

    # ── Award XP ──
    xp_events = []
    xp_events.append(award_xp(db, current_user, "quiz_completed"))
    if score_percentage == 100:
        xp_events.append(award_xp(db, current_user, "quiz_perfect_score"))
    elif score_percentage >= 80:
        xp_events.append(award_xp(db, current_user, "quiz_good_score"))

    streak_info = update_streak(db, current_user)
    xp_events.extend(streak_info.get("xp_events", []))

    total_xp_earned = sum(e.get("awarded", 0) for e in xp_events)
    leveled_up = any(e.get("leveled_up") for e in xp_events)

    response = QuizSubmitResponse.model_validate(attempt)
    response.xp_events = xp_events
    response.total_xp_earned = total_xp_earned
    response.current_streak = streak_info.get("current_streak")
    response.leveled_up = leveled_up

    return response


@router.get("/mistakes", response_model=List[QuizMistakeResponse])
def get_quiz_mistakes(
    include_resolved: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get saved quiz mistakes for review and retry practice."""
    limit = max(1, min(limit, 100))
    query = db.query(QuizMistake).filter(QuizMistake.owner_id == current_user.id)
    if not include_resolved:
        query = query.filter(QuizMistake.is_resolved == False)

    return (
        query
        .order_by(QuizMistake.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/mistakes/{mistake_id}/resolve", response_model=QuizMistakeResponse)
def resolve_quiz_mistake(
    mistake_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a saved mistake as resolved after retry/review."""
    mistake = (
        db.query(QuizMistake)
        .filter(
            QuizMistake.id == mistake_id,
            QuizMistake.owner_id == current_user.id
        )
        .first()
    )

    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found")

    mistake.is_resolved = True
    mistake.retry_count += 1
    mistake.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(mistake)

    return mistake


@router.get("/history", response_model=List[QuizAttemptResponse])
def get_quiz_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all quiz attempts for current user — newest first."""
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.owner_id == current_user.id)
        .order_by(QuizAttempt.created_at.desc())
        .all()
    )
    return attempts


@router.get("/history/{attempt_id}")
def get_quiz_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single quiz attempt with full questions data."""
    attempt = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == attempt_id,
            QuizAttempt.owner_id == current_user.id
        )
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz attempt not found"
        )

    return {
        "id": attempt.id,
        "topic": attempt.topic,
        "quiz_type": attempt.quiz_type,
        "difficulty": attempt.difficulty,
        "total_questions": attempt.total_questions,
        "correct_answers": attempt.correct_answers,
        "score_percentage": attempt.score_percentage,
        "time_taken_seconds": attempt.time_taken_seconds,
        "is_timed_exam": attempt.is_timed_exam,
        "questions_data": json.loads(attempt.questions_data) if attempt.questions_data else [],
        "created_at": attempt.created_at
    }


@router.delete("/history/{attempt_id}")
def delete_quiz_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quiz attempt from history."""
    attempt = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.id == attempt_id,
            QuizAttempt.owner_id == current_user.id
        )
        .first()
    )

    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz attempt not found"
        )

    db.delete(attempt)
    db.commit()

    return {"message": "Quiz attempt deleted successfully"}
