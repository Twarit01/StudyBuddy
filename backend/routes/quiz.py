import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.quiz_attempt import QuizAttempt
from services.quiz_generator import generate_quiz, evaluate_short_answer

router = APIRouter()

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
    key_points: Optional[List[str]] = []


class SubmitQuizRequest(BaseModel):
    topic: Optional[str] = "General Engineering"
    quiz_type: str
    difficulty: str = "medium"
    total_questions: int
    correct_answers: int
    questions_data: Optional[str] = None  # JSON string of full quiz
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}"
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate answer: {str(e)}"
        )

    return result


@router.post("/submit", response_model=QuizAttemptResponse)
def submit_quiz(
    request: SubmitQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save a completed quiz attempt to the database.
    Called after student finishes a quiz — stores score for progress tracking.
    """
    score_percentage = (
        round((request.correct_answers / request.total_questions) * 100, 1)
        if request.total_questions > 0 else 0.0
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

    return attempt


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