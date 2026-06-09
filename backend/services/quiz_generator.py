import json
import re
from services.gemini import generate_text
from services.rag import retrieve_relevant_chunks, build_rag_prompt


# ── Prompt templates ──────────────────────────────────────────────────────────

MCQ_PROMPT = """Generate {count} multiple choice questions about "{topic}" for engineering students.
Use this study material as your source:

{context}

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
Format:
[
  {{
    "question": "Question text here",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct_answer": "A",
    "explanation": "Why A is correct",
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""


SHORT_ANSWER_PROMPT = """Generate {count} short answer questions about "{topic}" for engineering students.
Use this study material as your source:

{context}

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
Format:
[
  {{
    "question": "Question text here",
    "answer": "Expected answer here",
    "key_points": ["point1", "point2"],
    "explanation": "Detailed explanation",
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""


FORMULA_PROMPT = """Generate {count} formula recall questions about "{topic}" for engineering students.
Use this study material as your source:

{context}

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks.
Format:
[
  {{
    "question": "What is the formula for [concept]?",
    "answer": "formula in plain text e.g. F = ma",
    "latex": "F = ma",
    "variables": {{"F": "Force in Newtons", "m": "mass in kg", "a": "acceleration in m/s²"}},
    "explanation": "What each variable means",
    "topic": "{topic}",
    "difficulty": "{difficulty}"
  }}
]"""


# ── JSON parser ───────────────────────────────────────────────────────────────

def parse_json_response(response: str) -> list:
    """
    Safely parse JSON from Gemini response.
    Handles cases where Gemini wraps output in markdown code blocks.
    """
    # Strip markdown code blocks if present
    cleaned = re.sub(r"```json\s*|\s*```", "", response).strip()
    cleaned = re.sub(r"```\s*|\s*```", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON array in the response
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError("Could not parse JSON from Gemini response")


# ── Quiz generation ───────────────────────────────────────────────────────────

def generate_quiz(
    user_id: int,
    quiz_type: str,
    topic: str,
    difficulty: str = "medium",
    count: int = 5,
    document_id: int = None
) -> list[dict]:
    """
    Generate quiz questions using RAG.

    1. Retrieve relevant chunks for the topic
    2. Build context from chunks
    3. Send to Gemini with structured prompt
    4. Parse and return questions
    """
    # Step 1: Get relevant context
    chunks = retrieve_relevant_chunks(
        user_id=user_id,
        query=f"{topic} questions {difficulty}",
        top_k=6,
        document_id=document_id
    )

    # Build context string
    if chunks:
        context = "\n\n".join([
            f"[{c['document_name']}, Page {c['page_num']}]\n{c['text']}"
            for c in chunks
        ])
    else:
        context = f"Use your general engineering knowledge about {topic}."

    # Step 2: Select prompt template
    prompt_map = {
        "mcq": MCQ_PROMPT,
        "short": SHORT_ANSWER_PROMPT,
        "formula": FORMULA_PROMPT
    }
    template = prompt_map.get(quiz_type, MCQ_PROMPT)

    # Step 3: Fill template
    prompt = template.format(
        count=count,
        topic=topic or "Engineering",
        context=context,
        difficulty=difficulty
    )

    # Step 4: Generate and parse
    response = generate_text(prompt)
    questions = parse_json_response(response)

    # Add type field to each question
    for q in questions:
        q["type"] = quiz_type

    return questions


def evaluate_short_answer(
    question: str,
    student_answer: str,
    expected_answer: str,
    key_points: list[str]
) -> dict:
    """
    Use Gemini to evaluate a student's short answer.
    Returns score and feedback.
    """
    prompt = f"""Evaluate this student's answer for an engineering question.

QUESTION: {question}
EXPECTED ANSWER: {expected_answer}
KEY POINTS TO COVER: {', '.join(key_points)}
STUDENT ANSWER: {student_answer}

Return ONLY valid JSON. No markdown.
{{
  "score": <0-100>,
  "is_correct": <true if score >= 70>,
  "feedback": "Brief feedback on what was right/wrong",
  "missing_points": ["points the student missed"]
}}"""

    response = generate_text(prompt)
    return parse_json_response(response)