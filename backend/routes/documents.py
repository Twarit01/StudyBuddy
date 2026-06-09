from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.document import Document
from services.document_processor import (
    validate_file, save_uploaded_file, process_document
)
from services.rag import store_document_chunks, delete_document_chunks

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    file_type: str
    file_size: int
    chunk_count: int
    is_processed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    message: str
    document: DocumentResponse
    chunks_stored: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process a document.
    Pipeline: validate → save → extract text → chunk → embed → store in ChromaDB
    """
    file_bytes = await file.read()

    # Validate file
    is_valid, error_msg = validate_file(file.filename, len(file_bytes))
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Get file extension
    file_type = file.filename.rsplit(".", 1)[-1].lower()

    # Save file to disk
    saved_filename, file_path = save_uploaded_file(file_bytes, file.filename)

    # Create document record in DB
    document = Document(
        owner_id=current_user.id,
        filename=saved_filename,
        original_name=file.filename,
        file_type=file_type,
        file_size=len(file_bytes),
        is_processed=False
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        # Process document — extract text and chunk it
        chunks = process_document(file_path, file_type)

        # Store chunks in ChromaDB with embeddings
        chunks_stored = store_document_chunks(
            user_id=current_user.id,
            document_id=document.id,
            document_name=file.filename,
            chunks=chunks
        )

        # Update document record
        document.chunk_count = chunks_stored
        document.is_processed = True
        db.commit()
        db.refresh(document)

    except Exception as e:
        # Mark as failed but keep the record
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )

    return UploadResponse(
        message=f"Document uploaded and processed successfully",
        document=DocumentResponse.model_validate(document),
        chunks_stored=chunks_stored
    )


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents uploaded by the current user."""
    documents = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return documents


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document and all its chunks from ChromaDB.
    """
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Remove from ChromaDB
    delete_document_chunks(
        user_id=current_user.id,
        document_id=document_id
    )

    # Remove from database
    db.delete(document)
    db.commit()

    return {"message": f"Document '{document.original_name}' deleted successfully"}


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single document by ID."""
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    return document