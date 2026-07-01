"""
XP & Gamification Service
Handles awarding XP, calculating levels, and tracking streaks.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.user import User
from models.xp_event import XPEvent


# ── XP reward table ──────────────────────────────────────────────
XP_REWARDS = {
    "quiz_completed":       50,
    "quiz_perfect_score":   100,   # bonus on top of quiz_completed
    "quiz_good_score":      25,    # bonus for 80%+
    "flashcard_reviewed":   5,
    "flashcard_mastered":   15,    # bonus when card hits interval >= 21 days
    "document_uploaded":    30,
    "chat_question_asked":  3,
    "streak_maintained":    20,    # awarded once per day when streak continues
    "streak_milestone_7":   200,
    "streak_milestone_30":  1000,
    "first_action_bonus":   50,    # first ever quiz/flashcard/chat
}

XP_LABELS = {
    "quiz_completed":       "Completed a quiz",
    "quiz_perfect_score":   "Perfect score bonus",
    "quiz_good_score":      "Great score bonus (80%+)",
    "flashcard_reviewed":   "Reviewed a flashcard",
    "flashcard_mastered":   "Mastered a flashcard",
    "document_uploaded":    "Uploaded a document",
    "chat_question_asked":  "Asked the AI a question",
    "streak_maintained":    "Daily streak maintained",
    "streak_milestone_7":   "7-day streak milestone",
    "streak_milestone_30":  "30-day streak milestone",
    "first_action_bonus":   "First-time bonus",
}


def xp_for_level(level: int) -> int:
    """
    XP required to COMPLETE this level (i.e. threshold to reach next level).
    Uses a smooth increasing curve: level n needs n * 300 XP cumulative-ish.
    Level 1 -> 2:  300 XP
    Level 2 -> 3:  650 XP  (cumulative)
    Formula: threshold(level) = 300 * level + 50 * level^2  (approx RPG curve)
    """
    return 300 * level + 50 * (level ** 2)


def calculate_level(total_xp: int) -> tuple[int, int, int]:
    """
    Given total XP, returns (level, xp_into_current_level, xp_needed_for_next_level).
    """
    level = 1
    cumulative = 0
    while True:
        needed = xp_for_level(level)
        if cumulative + needed > total_xp:
            xp_into_level = total_xp - cumulative
            return level, xp_into_level, needed
        cumulative += needed
        level += 1
        if level > 200:  # safety cap
            return level, 0, xp_for_level(level)


def award_xp(db: Session, user: User, reason: str, custom_amount: int = None) -> dict:
    """
    Awards XP to a user for a given reason, logs the event, updates level.
    Returns a dict describing what happened (for frontend toast notifications).
    """
    amount = custom_amount if custom_amount is not None else XP_REWARDS.get(reason, 0)
    if amount <= 0:
        return {"awarded": 0, "reason": reason, "leveled_up": False}

    label = XP_LABELS.get(reason, reason.replace("_", " ").title())

    old_level, _, _ = calculate_level(user.total_xp)

    user.total_xp = (user.total_xp or 0) + amount
    new_level, xp_into_level, xp_needed = calculate_level(user.total_xp)
    user.level = new_level

    event = XPEvent(
        owner_id=user.id,
        amount=amount,
        reason=reason,
        label=label,
    )
    db.add(event)
    db.commit()
    db.refresh(user)

    return {
        "awarded": amount,
        "reason": reason,
        "label": label,
        "total_xp": user.total_xp,
        "level": new_level,
        "xp_into_level": xp_into_level,
        "xp_needed_for_next": xp_needed,
        "leveled_up": new_level > old_level,
    }


def update_streak(db: Session, user: User) -> dict:
    """
    Call this once per "study action" (quiz, flashcard review, chat, upload).
    Updates the user's daily streak and awards streak XP if this is a new day.
    Returns info about streak status.
    """
    today = datetime.utcnow().date()
    last = user.last_activity_date.date() if user.last_activity_date else None

    streak_events = []

    if last == today:
        # Already active today — no streak change, no duplicate XP
        pass
    elif last == today - timedelta(days=1):
        # Consecutive day — streak continues
        user.current_streak = (user.current_streak or 0) + 1
        user.longest_streak = max(user.longest_streak or 0, user.current_streak)
        user.last_activity_date = datetime.utcnow()
        db.commit()

        streak_events.append(award_xp(db, user, "streak_maintained"))

        if user.current_streak == 7:
            streak_events.append(award_xp(db, user, "streak_milestone_7"))
        elif user.current_streak == 30:
            streak_events.append(award_xp(db, user, "streak_milestone_30"))
    else:
        # Streak broken or first ever activity — reset to 1
        user.current_streak = 1
        user.longest_streak = max(user.longest_streak or 0, 1)
        user.last_activity_date = datetime.utcnow()
        db.commit()

    return {
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "xp_events": streak_events,
    }


def get_xp_summary(db: Session, user: User) -> dict:
    """Returns full XP/level/streak summary for dashboard display."""
    level, xp_into_level, xp_needed = calculate_level(user.total_xp or 0)
    recent_events = (
        db.query(XPEvent)
        .filter(XPEvent.owner_id == user.id)
        .order_by(XPEvent.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "total_xp": user.total_xp or 0,
        "level": level,
        "xp_into_level": xp_into_level,
        "xp_needed_for_next": xp_needed,
        "xp_progress_pct": round((xp_into_level / xp_needed) * 100, 1) if xp_needed else 0,
        "current_streak": user.current_streak or 0,
        "longest_streak": user.longest_streak or 0,
        "recent_events": [
            {
                "id": e.id,
                "amount": e.amount,
                "reason": e.reason,
                "label": e.label,
                "created_at": e.created_at,
            }
            for e in recent_events
        ],
    }