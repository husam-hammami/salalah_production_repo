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

# ALTER TABLE needs ACCESS EXCLUSIVE; long-running writers (SCL/FCL monitors) can block forever without this.
# Set to 0 to wait indefinitely (old behaviour). Value is milliseconds.
MIGRATE_LOCK_TIMEOUT_MS = int(os.getenv("MIGRATE_LOCK_TIMEOUT_MS", "60000"))

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
    {
        "id": "002_fcl_order_times",
        "description": "Add order_start_time and order_end_time to FCL tables",
        "statements": [
            "ALTER TABLE fcl_monitor_logs ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE fcl_monitor_logs ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
            "ALTER TABLE fcl_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE fcl_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
        ],
    },
    {
        "id": "003_scl_order_times",
        "description": "Add order_start_time and order_end_time to SCL tables",
        "statements": [
            "ALTER TABLE scl_monitor_logs ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE scl_monitor_logs ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
            "ALTER TABLE scl_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE scl_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
        ],
    },
    {
        "id": "004_ftra_order_times",
        "description": "Add order_start_time and order_end_time to FTRA tables",
        "statements": [
            "ALTER TABLE ftra_monitor_logs ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE ftra_monitor_logs ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
            "ALTER TABLE ftra_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP",
            "ALTER TABLE ftra_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP",
        ],
    },
    {
        "id": "005_fcl_520we_snapshots",
        "description": "FCL_2_520WE cumulative totalizer at order start/end on FCL tables",
        "statements": [
            "ALTER TABLE fcl_monitor_logs ADD COLUMN IF NOT EXISTS fcl_2_520we_at_order_start NUMERIC",
            "ALTER TABLE fcl_monitor_logs ADD COLUMN IF NOT EXISTS fcl_2_520we_at_order_end NUMERIC",
            "ALTER TABLE fcl_monitor_logs_archive ADD COLUMN IF NOT EXISTS fcl_2_520we_at_order_start NUMERIC",
            "ALTER TABLE fcl_monitor_logs_archive ADD COLUMN IF NOT EXISTS fcl_2_520we_at_order_end NUMERIC",
        ],
    },
    {
        "id": "006_mila_b1_scale_snapshots",
        "description": "MIL-A B1 scale cumulative kg at order start/end (mirrors FCL 520WE snapshots)",
        "statements": [
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS mila_b1_scale_at_order_start NUMERIC",
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS mila_b1_scale_at_order_end NUMERIC",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS mila_b1_scale_at_order_start NUMERIC",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS mila_b1_scale_at_order_end NUMERIC",
        ],
    },
    {
        "id": "007_mila_totalizers_json_snapshots",
        "description": "MIL-A all scale totalizers at order start/end as JSONB (two columns)",
        "statements": [
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS mila_totalizers_at_order_start JSONB",
            "ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS mila_totalizers_at_order_end JSONB",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS mila_totalizers_at_order_start JSONB",
            "ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS mila_totalizers_at_order_end JSONB",
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

        if MIGRATE_LOCK_TIMEOUT_MS > 0:
            print(
                f"[migrate_db] lock_timeout={MIGRATE_LOCK_TIMEOUT_MS}ms "
                "(set MIGRATE_LOCK_TIMEOUT_MS=0 to wait indefinitely for locks)"
            )
        else:
            print(
                "[migrate_db] lock_timeout=0 — ALTER TABLE can hang until monitors release "
                "scl_monitor_logs / fcl_monitor_logs / …"
            )

        for migration in MIGRATIONS:
            mid = migration["id"]
            desc = migration["description"]
            print(f"[migrate_db] Running migration {mid}: {desc}")
            stmts = migration["statements"]
            with conn.cursor() as cur:
                if MIGRATE_LOCK_TIMEOUT_MS > 0:
                    cur.execute("SET lock_timeout TO %s", (MIGRATE_LOCK_TIMEOUT_MS,))
                else:
                    cur.execute("SET lock_timeout TO 0")
                for i, stmt in enumerate(stmts, 1):
                    t0 = time.perf_counter()
                    stmt_preview = (stmt[:90] + "...") if len(stmt) > 90 else stmt
                    print(f"[migrate_db]   [{i}/{len(stmts)}] {stmt_preview}")
                    sys.stdout.flush()
                    cur.execute(stmt)
                    elapsed = time.perf_counter() - t0
                    print(f"[migrate_db]   [{i}/{len(stmts)}] ok ({elapsed:.2f}s)")
                    sys.stdout.flush()
            conn.commit()
            print(f"[migrate_db] Migration {mid} completed successfully")

        print("[migrate_db] All migrations completed")
    except Exception as e:
        conn.rollback()
        err = str(e).lower()
        print(f"[migrate_db] ERROR during migration: {e}")
        if "lock timeout" in err or "canceling statement due to lock timeout" in err:
            print(
                "[migrate_db] HINT: PostgreSQL could not lock a table in time. "
                "Stop the Hercules backend / Docker stack (or anything inserting into "
                "scl_monitor_logs, fcl_monitor_logs, etc.), then run migrate_db again."
            )
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run_migrations()
