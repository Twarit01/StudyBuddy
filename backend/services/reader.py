import os
from typing import Optional

from core.config import settings
from services.document_processor import extract_text, download_file_from_url
from services.gemini import generate_text, generate_with_history
from services.quiz_generator import parse_json_response, MCQ_PROMPT
from services.flashcard_generator import generate_flashcards_from_context


def get_document_file_path(filename: str) -> str:
    return os.path.join(settings.UPLOAD_DIR, filename)


def get_document_pages(file_path: str, file_type: str) -> list[dict]:
    return extract_text(file_path, file_type)


def get_document_pages_from_url(file_url: str, file_type: str) -> list[dict]:
    """
    Download file from a URL (Cloudinary) to a temp path, extract text, clean up.
    Use this instead of get_document_pages when file_url is set on the document.
    """
    tmp_path = download_file_from_url(file_url, file_type)
    try:
        return extract_text(tmp_path, file_type)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def get_page_text(file_path: str, file_type: str, page_num: int) -> Optional[str]:
    pages = get_document_pages(file_path, file_type)
    for page in pages:
        if page["page_num"] == page_num:
            return page["text"]
    return None


def get_page_text_from_url(file_url: str, file_type: str, page_num: int) -> Optional[str]:
    """URL-based version of get_page_text for Cloudinary-stored files."""
    pages = get_document_pages_from_url(file_url, file_type)
    for page in pages:
        if page["page_num"] == page_num:
            return page["text"]
    return None


def compute_percent(last_page: int, total_pages: int) -> float:
    if total_pages <= 0:
        return 0.0
    return round(min(100.0, (last_page / total_pages) * 100), 1)


SELECTION_PROMPTS = {
    "ask": """You are StudyBuddy AI. Answer the student's question using ONLY the selected passage below.
If the passage does not contain enough information, say so clearly.

SELECTED PASSAGE (Page {page_num} of "{document_name}"):
{selected_text}

QUESTION: {question}

Answer clearly and concisely.""",

    "explain": """You are StudyBuddy AI. Explain the following selected passage in simple, easy-to-understand terms
for an engineering student. Use analogies or examples when helpful.

PASSAGE (Page {page_num} of "{document_name}"):
{selected_text}

Provide a clear, simple explanation.""",

    "summarize": """You are StudyBuddy AI. Summarize the following selected passage in 2-4 concise bullet points.

PASSAGE (Page {page_num} of "{document_name}"):
{selected_text}

Provide a brief summary.""",
}


def run_selection_ai(
    action: str,
    selected_text: str,
    page_num: int,
    document_name: str,
    question: Optional[str] = None,
    follow_up_history: Optional[list[dict]] = None,
) -> dict:
    context_block = (
        f'Selected text from "{document_name}", page {page_num}:\n\n{selected_text}'
    )

    if action == "quiz":
        prompt = MCQ_PROMPT.format(
            count=3,
            topic="Selected passage",
            context=selected_text,
            difficulty="medium",
        )
        response = generate_text(prompt)
        questions = parse_json_response(response)
        for q in questions:
            q["type"] = "mcq"
        return {"response": f"Generated {len(questions)} quiz question(s) from your selection.", "questions": questions}

    if action == "flashcards":
        cards = generate_flashcards_from_context(selected_text, count=5, topic="Selected passage")
        return {
            "response": f"Generated {len(cards)} flashcard(s) from your selection.",
            "flashcards": cards,
        }

    if action == "ask" and follow_up_history:
        # Gemini requires role "model" instead of "assistant"
        role_map = {"assistant": "model", "user": "user"}
        history = [
            {"role": role_map.get(m["role"], m["role"]), "parts": [m["content"]]}
            for m in follow_up_history
        ]
        history.append({"role": "user", "parts": [question or "Explain this further."]})
        system = (
            "You are StudyBuddy AI. Answer follow-up questions using ONLY this selected passage as context:\n\n"
            + context_block
        )
        answer = generate_with_history(history, system_instruction=system)
        return {"response": answer}

    template = SELECTION_PROMPTS.get(action)
    if not template:
        raise ValueError(f"Unknown action: {action}")

    prompt = template.format(
        selected_text=selected_text,
        page_num=page_num,
        document_name=document_name,
        question=question or "What does this mean?",
    )
    answer = generate_text(prompt)
    return {"response": answer}
