import json
import re
from datetime import datetime, timedelta
from services.gemini import generate_text
from services.rag import retrieve_relevant_chunks


# ── Flashcard generation ──────────────────────────────────────────────────────

def generate_flashcards(
    user_id: int,
    topic: str = None,
    count: int = 10,
    document_id: int = None
) -> list[dict]:
    """
    Generate flashcards from uploaded study material using RAG.
    """
    query = topic if topic else "key concepts definitions formulas"

    chunks = retrieve_relevant_chunks(
        user_id=user_id,
        query=query,
        top_k=8,
        document_id=document_id
    )

    if chunks:
        context = "\n\n".join([
            f"[{c['document_name']}, Page {c['page_num']}]\n{c['text']}"
            for c in chunks
        ])
    else:
        context = f"Use general engineering knowledge about {topic or 'core engineering concepts'}."

    prompt = f"""Generate {count} flashcards from this engineering study material.
Focus on key concepts, definitions, formulas, and important principles.

STUDY MATERIAL:
{context}

Return ONLY a valid JSON array. No markdown, no explanation.
Format:
[
  {{
    "front": "What is [concept]? or Define [term]",
    "back": "Clear concise answer or definition",
    "topic": "specific topic name",
    "hint": "optional memory hint"
  }}
]"""

    response = generate_text(prompt)

    # Parse JSON
    cleaned = re.sub(r"```json\s*|\s*```", "", response).strip()
    cleaned = re.sub(r"```\s*|\s*```", "", cleaned).strip()

    try:
        cards = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            cards = json.loads(match.group())
        else:
            raise ValueError("Could not parse flashcards from response")

    return cards


# ── SM-2 Algorithm ────────────────────────────────────────────────────────────

def calculate_sm2(
    ease_factor: float,
    interval: int,
    repetitions: int,
    quality: int  # 0-5 rating from student
) -> tuple[float, int, int]:
    """
    SM-2 Spaced Repetition Algorithm.

    quality ratings:
    0 - complete blackout
    1 - incorrect, but remembered on seeing answer
    2 - incorrect, but easy to recall
    3 - correct, but required significant effort
    4 - correct, with some hesitation
    5 - perfect recall

    Returns (new_ease_factor, new_interval, new_repetitions)
    """
    if quality < 3:
        # Failed — reset repetitions, review soon
        repetitions = 0
        interval = 1
    else:
        # Passed — increase interval
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease_factor)

        repetitions += 1

    # Update ease factor based on quality
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    # Ease factor floor — never goes below 1.3
    if ease_factor < 1.3:
        ease_factor = 1.3

    return round(ease_factor, 2), interval, repetitions


def get_next_review_date(interval: int) -> datetime:
    """Calculate the next review datetime based on interval in days."""
    return datetime.utcnow() + timedelta(days=interval)


def get_due_cards_count(flashcards: list) -> int:
    """Count how many flashcards are due for review today."""
    now = datetime.utcnow()
    return sum(1 for card in flashcards if card.next_review <= now)