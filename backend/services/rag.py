import json
import chromadb
from chromadb.config import Settings as ChromaSettings
from services.gemini import get_embedding, get_query_embedding
from core.config import settings


# ── ChromaDB client ───────────────────────────────────────────────────────────

def get_chroma_client():
    """
    Returns a persistent ChromaDB client.
    Data saved to disk at CHROMA_PERSIST_PATH.
    """
    return chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_PATH,
        settings=ChromaSettings(anonymized_telemetry=False)
    )


def get_user_collection(user_id: int):
    """
    Each user gets their own ChromaDB collection.
    This is how we isolate one user's documents from another's.
    Collection name: user_1, user_2, etc.
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=f"user_{user_id}",
        metadata={"hnsw:space": "cosine"}  # cosine similarity for text
    )
    return collection


# ── Store chunks ──────────────────────────────────────────────────────────────

def store_document_chunks(
    user_id: int,
    document_id: int,
    document_name: str,
    chunks: list[dict]
) -> int:
    """
    Embed each chunk and store in ChromaDB.
    Returns number of chunks stored.
    """
    collection = get_user_collection(user_id)

    ids = []
    embeddings = []
    documents = []
    metadatas = []

    for chunk in chunks:
        embedding = get_embedding(chunk["text"])

        ids.append(f"doc_{document_id}_{chunk['chunk_id']}")
        embeddings.append(embedding)
        documents.append(chunk["text"])
        metadatas.append({
            "document_id": document_id,
            "document_name": document_name,
            "page_num": chunk["page_num"],
            "chunk_index": chunk["chunk_index"]
        })

    # Store in batches of 50 to avoid memory issues
    batch_size = 50
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i:i + batch_size],
            embeddings=embeddings[i:i + batch_size],
            documents=documents[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size]
        )

    return len(chunks)


# ── Retrieve chunks ───────────────────────────────────────────────────────────

def retrieve_relevant_chunks(
    user_id: int,
    query: str,
    top_k: int = 5,
    document_id: int = None
) -> list[dict]:
    """
    Find the most relevant chunks for a user query.
    Optionally filter by a specific document.

    Returns list of:
    {
        text, document_name, page_num,
        chunk_index, similarity_score
    }
    """
    collection = get_user_collection(user_id)

    # Check collection has documents
    if collection.count() == 0:
        return []

    query_embedding = get_query_embedding(query)

    # Build filter if specific document requested
    where_filter = None
    if document_id:
        where_filter = {"document_id": document_id}

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"]
    )

    chunks = []
    for i in range(len(results["documents"][0])):
        # Convert distance to similarity score (cosine: lower = more similar)
        distance = results["distances"][0][i]
        similarity = round(1 - distance, 3)

        chunks.append({
            "text": results["documents"][0][i],
            "document_id": results["metadatas"][0][i].get("document_id"),
            "document_name": results["metadatas"][0][i]["document_name"],
            "page_num": results["metadatas"][0][i]["page_num"],
            "chunk_index": results["metadatas"][0][i]["chunk_index"],
            "similarity_score": similarity
        })

    # Sort by similarity descending
    chunks.sort(key=lambda x: x["similarity_score"], reverse=True)
    return chunks


# ── Delete document chunks ────────────────────────────────────────────────────

def delete_document_chunks(user_id: int, document_id: int):
    """
    Remove all chunks for a document from ChromaDB.
    Called when user deletes a document.
    """
    collection = get_user_collection(user_id)

    collection.delete(
        where={"document_id": document_id}
    )


# ── Build RAG prompt ──────────────────────────────────────────────────────────

def build_rag_prompt(query: str, chunks: list[dict]) -> tuple[str, list[str]]:
    """
    Build the prompt that gets sent to Gemini.
    Injects retrieved chunks as context.

    Returns (full_prompt, list_of_context_texts)
    """
    if not chunks:
        return (
            f"The student asked: {query}\n\n"
            "No study material has been uploaded yet. "
            "Answer from your general engineering knowledge and mention "
            "that uploading study material will give more specific answers.",
            []
        )

    # Format each chunk with source info
    context_parts = []
    context_texts = []

    for i, chunk in enumerate(chunks):
        source_info = f"[Source: {chunk['document_name']}, Page {chunk['page_num']}]"
        context_parts.append(f"{source_info}\n{chunk['text']}")
        context_texts.append(chunk["text"])

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""Use the following context from the student's study materials to answer the question.
Always mention which document and page your answer comes from.
If the context does not contain enough information, say so clearly.

CONTEXT:
{context}

STUDENT QUESTION:
{query}

ANSWER:"""

    return prompt, context_texts