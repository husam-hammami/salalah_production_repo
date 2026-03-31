"""
Database migration script — runs on container startup before the app.
Adds order_start_time and order_end_time columns to MIL-A tables
for accurate job order timing. Safe to run multiple times (idempotent).
"""
import os
import sys
import time
import psycopg2

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_NAME = 'Dynamic_DB_Hercules'
DB_USER = 'postgres'
DB_PASS = 'trust'
DB_PORT = 5432

MAX_RETRIES = 10
RETRY_DELAY = 3

MIGRATIONS = [
    {
        "id": "001_mila_order_times",
        "description": "Add order_start_time and order_end_time to MIL-A tables",
        "statements": [
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
        ],
    },
]


def wait_for_db():
    """Wait for PostgreSQL to be ready, retrying with backoff."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            conn = psycopg2.connect(
                host=DB_HOST, database=DB_NAME,
                user=DB_USER, password=DB_PASS, port=DB_PORT,
            )
            conn.close()
            print(f"[migrate_db] PostgreSQL is ready (attempt {attempt})")
            return True
        except psycopg2.OperationalError as e:
            print(f"[migrate_db] Waiting for PostgreSQL (attempt {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(RETRY_DELAY)
    print("[migrate_db] ERROR: Could not connect to PostgreSQL after retries")
    return False


def ensure_tables_exist(conn):
    """Create tables if they don't exist yet (first-time setup)."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mila_monitor_logs (
                id SERIAL PRIMARY KEY,
                order_name TEXT,
                status TEXT,
                receiver JSONB,
                bran_receiver JSONB,
                yield_log JSONB,
                setpoints_produced JSONB,
                produced_weight NUMERIC,
                created_at TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mila_monitor_logs_archive (
                id SERIAL PRIMARY KEY,
                order_name TEXT,
                status TEXT,
                receiver JSONB,
                bran_receiver JSONB,
                yield_log JSONB,
                setpoints_produced JSONB,
                produced_weight NUMERIC,
                created_at TIMESTAMP
            )
        """)
        conn.commit()


def run_migrations():
    """Execute all pending migrations."""
    if not wait_for_db():
        sys.exit(1)

    conn = psycopg2.connect(
        host=DB_HOST, database=DB_NAME,
        user=DB_USER, password=DB_PASS, port=DB_PORT,
    )
    conn.autocommit = False

    try:
        ensure_tables_exist(conn)

        for migration in MIGRATIONS:
            mid = migration["id"]
            desc = migration["description"]
            print(f"[migrate_db] Running migration {mid}: {desc}")
            with conn.cursor() as cur:
                for stmt in migration["statements"]:
                    cur.execute(stmt)
            conn.commit()
            print(f"[migrate_db] Migration {mid} completed successfully")

        print("[migrate_db] All migrations completed")
    except Exception as e:
        conn.rollback()
        print(f"[migrate_db] ERROR during migration: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run_migrations()
