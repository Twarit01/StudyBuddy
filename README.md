# 🧠 StudyBuddy AI — AI-Powered Study Assistant for Engineering Students

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-orange?style=flat-square&logo=google)
![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-purple?style=flat-square)

> An intelligent study companion that transforms your lecture notes and textbooks into an interactive learning experience — powered by RAG, spaced repetition, and Gemini AI.

---

## 🎯 Problem Statement

Engineering students struggle to extract clear understanding from dense textbooks and lecture notes. Passive reading yields poor retention, and private tutoring is inaccessible to most. StudyBuddy solves this by building a personalized AI knowledge base from your own study materials.

---

## ✨ Features

### 📄 Document Ingestion
- Upload PDF, DOCX, and TXT files
- Semantic chunking with 512-token chunks and 64-token overlap
- Gemini embeddings stored in ChromaDB vector database
- Per-user isolated knowledge base

### 💬 RAG-Powered Q&A Chat
- Ask questions grounded strictly in your uploaded material
- Source citations with document name and page number
- Confidence indicator (High / Medium / Low)
- Conversation memory across messages
- LaTeX formula rendering for engineering equations

### 📝 Quiz Generator
- Three question types: MCQ, Short Answer, Formula Recall
- Three difficulty levels: Easy, Medium, Hard
- AI evaluates short answer responses with detailed feedback
- Per-topic score tracking feeds the progress dashboard

### 🃏 Flashcard System
- AI-generated flashcards from your study material
- SM-2 spaced repetition algorithm (same as Anki)
- Cards scheduled based on your performance
- Due-today queue for daily review habit

### 📊 Progress Dashboard
- Topic performance bar chart
- Weak topic detection (below 60% accuracy)
- Study streak tracker
- Activity heatmap (last 30 days)
- Flashcard breakdown (mastered / learning / new / due)

---

## 🏗️ Architecture

**Frontend** → React + Vite + Tailwind + Recharts + KaTeX

↕ REST API

**Backend** → FastAPI + Python 3.11
- Auth / JWT
- RAG Engine
- Quiz & Flashcard Generator
- Study Planner

↕ Gemini API

**AI Layer** → Gemini 2.5 Flash
- Text Generation
- Embeddings (text-embedding-004)

↕ Storage

**Vector DB** → ChromaDB (per-user isolated collections)

**Relational DB** → SQLite → Users, Documents, Quizzes, Flashcards, Chat History

---

## 🔄 RAG Pipeline

**Step 1 — Ingest**
Upload PDF / DOCX / TXT → PyMuPDF extracts text page by page

**Step 2 — Chunk**
Text split into 512-token chunks with 64-token overlap to preserve context

**Step 3 — Embed**
Gemini text-embedding-004 converts each chunk to a vector

**Step 4 — Store**
Vectors stored in ChromaDB with document name and page metadata

**Step 5 — Retrieve**
User question embedded → Top-5 most similar chunks fetched by cosine similarity

**Step 6 — Generate**
Gemini 2.5 Flash generates answer using retrieved chunks as context

**Step 7 — Cite**
Response includes source document, page number, and confidence score

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| LLM | Gemini 2.5 Flash |
| Embeddings | Gemini text-embedding-004 |
| Vector DB | ChromaDB |
| RAG Framework | LangChain |
| Backend | FastAPI + Python 3.11 |
| Database | SQLite + SQLAlchemy |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Auth | JWT + bcrypt |
| PDF Parsing | PyMuPDF |
| Spaced Repetition | SM-2 Algorithm |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Clone the repository
```bash
git clone https://github.com/Twarit01/StudyBuddy.git
cd StudyBuddy
```

### 2. Backend setup
```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install "pydantic[email]"

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Frontend setup
```bash
cd frontend
npm install
```

### 4. Run the application

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Open in browser
http://localhost:5173

---

## 📁 Project Structure

StudyBuddy/
├── backend/
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── auth.py
│   │   └── dependencies.py
│   ├── models/
│   │   ├── user.py
│   │   ├── document.py
│   │   ├── chat_session.py
│   │   ├── quiz_attempt.py
│   │   └── flashcard.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── documents.py
│   │   ├── chat.py
│   │   ├── quiz.py
│   │   └── flashcards.py
│   ├── services/
│   │   ├── gemini.py
│   │   ├── rag.py
│   │   ├── document_processor.py
│   │   ├── quiz_generator.py
│   │   ├── flashcard_generator.py
│   │   └── study_planner.py
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Chat.jsx
│       │   ├── Quiz.jsx
│       │   ├── Flashcards.jsx
│       │   └── Progress.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── FileUpload.jsx
│       │   ├── SourceCitation.jsx
│       │   └── ProtectedRoute.jsx
│       ├── api/
│       ├── context/
│       └── hooks/
├── eval/
│   └── ragas_eval.py
└── README.md

---

## 🔑 Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL=sqlite:///./studybuddy.db
CHROMA_PERSIST_PATH=./vector_store
UPLOAD_DIR=./uploads
ALLOWED_EXTENSIONS=pdf,docx,txt
MAX_FILE_SIZE_MB=50
```

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/documents/upload` | Upload study material |
| GET | `/api/documents/` | List documents |
| POST | `/api/chat/ask` | Ask a question |
| GET | `/api/chat/sessions` | Get chat history |
| POST | `/api/quiz/generate` | Generate quiz |
| POST | `/api/quiz/submit` | Submit quiz results |
| POST | `/api/flashcards/generate` | Generate flashcards |
| POST | `/api/flashcards/{id}/review` | Submit SM-2 review |
| GET | `/api/flashcards/stats` | Get flashcard stats |

Full interactive API docs available at `http://localhost:8000/docs`

---

## 📈 Spaced Repetition — SM-2 Algorithm

Flashcards use the SM-2 algorithm — the same algorithm used by Anki:

| Quality | Meaning | Result |
|---|---|---|
| 0 | Complete blackout | Reset — review tomorrow |
| 1 | Wrong but recognized | Reset — review tomorrow |
| 2 | Wrong but easy recall | Reset — review soon |
| 3 | Correct with effort | Interval increases slowly |
| 4 | Correct with hesitation | Interval increases |
| 5 | Perfect recall | Long interval, high ease factor |

Ease factor never drops below 1.3. Due cards shown on dashboard daily.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👨‍💻 Author

**Twarit** — [@Twarit01](https://github.com/Twarit01)

---

## ⭐ If this project helped you, give it a star on GitHub!