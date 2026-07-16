import os
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.document import Document
from models.reading_progress import ReadingProgress
from models.document_note import DocumentNote
from models.flashcard import Flashcard
from services.reader import (
    get_document_file_path,
    get_document_pages,
    get_document_pages_from_url,
    get_page_text,
    get_page_text_from_url,
    compute_percent,
    run_selection_ai,
)
from services.flashcard_generator import get_next_review_date

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class PageInfo(BaseModel):
    page_num: int


class PagesResponse(BaseModel):
    document_id: int
    total_pages: int
    pages: List[PageInfo]


class PageTextResponse(BaseModel):
    page_num: int
    text: str


class ReadingProgressResponse(BaseModel):
    document_id: int
    last_page: int
    total_pages: int
    percent: float
    last_read_at: datetime
    document_name: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateProgressRequest(BaseModel):
    last_page: int
    total_pages: int


class NoteCreateRequest(BaseModel):
    page_num: int
    highlighted_text: str
    ai_explanation: Optional[str] = None


class NoteResponse(BaseModel):
    id: int
    document_id: int
    page_num: int
    highlighted_text: str
    ai_explanation: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FollowUpMessage(BaseModel):
    role: str
    content: str


class SelectionAIRequest(BaseModel):
    action: str = Field(..., description="ask|explain|summarize|quiz|flashcards")
    selected_text: str
    page_num: int
    question: Optional[str] = None
    follow_up_history: Optional[List[FollowUpMessage]] = None
    save_flashcards: bool = False


class SelectionAIResponse(BaseModel):
    action: str
    response: str
    questions: Optional[list] = None
    flashcards: Optional[list] = None
    saved_flashcard_ids: Optional[list] = None


class ReadingStatsResponse(BaseModel):
    total_documents_read: int
    total_notes: int
    average_progress: float
    recent_documents: List[ReadingProgressResponse]
    reading_history: List[ReadingProgressResponse]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_owned_document(document_id: int, db: Session, user: User) -> Document:
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == user.id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def _progress_to_response(progress: ReadingProgress, document_name: str = None) -> dict:
    return {
        "document_id": progress.document_id,
        "last_page": progress.last_page,
        "total_pages": progress.total_pages,
        "percent": progress.percent,
        "last_read_at": progress.last_read_at,
        "document_name": document_name,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ReadingStatsResponse)
def get_reading_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reading analytics for Dashboard and Progress pages."""
    progress_rows = (
        db.query(ReadingProgress, Document.original_name)
        .join(Document, Document.id == ReadingProgress.document_id)
        .filter(ReadingProgress.user_id == current_user.id)
        .order_by(ReadingProgress.last_read_at.desc())
        .all()
    )

    note_count = db.query(DocumentNote).filter(
        DocumentNote.user_id == current_user.id
    ).count()

    recent = [
        _progress_to_response(p, name)
        for p, name in progress_rows[:5]
    ]
    history = [
        _progress_to_response(p, name)
        for p, name in progress_rows[:20]
    ]

    avg = (
        round(sum(p.percent for p, _ in progress_rows) / len(progress_rows), 1)
        if progress_rows else 0.0
    )

    return {
        "total_documents_read": len(progress_rows),
        "total_notes": note_count,
        "average_progress": avg,
        "recent_documents": recent,
        "reading_history": history,
    }


@router.get("/progress", response_model=List[ReadingProgressResponse])
def list_all_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(ReadingProgress, Document.original_name)
        .join(Document, Document.id == ReadingProgress.document_id)
        .filter(ReadingProgress.user_id == current_user.id)
        .order_by(ReadingProgress.last_read_at.desc())
        .all()
    )
    return [_progress_to_response(p, name) for p, name in rows]


@router.get("/{document_id}/file-url")
def get_document_file_url(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the Cloudinary URL (or local fallback URL) for the document file."""
    document = _get_owned_document(document_id, db, current_user)

    if document.file_url:
        return {"file_url": document.file_url, "source": "cloudinary"}

    # Fallback: serve via the local /file endpoint
    return {"file_url": None, "source": "local"}


@router.get("/{document_id}/file")
def get_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the original uploaded file (local fallback when Cloudinary not configured)."""
    document = _get_owned_document(document_id, db, current_user)

    # Prefer Cloudinary URL redirect
    if document.file_url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=document.file_url)

    file_path = get_document_file_path(document.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain",
    }
    return FileResponse(
        file_path,
        media_type=media_types.get(document.file_type, "application/octet-stream"),
        filename=document.original_name,
    )


@router.get("/{document_id}/pages", response_model=PagesResponse)
def get_pages(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_owned_document(document_id, db, current_user)
    try:
        # 1. Use DB-cached page texts (fastest, no file download needed)
        if document.page_texts:
            import json
            pages = json.loads(document.page_texts)
        # 2. Fallback: download from Cloudinary and extract
        elif document.file_url:
            pages = get_document_pages_from_url(document.file_url, document.file_type)
        # 3. Last resort: local file (only exists on fresh upload before Cloudinary)
        else:
            file_path = get_document_file_path(document.filename)
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=404,
                    detail="File not found. Please re-upload this document."
                )
            pages = get_document_pages(file_path, document.file_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read document: {str(e)}")
    return {
        "document_id": document_id,
        "total_pages": len(pages) or 1,
        "pages": [{"page_num": p["page_num"]} for p in pages] or [{"page_num": 1}],
    }


@router.get("/{document_id}/pages/{page_num}", response_model=PageTextResponse)
def get_page_content(
    document_id: int,
    page_num: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_owned_document(document_id, db, current_user)
    try:
        # 1. Use DB-cached page texts
        if document.page_texts:
            import json
            pages = json.loads(document.page_texts)
            match = next((p for p in pages if p["page_num"] == page_num), None)
            text = match["text"] if match else None
        # 2. Fallback: download from Cloudinary
        elif document.file_url:
            text = get_page_text_from_url(document.file_url, document.file_type, page_num)
        # 3. Last resort: local file
        else:
            file_path = get_document_file_path(document.filename)
            if not os.path.exists(file_path):
                raise HTTPException(
                    status_code=404,
                    detail="File not found. Please re-upload this document."
                )
            text = get_page_text(file_path, document.file_type, page_num)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read page: {str(e)}")
    if text is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"page_num": page_num, "text": text}


@router.get("/{document_id}/progress", response_model=ReadingProgressResponse)
def get_reading_progress(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_owned_document(document_id, db, current_user)
    progress = db.query(ReadingProgress).filter(
        ReadingProgress.user_id == current_user.id,
        ReadingProgress.document_id == document_id,
    ).first()

    if not progress:
        if document.file_url:
            total = len(get_document_pages_from_url(document.file_url, document.file_type)) or 1
        else:
            file_path = get_document_file_path(document.filename)
            total = len(get_document_pages(file_path, document.file_type)) or 1
        return {
            "document_id": document_id,
            "last_page": 1,
            "total_pages": total,
            "percent": 0.0,
            "last_read_at": datetime.utcnow(),
            "document_name": document.original_name,
        }

    return _progress_to_response(progress, document.original_name)


@router.patch("/{document_id}/progress", response_model=ReadingProgressResponse)
def update_reading_progress(
    document_id: int,
    request: UpdateProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = _get_owned_document(document_id, db, current_user)
    total = max(1, request.total_pages)
    last_page = max(1, min(request.last_page, total))
    percent = compute_percent(last_page, total)

    progress = db.query(ReadingProgress).filter(
        ReadingProgress.user_id == current_user.id,
        ReadingProgress.document_id == document_id,
    ).first()

    if progress:
        progress.last_page = last_page
        progress.total_pages = total
        progress.percent = percent
        progress.last_read_at = datetime.utcnow()
    else:
        progress = ReadingProgress(
            user_id=current_user.id,
            document_id=document_id,
            last_page=last_page,
            total_pages=total,
            percent=percent,
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)
    return _progress_to_response(progress, document.original_name)


@router.get("/{document_id}/notes", response_model=List[NoteResponse])
def list_notes(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_document(document_id, db, current_user)
    notes = (
        db.query(DocumentNote)
        .filter(
            DocumentNote.user_id == current_user.id,
            DocumentNote.document_id == document_id,
        )
        .order_by(DocumentNote.created_at.desc())
        .all()
    )
    return notes


@router.post("/{document_id}/notes", response_model=NoteResponse)
def create_note(
    document_id: int,
    request: NoteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_document(document_id, db, current_user)
    note = DocumentNote(
        user_id=current_user.id,
        document_id=document_id,
        page_num=request.page_num,
        highlighted_text=request.highlighted_text,
        ai_explanation=request.ai_explanation,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(DocumentNote).filter(
        DocumentNote.id == note_id,
        DocumentNote.user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}


@router.post("/{document_id}/selection-ai", response_model=SelectionAIResponse)
def selection_ai(
    document_id: int,
    request: SelectionAIRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run AI actions on selected text only — no full-document RAG."""
    document = _get_owned_document(document_id, db, current_user)

    valid_actions = {"ask", "explain", "summarize", "quiz", "flashcards"}
    if request.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Use: {valid_actions}")

    if not request.selected_text.strip():
        raise HTTPException(status_code=400, detail="No text selected")

    try:
        result = run_selection_ai(
            action=request.action,
            selected_text=request.selected_text,
            page_num=request.page_num,
            document_name=document.original_name,
            question=request.question,
            follow_up_history=[
                {"role": m.role, "content": m.content}
                for m in (request.follow_up_history or [])
            ] if request.follow_up_history else None,
        )
    except Exception as exc:
        logger.warning("Selection AI failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable. Please try again later.",
        )

    saved_ids = None
    if request.action == "flashcards" and request.save_flashcards and result.get("flashcards"):
        saved_ids = []
        for card in result["flashcards"]:
            fc = Flashcard(
                owner_id=current_user.id,
                front=card.get("front", ""),
                back=card.get("back", ""),
                topic=card.get("topic", "Selected passage"),
                ease_factor=2.5,
                interval=0,
                repetitions=0,
                next_review=get_next_review_date(0),
            )
            db.add(fc)
            db.flush()
            saved_ids.append(fc.id)
        db.commit()

    return SelectionAIResponse(
        action=request.action,
        response=result["response"],
        questions=result.get("questions"),
        flashcards=result.get("flashcards"),
        saved_flashcard_ids=saved_ids,
    )
