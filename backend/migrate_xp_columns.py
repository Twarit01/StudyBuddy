"""
One-time migration script to add XP columns to an existing users table
without losing any data. Run this from your backend/ directory:

    python migrate_xp_columns.py

Safe to run multiple times — it checks if columns already exist first.
"""
import sqlite3

DB_PATH = "studybuddy.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(users)")
existing_columns = {row[1] for row in cursor.fetchall()}

migrations = [
    ("total_xp", "INTEGER DEFAULT 0 NOT NULL"),
    ("level", "INTEGER DEFAULT 1 NOT NULL"),
    ("current_streak", "INTEGER DEFAULT 0 NOT NULL"),
    ("longest_streak", "INTEGER DEFAULT 0 NOT NULL"),
    ("last_activity_date", "DATETIME"),
]

for col_name, col_def in migrations:
    if col_name in existing_columns:
        print(f"⏭  Column '{col_name}' already exists — skipping")
        continue
    sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"
    cursor.execute(sql)
    print(f"✅ Added column '{col_name}'")

# Also create the xp_events table if it doesn't exist yet
cursor.execute("""
CREATE TABLE IF NOT EXISTS xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    created_at DATETIME,
    FOREIGN KEY(owner_id) REFERENCES users(id)
)
""")
print("✅ Ensured xp_events table exists")

conn.commit()
conn.close()
print("\n🎉 Migration complete! Your existing users and data are safe.")