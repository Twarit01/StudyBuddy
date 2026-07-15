import os
import uuid
import tempfile
import urllib.request
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from pathlib import Path
import cloudinary
import cloudinary.uploader
from core.config import settings, ALLOWED_EXTENSIONS_LIST, MAX_FILE_SIZE_BYTES

# ── Cloudinary setup ──────────────────────────────────────────────────────────

def _is_cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )

if _is_cloudinary_configured():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_to_cloudinary(file_bytes: bytes, original_filename: str) -> str | None:
    """
    Upload raw file bytes to Cloudinary.
    Returns the secure URL on success, or None if Cloudinary is not configured.
    """
    if not _is_cloudinary_configured():
        return None

    ext = original_filename.rsplit(".", 1)[-1].lower()
    public_id = f"studybuddy/{uuid.uuid4().hex}"

    # Write bytes to a temp file so Cloudinary SDK can stream it
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = cloudinary.uploader.upload(
            tmp_path,
            public_id=public_id,
            resource_type="raw",   # preserve original file format
            overwrite=True,
        )
        return result["secure_url"]
    finally:
        os.unlink(tmp_path)   # always clean up temp file


def download_file_from_url(url: str, ext: str) -> str:
    """
    Download a file from a URL (e.g. Cloudinary) to a temp path.
    Returns the temp file path — caller is responsible for deleting it.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
    tmp.close()
    urllib.request.urlretrieve(url, tmp.name)
    return tmp.name


# ── File validation ───────────────────────────────────────────────────────────

def validate_file(filename: str, file_size: int) -> tuple[bool, str]:
    """
    Check file is allowed type and within size limit.
    Returns (is_valid, error_message)
    """
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext not in ALLOWED_EXTENSIONS_LIST:
        return False, f"File type '.{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS_LIST)}"

    if file_size > MAX_FILE_SIZE_BYTES:
        return False, f"File too large. Max size is {settings.MAX_FILE_SIZE_MB}MB"

    return True, ""


# ── File saving ───────────────────────────────────────────────────────────────

def save_uploaded_file(file_bytes: bytes, original_filename: str) -> tuple[str, str]:
    """
    Save uploaded file to disk with a unique name.
    Returns (saved_filename, full_path)
    """
    ext = original_filename.rsplit(".", 1)[-1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    full_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(full_path, "wb") as f:
        f.write(file_bytes)

    return unique_filename, full_path


# ── Text extraction ───────────────────────────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Extract text from each page of a PDF.
    Returns list of {page_num, text} dicts.
    """
    pages = []
    doc = fitz.open(file_path)

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()

        if text:  # skip empty pages
            pages.append({
                "page_num": page_num + 1,
                "text": text
            })

    doc.close()
    return pages


def extract_text_from_docx(file_path: str) -> list[dict]:
    """
    Extract text from a Word document paragraph by paragraph.
    Groups paragraphs into page-like chunks of ~3000 characters.
    Returns list of {page_num, text} dicts.
    """
    doc = DocxDocument(file_path)
    pages = []
    current_text = ""
    page_num = 1

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        current_text += text + "\n"

        # Group into ~3000 char chunks to simulate pages
        if len(current_text) >= 3000:
            pages.append({
                "page_num": page_num,
                "text": current_text.strip()
            })
            current_text = ""
            page_num += 1

    # Append any remaining text
    if current_text.strip():
        pages.append({
            "page_num": page_num,
            "text": current_text.strip()
        })

    return pages


def extract_text_from_txt(file_path: str) -> list[dict]:
    """
    Extract text from a plain text file.
    Splits into ~3000 character chunks.
    """
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        full_text = f.read()

    pages = []
    chunk_size = 3000
    page_num = 1

    for i in range(0, len(full_text), chunk_size):
        chunk = full_text[i:i + chunk_size].strip()
        if chunk:
            pages.append({
                "page_num": page_num,
                "text": chunk
            })
            page_num += 1

    return pages


def extract_text(file_path: str, file_type: str) -> list[dict]:
    """
    Main entry point — routes to correct extractor based on file type.
    Returns list of {page_num, text} dicts.
    """
    if file_type == "pdf":
        return extract_text_from_pdf(file_path)
    elif file_type == "docx":
        return extract_text_from_docx(file_path)
    elif file_type == "txt":
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(pages: list[dict], chunk_size: int = 512, overlap: int = 64) -> list[dict]:
    """
    Split page text into overlapping chunks for better RAG retrieval.

    Why overlap? If an answer spans a chunk boundary, overlap ensures
    context isn't lost between chunks.

    Returns list of:
    {
        chunk_id: str,
        text: str,
        page_num: int,
        chunk_index: int
    }
    """
    chunks = []
    chunk_index = 0

    for page in pages:
        text = page["text"]
        page_num = page["page_num"]
        words = text.split()

        i = 0
        while i < len(words):
            # Take chunk_size words
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)

            if chunk_text.strip():
                chunks.append({
                    "chunk_id": f"chunk_{chunk_index}_{uuid.uuid4().hex[:8]}",
                    "text": chunk_text,
                    "page_num": page_num,
                    "chunk_index": chunk_index
                })
                chunk_index += 1

            # Move forward by chunk_size minus overlap
            i += chunk_size - overlap

    return chunks


# ── Full pipeline ─────────────────────────────────────────────────────────────

def process_document(file_path: str, file_type: str) -> list[dict]:
    """
    Full pipeline: extract text → chunk it.
    Returns list of chunks ready for embedding.
    """
    pages = extract_text(file_path, file_type)
    chunks = chunk_text(pages)
    return chunks