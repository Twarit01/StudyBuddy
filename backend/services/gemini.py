import time
import google.generativeai as genai
from core.config import settings

# Configure Gemini with API key once at import time
genai.configure(api_key=settings.GEMINI_API_KEY)

# ── Models ────────────────────────────────────────────────────────────────────
CHAT_MODEL  = "gemini-2.5-flash"
EMBED_MODEL = "models/gemini-embedding-001"


# ── Retry helper ──────────────────────────────────────────────────────────────

def _retry(fn, max_retries=3):
    """
    Calls fn() and retries up to max_retries times if rate limited.
    Waits 60s between retries.
    """
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            err = str(e)
            if "RESOURCE_EXHAUSTED" in err or "429" in err:
                if attempt < max_retries - 1:
                    wait = 60 * (attempt + 1)
                    print(f"⏳ Rate limit hit. Waiting {wait}s then retrying ({attempt + 2}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise Exception(
                        "Gemini rate limit exceeded. "
                        "Free tier = 15 requests/min. "
                        "Please wait a moment and try again."
                    )
            else:
                raise e


# ── Embeddings ────────────────────────────────────────────────────────────────

def get_embedding(text: str) -> list[float]:
    """Convert a text chunk into a vector for storage in ChromaDB."""
    def fn():
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=text,
            task_type="retrieval_document"
        )
        return result["embedding"]
    return _retry(fn)


def get_query_embedding(text: str) -> list[float]:
    """Convert a user query into a vector for similarity search."""
    def fn():
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=text,
            task_type="retrieval_query"
        )
        return result["embedding"]
    return _retry(fn)


# ── Text generation ───────────────────────────────────────────────────────────

def generate_text(prompt: str, system_instruction: str = None) -> str:
    """
    One-shot text generation.
    Used for quiz generation, flashcard generation, study plans.
    """
    def fn():
        if system_instruction:
            model = genai.GenerativeModel(
                model_name=CHAT_MODEL,
                system_instruction=system_instruction
            )
        else:
            model = genai.GenerativeModel(model_name=CHAT_MODEL)
        response = model.generate_content(prompt)
        return response.text
    return _retry(fn)


def generate_with_history(
    messages: list[dict],
    system_instruction: str = None
) -> str:
    """
    Multi-turn chat generation with conversation memory.
    Used for the Q&A chat feature.

    messages format:
    [
        {"role": "user",  "parts": ["Hello"]},
        {"role": "model", "parts": ["Hi! How can I help?"]},
        {"role": "user",  "parts": ["Explain Newton's law"]}
    ]
    """
    def fn():
        model = genai.GenerativeModel(
            model_name=CHAT_MODEL,
            system_instruction=system_instruction or (
                "You are StudyBuddy AI, an expert engineering tutor. "
                "Answer questions clearly and concisely. "
                "Use examples when helpful. "
                "When answering from provided context, always cite the source document. "
                "If the answer is not in the provided context, say so clearly."
            )
        )
        history  = messages[:-1]
        last_msg = messages[-1]["parts"][0]
        chat     = model.start_chat(history=history)
        response = chat.send_message(last_msg)
        return response.text
    return _retry(fn)


def generate_streaming(prompt: str, system_instruction: str = None):
    """
    Streaming generation — yields text chunks as they arrive.
    Used so chat responses appear word by word.
    """
    if system_instruction:
        model = genai.GenerativeModel(
            model_name=CHAT_MODEL,
            system_instruction=system_instruction
        )
    else:
        model = genai.GenerativeModel(model_name=CHAT_MODEL)

    response = model.generate_content(prompt, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text


def assess_confidence(question: str, context_chunks: list[str], answer: str) -> str:
    """
    Ask Gemini to rate how confident the answer is based on retrieved context.
    Returns 'high', 'medium', or 'low'.
    """
    context = "\n".join(context_chunks)
    prompt  = f"""
You retrieved the following context chunks to answer a question:

CONTEXT:
{context}

QUESTION: {question}
ANSWER: {answer}

Rate how well the context supports the answer.
Reply with ONLY one word: high, medium, or low.
- high:   answer is directly supported by context
- medium: answer is partially supported or inferred
- low:    context does not clearly support the answer
"""
    result = generate_text(prompt).strip().lower()
    return result if result in ["high", "medium", "low"] else "medium"