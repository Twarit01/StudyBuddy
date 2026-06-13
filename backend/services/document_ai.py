import re
from services.gemini import generate_text
def generate_document_summary(chunks: list[dict], document_name: str) -> str:
    """
    Generate a structured summary of a document from its chunks.
    Called automatically after document is processed.
    """
    # Take first 8 chunks for summary — enough context without hitting limits
    sample_chunks = chunks[:8]
    context = "\n\n".join([
        f"[Page {c['page_num']}]\n{c['text']}"
        for c in sample_chunks
    ])

    prompt = f"""You are summarizing study material for an engineering student.

Document: {document_name}

Content:
{context}

Generate a structured study summary with these sections:
1. **Overview** — What this document covers in 2-3 sentences
2. **Key Topics** — Bullet list of main topics covered
3. **Important Concepts** — 5-8 most important concepts explained briefly
4. **Key Formulas** — Any formulas or equations mentioned (if applicable)
5. **Quick Review** — 3 most important things to remember

Keep it concise and useful for exam preparation.
Format with clear headings using **bold** markdown."""

    return generate_text(prompt)


def generate_formula_sheet(chunks: list[dict], document_name: str) -> str:
    """
    Extract all formulas and equations from document chunks.
    Returns a clean formatted formula sheet.
    """
    # Use more chunks for formula extraction — formulas can appear anywhere
    sample_chunks = chunks[:15]
    context = "\n\n".join([
        f"[Page {c['page_num']}]\n{c['text']}"
        for c in sample_chunks
    ])

    prompt = f"""Extract ALL formulas, equations, and mathematical expressions from this engineering study material.

Document: {document_name}

Content:
{context}

Create a clean formula sheet with this format for each formula:
**Formula Name**
Formula: [the equation]
Variables: [what each variable means]
Used for: [when to apply this formula]
---

If no formulas are found, list the key definitions and rules instead.
Group related formulas together.
Be thorough — include every equation and formula you find."""

    return generate_text(prompt)


def generate_subject_overview(documents: list, subject_name: str) -> str:
    """
    Generate an overview of an entire subject based on all its documents.
    """
    doc_names = [d.original_name for d in documents]
    summaries = [d.summary for d in documents if d.summary]

    prompt = f"""Generate a comprehensive study overview for the subject: {subject_name}

Documents in this subject:
{chr(10).join(f'- {name}' for name in doc_names)}

Based on these document summaries:
{chr(10).join(summaries[:3]) if summaries else 'No summaries available yet.'}

Create:
1. **Subject Overview** — What this subject covers
2. **Topic Roadmap** — Logical order to study the topics
3. **Exam Focus Areas** — Most commonly tested concepts
4. **Study Tips** — 3 specific tips for this subject

Keep it practical and exam-focused."""

    return generate_text(prompt)