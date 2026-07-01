import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.document import Document
from models.reading_progress import ReadingProgress
from models.document_note import DocumentNote
from models.subject import Subject
from services.document_processor import validate_file, save_uploaded_file, process_document
from services.rag import store_document_chunks, delete_document_chunks
from services.document_ai import generate_document_summary, generate_formula_sheet
from services.xp_service import award_xp, update_streak

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id:            int
    filename:      str
    original_name: str
    file_type:     str
    file_size:     int
    chunk_count:   int
    is_processed:  bool
    subject_id:    Optional[int] = None
    summary:       Optional[str] = None
    formula_sheet: Optional[str] = None
    created_at:    datetime

    class Config:
        from_attributes = True


class AssignSubjectRequest(BaseModel):
    subject_id: Optional[int] = None


def _ensure_subject_owner(
    subject_id: Optional[int],
    db: Session,
    current_user: User
) -> None:
    if subject_id is None:
        return

    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.owner_id == current_user.id
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")


def _delete_uploaded_file(filename: str) -> None:
    if not filename:
        return
    try:
        os.remove(os.path.join(settings.UPLOAD_DIR, filename))
    except FileNotFoundError:
        pass


def _ai_failure(detail: str) -> HTTPException:
    return HTTPException(status_code=503, detail=detail)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    subject_id: Optional[int] = Query(None),
    generate_summary: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process a document.
    Optionally assign to a subject and auto-generate summary.
    """
    file_bytes = await file.read()

    is_valid, error_msg = validate_file(file.filename, len(file_bytes))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    _ensure_subject_owner(subject_id, db, current_user)

    file_type = file.filename.rsplit(".", 1)[-1].lower()
    saved_filename, file_path = save_uploaded_file(file_bytes, file.filename)

    document = Document(
        owner_id=current_user.id,
        subject_id=subject_id,
        filename=saved_filename,
        original_name=file.filename,
        file_type=file_type,
        file_size=len(file_bytes),
        is_processed=False
    )
    try:
        db.add(document)
        db.commit()
        db.refresh(document)

        # Process document
        chunks = process_document(file_path, file_type)

        # Store in ChromaDB
        chunks_stored = store_document_chunks(
            user_id=current_user.id,
            document_id=document.id,
            document_name=file.filename,
            chunks=chunks
        )

        # Auto generate summary
        if generate_summary and chunks:
            try:
                document.summary = generate_document_summary(chunks, file.filename)
            except Exception:
                pass  # Summary is optional — don't fail upload if it errors

        document.chunk_count = chunks_stored
        document.is_processed = True
        db.commit()
        db.refresh(document)

    except HTTPException:
        db.rollback()
        _delete_uploaded_file(saved_filename)
        if document.id:
            delete_document_chunks(user_id=current_user.id, document_id=document.id)
            db.delete(document)
            db.commit()
        raise
    except Exception:
        db.rollback()
        _delete_uploaded_file(saved_filename)
        if document.id:
            delete_document_chunks(user_id=current_user.id, document_id=document.id)
            db.delete(document)
            db.commit()
        raise _ai_failure("Failed to process document. Please try again later.")

    # ── Award XP ──
    try:
        award_xp(db, current_user, "document_uploaded")
        update_streak(db, current_user)
    except Exception:
        pass  # XP failure should never block a successful upload

    return document
@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all documents. Optionally filter by subject.
    Pass subject_id=0 to get uncategorized documents.
    """
    query = db.query(Document).filter(Document.owner_id == current_user.id)

    if subject_id == 0:
        query = query.filter(Document.subject_id == None)
    elif subject_id:
        _ensure_subject_owner(subject_id, db, current_user)
        query = query.filter(Document.subject_id == subject_id)

    return query.order_by(Document.created_at.desc()).all()


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single document by ID."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.get("/{document_id}/summary")
def get_document_summary(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get or generate summary for a document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.summary:
        raise HTTPException(
            status_code=404,
            detail="No summary available. Re-upload the document to generate one."
        )

    return {
        "document_id": document_id,
        "document_name": document.original_name,
        "summary": document.summary
    }


@router.post("/{document_id}/generate-summary")
def regenerate_summary(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate summary for a document using stored chunks."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.is_processed:
        raise HTTPException(status_code=400, detail="Document not processed yet")

    # Re-extract chunks from ChromaDB for summary generation
    from services.rag import retrieve_relevant_chunks
    chunks = retrieve_relevant_chunks(
        user_id=current_user.id,
        query="main concepts topics overview summary",
        top_k=8,
        document_id=document_id
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="No content found for this document")

    chunk_dicts = [{"text": c["text"], "page_num": c["page_num"]} for c in chunks]
    document.summary = generate_document_summary(chunk_dicts, document.original_name)
    db.commit()

    return {
        "document_id": document_id,
        "summary": document.summary
    }


@router.get("/{document_id}/formula-sheet")
def get_formula_sheet(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get or generate formula sheet for a document."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "document_id": document_id,
        "document_name": document.original_name,
        "formula_sheet": document.formula_sheet,
        "has_formulas": bool(document.formula_sheet)
    }


@router.post("/{document_id}/generate-formula-sheet")
def generate_formula_sheet_route(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate formula sheet from document chunks."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    from services.rag import retrieve_relevant_chunks
    chunks = retrieve_relevant_chunks(
        user_id=current_user.id,
        query="formula equation law theorem mathematical expression",
        top_k=15,
        document_id=document_id
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="No content found for this document")

    chunk_dicts = [{"text": c["text"], "page_num": c["page_num"]} for c in chunks]
    document.formula_sheet = generate_formula_sheet(chunk_dicts, document.original_name)
    db.commit()

    return {
        "document_id": document_id,
        "document_name": document.original_name,
        "formula_sheet": document.formula_sheet
    }


@router.patch("/{document_id}/assign-subject")
def assign_subject(
    document_id: int,
    request: AssignSubjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign or unassign a document to a subject."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    _ensure_subject_owner(request.subject_id, db, current_user)

    document.subject_id = request.subject_id
    db.commit()

    return {"message": "Subject assigned successfully"}


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document and all its chunks from ChromaDB."""
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.owner_id == current_user.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_document_chunks(user_id=current_user.id, document_id=document_id)
    db.query(ReadingProgress).filter(ReadingProgress.document_id == document_id).delete()
    db.query(DocumentNote).filter(DocumentNote.document_id == document_id).delete()
    _delete_uploaded_file(document.filename)
    db.delete(document)
    db.commit()

    return {"message": f"Document '{document.original_name}' deleted successfully"}
