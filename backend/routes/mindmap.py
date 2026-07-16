import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.document import Document
from models.user import User
from services.mindmap_generator import generate_mindmap
from services.reader import get_document_file_path, get_document_pages, get_document_pages_from_url

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class MindMapRequest(BaseModel):
    document_ids: List[int]


class MindMapNode(BaseModel):
    id:          str
    label:       str
    description: str
    page:        int
    document:    str
    doc_id:      int


class MindMapEdge(BaseModel):
    source: str
    target: str
    label:  str


class MindMapResponse(BaseModel):
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=MindMapResponse)
def generate_mind_map(
    request: MindMapRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Generate an interactive concept mind-map from one or more documents.
    Calls Gemini to extract key concepts and their relationships.
    Returns a graph with nodes and edges ready for SVG rendering.
    """
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="At least one document ID is required.")
    if len(request.document_ids) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 documents can be mapped at once.")

    # Verify ownership, processed status, and load page text
    documents = []
    for doc_id in request.document_ids:
        doc = (
            db.query(Document)
            .filter(
                Document.id == doc_id,
                Document.owner_id == current_user.id,
                Document.is_processed == True,  # noqa: E712
            )
            .first()
        )
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document {doc_id} not found or not yet processed.",
            )

        # Load page text: 1) DB cache  2) Cloudinary  3) local file
        try:
            import json, os
            if doc.page_texts:
                pages = json.loads(doc.page_texts)
            elif doc.file_url:
                pages = get_document_pages_from_url(doc.file_url, doc.file_type)
            else:
                file_path = get_document_file_path(doc.filename)
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"Local file missing: {file_path}")
                pages = get_document_pages(file_path, doc.file_type)
        except Exception as exc:
            logger.warning("Could not read pages for doc %s: %s", doc_id, exc)
            raise HTTPException(
                status_code=422,
                detail=f"Could not read document '{doc.original_name}'. Please re-upload it.",
            )

        documents.append({
            "id":        doc.id,
            "name":      doc.original_name,
            "file_type": doc.file_type,
            "pages":     pages,
        })

    try:
        graph = generate_mindmap(documents)
    except Exception as exc:
        logger.error("Mind map generation failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable. Please try again shortly.",
        )

    if not graph.get("nodes"):
        raise HTTPException(
            status_code=422,
            detail="No concepts could be extracted from the selected documents. Try a different document.",
        )

    return graph
