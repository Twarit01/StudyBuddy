import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.chat_session import ChatSession, Message
from services.rag import retrieve_relevant_chunks, build_rag_prompt
from services.gemini import generate_with_history, assess_confidence

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    session_id: Optional[int] = None
    document_id: Optional[int] = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[str] = None
    confidence: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AskResponse(BaseModel):
    session_id: int
    message: MessageResponse
    sources: list
    confidence: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
def ask_question(
    request: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Main Q&A endpoint.
    1. Get or create chat session
    2. Retrieve relevant chunks from ChromaDB
    3. Build RAG prompt
    4. Generate answer with Gemini
    5. Assess confidence
    6. Save messages to DB
    7. Return answer with sources
    """
    # Step 1: Get or create session
    if request.session_id:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.id == request.session_id,
                ChatSession.owner_id == current_user.id
            )
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )
    else:
        # Create new session with title from first question
        title = request.question[:50] + "..." if len(request.question) > 50 else request.question
        session = ChatSession(
            owner_id=current_user.id,
            title=title
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Step 2: Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(
        user_id=current_user.id,
        query=request.question,
        top_k=5,
        document_id=request.document_id
    )

    # Step 3: Build RAG prompt
    rag_prompt, context_texts = build_rag_prompt(request.question, chunks)

    # Step 4: Get conversation history for context (last 6 messages)
    recent_messages = (
        db.query(Message)
        .filter(Message.session_id == session.id)
        .order_by(Message.created_at.desc())
        .limit(6)
        .all()
    )
    recent_messages.reverse()

    # Build message history for Gemini
    history = []
    for msg in recent_messages:
        role = "model" if msg.role == "assistant" else "user"
        history.append({"role": role, "parts": [msg.content]})

    # Add current question with RAG context
    history.append({"role": "user", "parts": [rag_prompt]})

    # Step 5: Generate answer
    answer = generate_with_history(history)

    # Step 6: Assess confidence
    confidence = "medium"

    # Step 7: Format sources
    sources = [
        {
            "document_name": c["document_name"],
            "page_num": c["page_num"],
            "similarity_score": c["similarity_score"],
            "text_preview": c["text"][:200] + "..."
        }
        for c in chunks
    ]

    # Step 8: Save user message
    user_message = Message(
        session_id=session.id,
        role="user",
        content=request.question
    )
    db.add(user_message)

    # Save assistant message
    assistant_message = Message(
        session_id=session.id,
        role="assistant",
        content=answer,
        sources=json.dumps(sources),
        confidence=confidence
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return AskResponse(
        session_id=session.id,
        message=MessageResponse.model_validate(assistant_message),
        sources=sources,
        confidence=confidence
    )


@router.get("/sessions", response_model=List[SessionResponse])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all chat sessions for current user."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.owner_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return sessions


@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all messages in a chat session."""
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.owner_id == current_user.id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return messages


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a chat session and all its messages."""
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.owner_id == current_user.id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    db.delete(session)
    db.commit()

    return {"message": "Session deleted successfully"}