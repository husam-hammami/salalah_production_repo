# MIL-A Order Start/End Time Fix

**Date:** 2026-03-31  
**Issue:** MIL-A job orders not showing correct start and end times  
**Status:** Fixed and deployed

---

## Problem

Users reported that MIL-A (Mill-A) job orders displayed **incorrect start and end times** in reports and the Orders page. The times were always rounded to 30-minute boundaries instead of showing the actual time the PLC started/stopped the order.

### Example of the problem

| What the user saw | What actually happened |
|---|---|
| Start: `10:30:00` | Real start: `10:03:15` |
| End: `14:00:00` | Real end: `13:47:22` |

Times could be off by **up to 30 minutes**.

---

## Root Cause Analysis

The issue was caused by how data flows between the two MIL-A database tables:

### Data Flow (before fix)

```
PLC (DB2099 offset 104, job_status Bool)
    │
    ▼
mila_monitor_logs (LIVE TABLE)
    - 1 row inserted every second
    - created_at = real Dubai timestamp (correct)
    - order_name = "MILA771" or NULL
    │
    ▼  (every 30 minutes, archive process runs)
mila_monitor_logs_archive (ARCHIVE TABLE)
    - ~1800 live rows compressed into 1 archive row
    - created_at = archive_cutoff (30-minute boundary) ← WRONG
    - order_name = last row's order_name
    │
    ▼
Summary API → Frontend
    - start_time = first archive row's created_at (30-min boundary) ← WRONG
    - end_time = last archive row's created_at (30-min boundary)  ← WRONG
```

### Four specific problems identified

**1. Archive stored `archive_cutoff` instead of real timestamps**

In `app.py`, the archive INSERT used the 30-minute boundary as `created_at`:

```python
# BEFORE (broken) — app.py archive process
cur.execute("""
    INSERT INTO mila_monitor_logs_archive (
        order_name, status, receiver, bran_receiver,
        yield_log, setpoints_produced, produced_weight, created_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
""", (
    last_row["order_name"],
    ...
    archive_cutoff  # ← 30-minute boundary, NOT real time
))
```

**2. All data in a 30-minute window compressed into one row**

1800 live rows became 1 archive row. The real timestamps were thrown away.

**3. Summary API derived times from archive `created_at`**

```python
# BEFORE (broken) — orders_bp.py summary endpoint
summary_response = {
    "start_time": first_record.get("created_at"),  # ← 30-min boundary
    "end_time": last_record.get("created_at")       # ← 30-min boundary
}
```

**4. Order state cleared before final INSERT**

When `job_status` changed from 1→0, the code cleared `mila_current_order_name` and `mila_session_started` **before** the INSERT ran in the same loop iteration, losing the order context on the final row.

```python
# BEFORE (broken) — app.py live monitor
elif job_status == 0:
    if mila_current_order_name:
        mila_current_order_name = None   # ← cleared BEFORE INSERT
        mila_session_started = None      # ← cleared BEFORE INSERT
# ... INSERT runs later with order_name=NULL
```

---

## Solution

### Approach

Add two new columns (`order_start_time`, `order_end_time`) to both tables that store the **real PLC timestamps** when orders start and stop. The existing `created_at` column is left untouched for backward compatibility.

### Database Changes

Two new `TIMESTAMP` columns added to both tables:

```sql
ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP;
ALTER TABLE mila_monitor_logs ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP;
ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_start_time TIMESTAMP;
ALTER TABLE mila_monitor_logs_archive ADD COLUMN IF NOT EXISTS order_end_time TIMESTAMP;
```

These are applied automatically on container startup via `migrate_db.py`.

### Files Changed

| File | Change |
|------|--------|
| `backend/migrate_db.py` | **New** — database migration script |
| `backend/entrypoint.sh` | **New** — runs migration before app starts |
| `backend/Dockerfile` | Changed `CMD` → `ENTRYPOINT ["./entrypoint.sh"]` |
| `backend/app.py` | Live monitor + archive process updated |
| `backend/orders_bp.py` | Summary API updated |

---

## Code Changes in Detail

### 1. Migration Script (`migrate_db.py`)

New file that runs on every container startup. It:
- Waits for PostgreSQL to be ready (retries 10 times)
- Creates tables if they don't exist (first-time setup)
- Adds `order_start_time` and `order_end_time` columns via `ADD COLUMN IF NOT EXISTS` (idempotent — safe to run repeatedly)

### 2. Docker Entrypoint (`entrypoint.sh` + `Dockerfile`)

```bash
#!/bin/bash
set -e
echo "[entrypoint] Running database migrations..."
python migrate_db.py
echo "[entrypoint] Starting application..."
exec gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    -w 1 -b 0.0.0.0:5000 app:app
```

Dockerfile changed from:
```dockerfile
CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", ...]
```
To:
```dockerfile
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
```

### 3. Live Monitor (`app.py`)

**Added `mila_session_ended` variable:**

```python
mila_order_counter = 1
mila_current_order_name = None
mila_session_started = None
mila_session_ended = None       # ← NEW
```

**Order start — clear end time:**

```python
if job_status == 1:
    if not mila_current_order_name or not mila_session_started:
        mila_current_order_name = f"MILA{mila_order_counter}"
        mila_order_counter += 1
        mila_session_started = now
        mila_session_ended = None   # ← NEW: clear end time on new order
```

**Order stop — capture end time, defer clearing:**

```python
# AFTER (fixed)
mila_order_ending = False

elif job_status == 0:
    if mila_current_order_name:
        mila_session_ended = now            # ← NEW: capture real end time
        mila_order_ending = True            # ← defer clearing until after INSERT
        # NOTE: order_name and session_started are NOT cleared here anymore
```

**INSERT — includes new columns:**

```python
cursor.execute("""
    INSERT INTO mila_monitor_logs (
        order_name, status, receiver, bran_receiver, yield_log,
        setpoints_produced, produced_weight, created_at,
        order_start_time, order_end_time          -- NEW columns
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
""", (
    mila_current_order_name,
    "running",
    ...,
    now,
    mila_session_started,     # ← real order start time
    mila_session_ended,       # ← real order end time (or NULL if still running)
))

# Clear order state AFTER INSERT so the final row captures end time
if mila_order_ending:
    mila_current_order_name = None
    mila_session_started = None
    mila_session_ended = None
```

### 4. Archive Process (`app.py`)

Extracts real times from live rows before compressing:

```python
# Extract real order start/end times from live rows
start_times = [r.get('order_start_time') for r in rows if r.get('order_start_time')]
end_times = [r.get('order_end_time') for r in rows if r.get('order_end_time')]
archive_order_start = min(start_times) if start_times else None
archive_order_end = max(end_times) if end_times else None

cur.execute("""
    INSERT INTO mila_monitor_logs_archive (
        order_name, status, receiver, bran_receiver, yield_log,
        setpoints_produced, produced_weight, created_at,
        order_start_time, order_end_time          -- NEW columns
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
""", (
    ...,
    archive_cutoff,          # created_at stays as 30-min boundary (backward compat)
    archive_order_start,     # ← real start time from live rows
    archive_order_end,       # ← real end time from live rows (NULL if still running)
))
```

### 5. Summary API (`orders_bp.py`)

Uses new columns with fallback for old data:

```python
# AFTER (fixed) — uses real times if available, falls back for old data
all_start_times = [r.get("order_start_time") for r in exact_rows if r.get("order_start_time")]
all_end_times = [r.get("order_end_time") for r in exact_rows if r.get("order_end_time")]
real_start = min(all_start_times) if all_start_times else first_record.get("created_at")
real_end = max(all_end_times) if all_end_times else last_record.get("created_at")

summary_response = {
    ...
    "start_time": real_start,    # ← accurate time (or fallback for old data)
    "end_time": real_end,        # ← accurate time (or fallback for old data)
}
```

Analytics endpoint also updated:

```python
# AFTER (fixed) — uses COALESCE for backward compatibility
cur.execute("""
    SELECT
        COALESCE(MIN(order_start_time), MIN(created_at)),
        COALESCE(MAX(order_end_time), MAX(created_at))
    FROM mila_monitor_logs_archive WHERE order_name = %s
""", (order_name,))
```

---

## Backward Compatibility

| Data | Behavior |
|------|----------|
| **Old archive data** (before fix) | `order_start_time = NULL` → API falls back to `created_at` → same as before |
| **New data** (after fix) | `order_start_time` and `order_end_time` populated → API returns accurate times |

- No existing columns removed or renamed
- No existing data modified
- `created_at` continues to work for all time-range queries
- Old reports are unaffected

---

## Verification

After deploying, verify with:

```bash
# Check migration ran
docker logs hercules_backend | head -20

# Check columns exist
docker exec hercules_postgres psql -U postgres -d Dynamic_DB_Hercules -c \
  "SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name IN ('mila_monitor_logs', 'mila_monitor_logs_archive')
   AND column_name IN ('order_start_time', 'order_end_time')
   ORDER BY table_name, column_name;"

# Check live data is storing correctly
docker exec hercules_postgres psql -U postgres -d Dynamic_DB_Hercules -c \
  "SELECT order_name, created_at, order_start_time, order_end_time
   FROM mila_monitor_logs ORDER BY created_at DESC LIMIT 5;"
```

Expected behavior:
- Active order rows: `order_start_time` filled, `order_end_time` = NULL
- Final row of finished order: both `order_start_time` and `order_end_time` filled
- Idle rows (no order): both NULL

---

## PLC Reference

| Signal | PLC | Offset | Type | Meaning |
|--------|-----|--------|------|---------|
| `job_status` | DB2099 | Byte 104 | Bool | `1` = order active, `0` = order done |
| PLC IP | — | — | — | `192.168.23.11` |
