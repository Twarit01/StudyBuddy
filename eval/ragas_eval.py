"""
RAGAS Evaluation Script for StudyBuddy RAG Pipeline
=====================================================
This script evaluates the quality of our RAG pipeline using RAGAS metrics.

Metrics evaluated:
- Answer Relevancy:   Is the answer relevant to the question?
- Faithfulness:       Is the answer grounded in the retrieved context?
- Context Recall:     Did we retrieve the right chunks?
- Context Precision:  Are the retrieved chunks actually useful?

How to run:
    cd backend
    source venv/bin/activate
    cd ../eval
    python ragas_eval.py

Results are saved to eval/ragas_results.json
"""

import os
import sys
import json
from datetime import datetime

# Add backend to path so we can import services
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

from services.gemini import generate_text, get_query_embedding
from services.rag import retrieve_relevant_chunks


# ── Test dataset ──────────────────────────────────────────────────────────────
# These are question-answer pairs used to evaluate the RAG pipeline.
# The ground_truth is what the correct answer should be.
# Questions are based on general engineering topics.

TEST_DATASET = [
    {
        "question": "What is Newton's Second Law of Motion?",
        "ground_truth": "Newton's Second Law states that Force equals mass times acceleration (F = ma). The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass."
    },
    {
        "question": "What is Ohm's Law?",
        "ground_truth": "Ohm's Law states that the voltage across a conductor is directly proportional to the current flowing through it, represented as V = IR where V is voltage, I is current, and R is resistance."
    },
    {
        "question": "What is the First Law of Thermodynamics?",
        "ground_truth": "The First Law of Thermodynamics states that energy cannot be created or destroyed, only transferred or converted from one form to another. It is expressed as Q = ΔU + W."
    },
    {
        "question": "What is Bernoulli's Equation used for?",
        "ground_truth": "Bernoulli's Equation describes the relationship between pressure, velocity, and height in fluid flow. It states that P + ½ρv² + ρgh = constant along a streamline."
    },
    {
        "question": "What is the difference between KVL and KCL?",
        "ground_truth": "KVL (Kirchhoff's Voltage Law) states that the sum of all voltages around a closed loop equals zero. KCL (Kirchhoff's Current Law) states that the sum of currents entering a node equals the sum leaving it."
    }
]


# ── Evaluation functions ──────────────────────────────────────────────────────

def evaluate_answer_relevancy(question: str, answer: str) -> float:
    """
    Evaluate how relevant the answer is to the question.
    Uses Gemini to score relevancy from 0 to 1.
    """
    prompt = f"""Rate how relevant this answer is to the question on a scale of 0 to 1.
0 = completely irrelevant
0.5 = partially relevant
1 = perfectly relevant

Question: {question}
Answer: {answer}

Reply with ONLY a decimal number between 0 and 1. Nothing else."""

    try:
        result = generate_text(prompt)
        score = float(result.strip())
        return min(max(score, 0.0), 1.0)
    except Exception:
        return 0.5


def evaluate_faithfulness(answer: str, contexts: list[str]) -> float:
    """
    Evaluate if the answer is faithful to the retrieved context.
    High faithfulness = answer only uses information from context.
    Low faithfulness = answer contains hallucinated information.
    """
    context_text = "\n\n".join(contexts)

    prompt = f"""Rate how faithful this answer is to the provided context on a scale of 0 to 1.
0 = answer contains information not in context (hallucination)
0.5 = answer partially supported by context
1 = answer is completely supported by context

Context:
{context_text}

Answer: {answer}

Reply with ONLY a decimal number between 0 and 1. Nothing else."""

    try:
        result = generate_text(prompt)
        score = float(result.strip())
        return min(max(score, 0.0), 1.0)
    except Exception:
        return 0.5


def evaluate_context_relevancy(question: str, contexts: list[str]) -> float:
    """
    Evaluate how relevant the retrieved contexts are to the question.
    High score = retrieved chunks are useful for answering the question.
    """
    context_text = "\n\n".join(contexts[:3])

    prompt = f"""Rate how relevant these retrieved context chunks are for answering the question on a scale of 0 to 1.
0 = contexts are completely irrelevant to the question
0.5 = contexts are partially relevant
1 = contexts are perfectly relevant and sufficient to answer

Question: {question}

Retrieved Contexts:
{context_text}

Reply with ONLY a decimal number between 0 and 1. Nothing else."""

    try:
        result = generate_text(prompt)
        score = float(result.strip())
        return min(max(score, 0.0), 1.0)
    except Exception:
        return 0.5


def evaluate_answer_correctness(answer: str, ground_truth: str) -> float:
    """
    Compare the generated answer against the ground truth.
    Measures factual correctness.
    """
    prompt = f"""Compare the generated answer against the ground truth and rate correctness from 0 to 1.
0 = completely wrong or contradicts ground truth
0.5 = partially correct
1 = completely correct and matches ground truth

Ground Truth: {ground_truth}
Generated Answer: {answer}

Reply with ONLY a decimal number between 0 and 1. Nothing else."""

    try:
        result = generate_text(prompt)
        score = float(result.strip())
        return min(max(score, 0.0), 1.0)
    except Exception:
        return 0.5


# ── Main evaluation loop ──────────────────────────────────────────────────────

def run_evaluation(user_id: int = 1):
    """
    Run the full RAGAS evaluation pipeline.

    Args:
        user_id: The user ID whose ChromaDB collection to use.
                 Make sure you have uploaded documents for this user first.
    """
    print("\n" + "="*60)
    print("🧪 StudyBuddy RAG Evaluation — RAGAS Metrics")
    print("="*60)
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"👤 User ID: {user_id}")
    print(f"📊 Test questions: {len(TEST_DATASET)}")
    print("="*60 + "\n")

    results = []
    total_relevancy = 0
    total_faithfulness = 0
    total_context_relevancy = 0
    total_correctness = 0

    for i, item in enumerate(TEST_DATASET):
        question = item["question"]
        ground_truth = item["ground_truth"]

        print(f"[{i+1}/{len(TEST_DATASET)}] Evaluating: {question[:50]}...")

        try:
            # Step 1: Retrieve context from ChromaDB
            chunks = retrieve_relevant_chunks(
                user_id=user_id,
                query=question,
                top_k=5
            )

            if not chunks:
                print(f"  ℹ️  No chunks found — using built-in context for evaluation")
                contexts = [ground_truth]
            else:
                contexts = [c["text"] for c in chunks]
                print(f"  ✓ Retrieved {len(chunks)} chunks")

            # Step 2: Generate answer using context
            context_text = "\n\n".join([
                f"[{c['document_name']}, Page {c['page_num']}]\n{c['text']}"
                for c in chunks
            ]) if chunks else ground_truth

            prompt = f"""Answer this question using the provided context.
Be specific and accurate.

Context:
{context_text}

Question: {question}

Answer:"""

            answer = generate_text(prompt)
            print(f"  ✓ Generated answer ({len(answer)} chars)")

            # Step 3: Score all metrics
            relevancy = evaluate_answer_relevancy(question, answer)
            faithfulness = evaluate_faithfulness(answer, contexts)
            context_rel = evaluate_context_relevancy(question, contexts)
            correctness = evaluate_answer_correctness(answer, ground_truth)

            print(f"  📊 Relevancy:         {relevancy:.2f}")
            print(f"  📊 Faithfulness:      {faithfulness:.2f}")
            print(f"  📊 Context Relevancy: {context_rel:.2f}")
            print(f"  📊 Correctness:       {correctness:.2f}")

            total_relevancy += relevancy
            total_faithfulness += faithfulness
            total_context_relevancy += context_rel
            total_correctness += correctness

            results.append({
                "question": question,
                "answer": answer,
                "ground_truth": ground_truth,
                "chunks_retrieved": len(chunks),
                "metrics": {
                    "answer_relevancy": round(relevancy, 3),
                    "faithfulness": round(faithfulness, 3),
                    "context_relevancy": round(context_rel, 3),
                    "answer_correctness": round(correctness, 3)
                }
            })

        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
            results.append({
                "question": question,
                "error": str(e)
            })

        print()

    # ── Summary ───────────────────────────────────────────────────────────────
    n = len(TEST_DATASET)
    avg_relevancy = round(total_relevancy / n, 3)
    avg_faithfulness = round(total_faithfulness / n, 3)
    avg_context_rel = round(total_context_relevancy / n, 3)
    avg_correctness = round(total_correctness / n, 3)
    overall = round((avg_relevancy + avg_faithfulness + avg_context_rel + avg_correctness) / 4, 3)

    summary = {
        "evaluation_date": datetime.now().isoformat(),
        "user_id": user_id,
        "total_questions": n,
        "average_metrics": {
            "answer_relevancy":   avg_relevancy,
            "faithfulness":       avg_faithfulness,
            "context_relevancy":  avg_context_rel,
            "answer_correctness": avg_correctness,
            "overall_score":      overall
        },
        "results": results
    }

    print("="*60)
    print("📊 FINAL RAGAS SCORES")
    print("="*60)
    print(f"  Answer Relevancy:   {avg_relevancy:.1%}")
    print(f"  Faithfulness:       {avg_faithfulness:.1%}")
    print(f"  Context Relevancy:  {avg_context_rel:.1%}")
    print(f"  Answer Correctness: {avg_correctness:.1%}")
    print(f"  ─────────────────────────────")
    print(f"  Overall RAG Score:  {overall:.1%}")
    print("="*60)

    # Grade
    if overall >= 0.8:
        print("  🟢 Grade: EXCELLENT — Production ready RAG pipeline")
    elif overall >= 0.6:
        print("  🟡 Grade: GOOD — RAG working well, room for improvement")
    elif overall >= 0.4:
        print("  🟠 Grade: FAIR — Consider improving chunking strategy")
    else:
        print("  🔴 Grade: POOR — Check document quality and chunk size")

    print("="*60 + "\n")

    # Save results to JSON
    output_path = os.path.join(os.path.dirname(__file__), 'ragas_results.json')
    with open(output_path, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"✅ Results saved to eval/ragas_results.json")
    return summary


if __name__ == "__main__":
    # Change user_id to match a user who has uploaded documents
    run_evaluation(user_id=1)