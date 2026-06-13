from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.subject import Subject
from models.document import Document
from services.document_ai import generate_subject_overview

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name:  str
    color: Optional[str] = "#7c6af7"
    emoji: Optional[str] = "📚"


class SubjectResponse(BaseModel):
    id:         int
    name:       str
    color:      str
    emoji:      str
    created_at: datetime
    doc_count:  Optional[int] = 0

    class Config:
        from_attributes = True


class SubjectUpdate(BaseModel):
    name:  Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=SubjectResponse, status_code=201)
def create_subject(
    request: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new subject folder."""
    # Check duplicate name
    existing = db.query(Subject).filter(
        Subject.owner_id == current_user.id,
        Subject.name == request.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{request.name}' already exists"
        )

    subject = Subject(
        owner_id=current_user.id,
        name=request.name,
        color=request.color,
        emoji=request.emoji
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)

    return {**subject.__dict__, "doc_count": 0}


@router.get("/", response_model=List[SubjectResponse])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all subjects with document count."""
    subjects = (
        db.query(Subject)
        .filter(Subject.owner_id == current_user.id)
        .order_by(Subject.created_at.asc())
        .all()
    )

    result = []
    for s in subjects:
        doc_count = db.query(Document).filter(
            Document.subject_id == s.id
        ).count()
        result.append({**s.__dict__, "doc_count": doc_count})

    return result


@router.get("/{subject_id}/documents")
def get_subject_documents(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents in a subject."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.owner_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    documents = db.query(Document).filter(
        Document.subject_id == subject_id
    ).all()

    return {
        "subject": subject,
        "documents": documents
    }


@router.post("/{subject_id}/overview")
def get_subject_overview(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate an AI overview of all documents in a subject."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.owner_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    documents = db.query(Document).filter(
        Document.subject_id == subject_id
    ).all()

    if not documents:
        raise HTTPException(
            status_code=400,
            detail="No documents in this subject yet"
        )

    overview = generate_subject_overview(documents, subject.name)
    return {"overview": overview, "subject": subject.name}


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    request: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update subject name, color, or emoji."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.owner_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if request.name:  subject.name  = request.name
    if request.color: subject.color = request.color
    if request.emoji: subject.emoji = request.emoji

    db.commit()
    db.refresh(subject)

    doc_count = db.query(Document).filter(
        Document.subject_id == subject_id
    ).count()

    return {**subject.__dict__, "doc_count": doc_count}


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a subject. Documents move to uncategorized."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.owner_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Move documents to uncategorized instead of deleting them
    db.query(Document).filter(
        Document.subject_id == subject_id
    ).update({"subject_id": None})

    db.delete(subject)
    db.commit()

    return {"message": f"Subject '{subject.name}' deleted. Documents moved to uncategorized."}