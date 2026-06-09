from datetime import datetime
from services.gemini import generate_text
from services.flashcard_generator import get_due_cards_count


# ── Weak topic detection ──────────────────────────────────────────────────────

def get_weak_topics(quiz_attempts: list) -> list[dict]:
    """
    Analyse all quiz attempts and find topics below 60% accuracy.
    Returns list of weak topics sorted by score ascending.
    """
    topic_scores = {}

    for attempt in quiz_attempts:
        topic = attempt.topic or "General"
        if topic not in topic_scores:
            topic_scores[topic] = {"correct": 0, "total": 0}

        topic_scores[topic]["total"] += attempt.total_questions
        topic_scores[topic]["correct"] += attempt.correct_answers

    weak_topics = []
    for topic, scores in topic_scores.items():
        if scores["total"] == 0:
            continue
        accuracy = round((scores["correct"] / scores["total"]) * 100, 1)
        weak_topics.append({
            "topic": topic,
            "accuracy": accuracy,
            "total_questions": scores["total"],
            "correct": scores["correct"],
            "is_weak": accuracy < 60
        })

    # Sort weakest first
    weak_topics.sort(key=lambda x: x["accuracy"])
    return weak_topics


def get_all_topic_stats(quiz_attempts: list) -> list[dict]:
    """
    Returns accuracy stats for ALL topics — used in progress dashboard.
    """
    return get_weak_topics(quiz_attempts)


# ── Study streak ──────────────────────────────────────────────────────────────

def calculate_streak(quiz_attempts: list, chat_messages: list) -> int:
    """
    Calculate current study streak in days.
    A day counts if the user asked a question or took a quiz.
    """
    active_dates = set()

    for attempt in quiz_attempts:
        active_dates.add(attempt.created_at.date())

    for message in chat_messages:
        active_dates.add(message.created_at.date())

    if not active_dates:
        return 0

    streak = 0
    today = datetime.utcnow().date()
    check_date = today

    while check_date in active_dates:
        streak += 1
        check_date = check_date.replace(day=check_date.day - 1)

    return streak


# ── Activity heatmap ──────────────────────────────────────────────────────────

def get_activity_heatmap(quiz_attempts: list, chat_messages: list) -> dict:
    """
    Build activity data for the GitHub-style heatmap.
    Returns dict of {date_string: activity_count}
    """
    activity = {}

    for attempt in quiz_attempts:
        date_str = attempt.created_at.strftime("%Y-%m-%d")
        activity[date_str] = activity.get(date_str, 0) + 1

    for message in chat_messages:
        if message.role == "user":
            date_str = message.created_at.strftime("%Y-%m-%d")
            activity[date_str] = activity.get(date_str, 0) + 1

    return activity


# ── AI study plan ─────────────────────────────────────────────────────────────

def generate_study_plan(
    weak_topics: list[dict],
    due_cards_count: int,
    available_hours: float = 2.0
) -> str:
    """
    Use Gemini to generate a personalized daily study plan
    based on weak topics and due flashcards.
    """
    if not weak_topics and due_cards_count == 0:
        return (
            "Great job! No weak topics detected and no flashcards due today. "
            "Consider uploading new study material or taking a quiz on a new topic."
        )

    weak_list = "\n".join([
        f"- {t['topic']}: {t['accuracy']}% accuracy ({t['total_questions']} questions attempted)"
        for t in weak_topics if t["is_weak"]
    ])

    if not weak_list:
        weak_list = "No weak topics — all topics above 60% accuracy."

    prompt = f"""Create a focused daily study plan for an engineering student.

WEAK TOPICS (below 60% accuracy):
{weak_list}

FLASHCARDS DUE TODAY: {due_cards_count} cards

AVAILABLE STUDY TIME: {available_hours} hours

Create a practical, time-blocked study plan. Be specific about:
- Which topic to study first and why
- How long to spend on each topic
- Whether to use Q&A chat, quiz, or flashcards for each topic
- One specific tip for each weak topic

Keep it motivating but realistic. Format with clear time blocks."""

    return generate_text(prompt)


# ── Summary stats ─────────────────────────────────────────────────────────────

def get_progress_summary(
    quiz_attempts: list,
    flashcards: list,
    chat_messages: list,
    documents: list
) -> dict:
    """
    Build the full progress summary for the dashboard.
    """
    total_quizzes = len(quiz_attempts)
    avg_score = 0.0

    if total_quizzes > 0:
        avg_score = round(
            sum(a.score_percentage for a in quiz_attempts) / total_quizzes, 1
        )

    due_cards = get_due_cards_count(flashcards)
    streak = calculate_streak(quiz_attempts, chat_messages)
    weak_topics = get_weak_topics(quiz_attempts)
    activity = get_activity_heatmap(quiz_attempts, chat_messages)

    return {
        "total_documents": len(documents),
        "total_quizzes": total_quizzes,
        "average_score": avg_score,
        "total_flashcards": len(flashcards),
        "due_cards_today": due_cards,
        "study_streak": streak,
        "weak_topics": [t for t in weak_topics if t["is_weak"]],
        "all_topics": weak_topics,
        "activity_heatmap": activity,
        "total_questions_asked": len([m for m in chat_messages if m.role == "user"])
    }