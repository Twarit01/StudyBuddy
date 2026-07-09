import json
import logging
from typing import Optional

from services.gemini import generate_text

logger = logging.getLogger(__name__)

MINDMAP_PROMPT = """\
You are an AI that extracts key concepts and relationships from study material.

Analyze the following text from the document "{document_name}" and extract:
1. The most important concepts/topics (aim for 8-15 nodes)
2. The meaningful relationships between those concepts

Return ONLY a valid JSON object with EXACTLY this structure — no other text:
{{
  "nodes": [
    {{
      "id": "unique_snake_case_id",
      "label": "Short Concept Name",
      "description": "2-3 sentence explanation of this concept.",
      "page": <integer — page number where concept first appears>,
      "document": "{document_name}"
    }}
  ],
  "edges": [
    {{
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "short relationship (e.g. requires, leads to, part of, uses, causes, enables)"
    }}
  ]
}}

Rules:
- Node IDs must be unique snake_case strings, no spaces
- Every edge source and target must exactly match a node id
- Aim for 8-15 nodes and 8-20 edges
- Keep concept labels short (2-5 words max)
- Descriptions must be informative but concise
- Page numbers must be realistic integers based on the text

TEXT TO ANALYZE (from "{document_name}"):
{text}

Return ONLY the JSON object. No markdown fences, no preamble, no explanation.\
"""


def generate_mindmap(documents: list[dict]) -> dict:
    """
    Generate a concept mind map from one or more documents.

    Args:
        documents: List of dicts:
            {
                'id':        int,
                'name':      str,
                'file_type': str,
                'pages':     list of {'page_num': int, 'text': str}
            }

    Returns:
        {'nodes': [...], 'edges': [...]}
    """
    all_nodes: list[dict] = []
    all_edges: list[dict] = []
    seen_ids: set[str] = set()

    for doc in documents:
        doc_name  = doc["name"]
        doc_id    = doc["id"]

        # Build full text with page markers (cap at ~6 000 chars to fit token limits)
        full_text = "\n\n".join(
            f"[Page {p['page_num']}]\n{p['text']}"
            for p in doc["pages"]
        )
        if len(full_text) > 6000:
            full_text = full_text[:6000] + "\n...[text truncated for length]"

        prompt = MINDMAP_PROMPT.format(
            document_name=doc_name,
            text=full_text,
        )

        try:
            raw = generate_text(prompt)
            graph = _parse_json(raw)
        except Exception as exc:
            logger.warning("Mind map generation failed for '%s': %s", doc_name, exc)
            continue  # skip this doc, keep going

        # Prefix all node IDs with doc ID to avoid collisions across documents
        id_map: dict[str, str] = {}
        prefix = f"d{doc_id}_"

        for node in graph.get("nodes", []):
            old_id = str(node.get("id", ""))
            new_id = prefix + old_id
            # Disambiguate if somehow still clashes
            suffix = 0
            candidate = new_id
            while candidate in seen_ids:
                suffix += 1
                candidate = f"{new_id}_{suffix}"
            new_id = candidate
            seen_ids.add(new_id)
            id_map[old_id] = new_id

            all_nodes.append({
                "id":          new_id,
                "label":       node.get("label", old_id),
                "description": node.get("description", ""),
                "page":        int(node.get("page", 1)),
                "document":    node.get("document", doc_name),
                "doc_id":      doc_id,
            })

        for edge in graph.get("edges", []):
            src = id_map.get(str(edge.get("source", "")))
            tgt = id_map.get(str(edge.get("target", "")))
            if src and tgt and src != tgt:
                all_edges.append({
                    "source": src,
                    "target": tgt,
                    "label":  edge.get("label", "related to"),
                })

    # Cross-document connections: link nodes whose labels share significant words
    if len(documents) > 1:
        all_edges.extend(_cross_doc_edges(all_nodes))

    return {"nodes": all_nodes, "edges": all_edges}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict:
    """Parse JSON from a Gemini response, stripping any markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove opening fence (```json or ```) and closing fence
        text = "\n".join(
            lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        )
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Last resort: find the outermost { … }
        start = text.find("{")
        end   = text.rfind("}") + 1
        if 0 <= start < end:
            return json.loads(text[start:end])
        raise ValueError("No valid JSON found in model response")


_STOP_WORDS = frozenset({
    "the", "a", "an", "of", "in", "and", "or", "is", "are",
    "to", "for", "by", "on", "with", "at", "from",
})


def _cross_doc_edges(nodes: list[dict]) -> list[dict]:
    """
    Connect concepts across different documents when their labels share
    significant words. Uses a simple word-overlap heuristic.
    """
    edges: list[dict] = []
    added: set[tuple] = set()

    for i, a in enumerate(nodes):
        for b in nodes[i + 1:]:
            if a["doc_id"] == b["doc_id"]:
                continue
            words_a = {w.lower() for w in a["label"].split()} - _STOP_WORDS
            words_b = {w.lower() for w in b["label"].split()} - _STOP_WORDS
            if words_a and words_b and (words_a & words_b):
                key = tuple(sorted([a["id"], b["id"]]))
                if key not in added:
                    added.add(key)
                    edges.append({
                        "source": a["id"],
                        "target": b["id"],
                        "label":  "also covered in",
                    })
    return edges
