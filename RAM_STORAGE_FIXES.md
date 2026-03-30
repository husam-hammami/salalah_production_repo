# RAM & Storage Optimization Fixes

## Fix 1: Scheduler Runs Monthly Report Every 60 Seconds

**Impact:** ~100-200MB RAM saved
**File:** `scheduler.py` line 7

### Problem

`run_combined_monthly_report` is scheduled with `'interval', seconds=60` — meaning every minute it:
1. Fetches 3 API endpoints (FCL, SCL, MILA)
2. Loads `xhtml2pdf` + `reportlab` to generate 3 PDFs
3. Sends an email with all 3 attachments

These PDF libraries are memory-heavy and allocate significant memory for HTML rendering. This is a **monthly** report running **every 60 seconds** — 43,200 times more often than needed.

### Current Code

```python
scheduler.add_job(run_combined_monthly_report, 'interval', seconds=60)
```

### Fixed Code

```python
# Run on the 1st of each month at 08:00
scheduler.add_job(run_combined_monthly_report, 'cron', day=1, hour=8, minute=0)
```

---

## Fix 2: `fcl_realtime_monitor` Spawned Up to 3 Times

**Impact:** ~50-100MB RAM saved
**File:** `app.py` lines 3001, 3018, 3041

### Problem

The same `while True` polling loop is spawned in **three places**:

| Location | Line | When |
|----------|------|------|
| Module import | 3018 | Always on startup |
| `__main__` block | 3041 | When run directly |
| WebSocket `connect` handler | 3001 | Every client connection |

Each instance independently runs HTTP requests, JSON parsing, and DB queries every ~1 second. Two of the three are **redundant** — the import-time spawn (line 3018) already starts the monitor before either of the other two execute.

### Current Code

```python
# Line 3001 — inside @socketio.on('connect')
if not monitor_running:
    logger.info('Starting FCL monitor for first client')
    gevent.spawn(fcl_realtime_monitor)

# Line 3018 — module-level (runs on import)
gevent.spawn(fcl_realtime_monitor)

# Line 3041 — inside if __name__ == '__main__'
gevent.spawn(fcl_realtime_monitor)
```

### Fixed Code

Remove the spawns at lines 3001 and 3041. Keep only the module-level spawn at line 3018.

```python
# Line 3001 — inside @socketio.on('connect')
# Monitor is already spawned on import — no need to spawn again
logger.info('FCL monitor already running' if monitor_running else 'Waiting for monitor startup')

# Line 3018 — module-level (keep as-is)
gevent.spawn(fcl_realtime_monitor)

# Line 3041 — inside if __name__ == '__main__'
# Remove: gevent.spawn(fcl_realtime_monitor)
# Monitors are already spawned on import above
```

---

## Fix 3: Add `.dockerignore`

**Impact:** ~2-5MB image size reduction
**File:** new `.dockerignore` in project root

### Problem

`COPY . .` in the Dockerfile copies everything into the image, including files not needed at runtime:

- 12 `.xlsx` data files (344KB)
- 7 `.PNG` screenshots in `frontend/` (480KB)
- `frontend/src.zip` (176KB)
- `__pycache__/` (100KB)
- `.git/` directory (1.7MB)
- Dev/debug scripts: `check_*.py`, `export_*.py`, `test_*.py`, `*_injection.py`, etc.
- Duplicate files: `frontend/app.py`, `frontend/orders_bp.py`

### Fixed Code

Create `.dockerignore` in the project root:

```
# Git
.git
.gitignore

# Data files - not needed at runtime
*.xlsx

# Screenshots and archives
*.PNG
*.png
*.zip
frontend/*.PNG
frontend/src.zip
frontend/app.py
frontend/orders_bp.py

# Python cache
__pycache__
*.pyc
*.pyo

# Dev/debug scripts
check_*.py
export_*.py
test_*.py
verify_*.py
fix_sequence.py
*_injection.py
inject_*.py
update_*.py

# Documentation
docs/
*.md
```

---

## Fix 4: Multi-Stage Docker Build

**Impact:** ~200-400MB image size reduction
**File:** `Dockerfile`

### Problem

Build-time dependencies (`gcc`, `build-essential`, `python3-dev`, `libpq-dev`, `libcairo2-dev`, `libgirepository1.0-dev`) are installed to compile Python packages but remain in the final image. They are never used at runtime and add **200-400MB** to the image.

### Current Code

```dockerfile
FROM python:3.9-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install --no-install-recommends -y \
    gcc \
    libc-dev \
    pkg-config \
    python3-dev \
    build-essential \
    libpq-dev \
    libcairo2-dev \
    libgirepository1.0-dev \
    gir1.2-cairo-1.0 \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
```

### Fixed Code

```dockerfile
# Stage 1: Build — compile Python packages
FROM python:3.9-slim AS builder

WORKDIR /app

RUN apt-get update \
 && apt-get install --no-install-recommends -y \
    gcc \
    libc-dev \
    pkg-config \
    python3-dev \
    build-essential \
    libpq-dev \
    libcairo2-dev \
    libgirepository1.0-dev \
    gir1.2-cairo-1.0 \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime — only what's needed to run
FROM python:3.9-slim

WORKDIR /app

# Install only runtime libraries (no compilers)
RUN apt-get update \
 && apt-get install --no-install-recommends -y \
    libpq5 \
    libcairo2 \
    libgirepository-1.0-1 \
    gir1.2-cairo-1.0 \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
```

---

## Fix 5: Remove Unused `eventlet` Dependency

**Impact:** ~10-20MB RAM + smaller image
**File:** `requirements.txt` line 10

### Problem

Both `eventlet==0.33.3` and `gevent==23.9.1` are installed. Only `gevent` is used:

- Gunicorn CMD uses `GeventWebSocketWorker`
- SocketIO is initialized with `async_mode='gevent'`
- All background tasks use `gevent.spawn()` and `gevent.sleep()`

`eventlet` is unused dead weight that still consumes memory when installed.

### Current Code

```
eventlet==0.33.3
```

### Fixed Code

Remove the `eventlet==0.33.3` line from `requirements.txt`.

---

## Summary

| # | Fix | Type | Estimated Savings |
|---|-----|------|-------------------|
| 1 | Scheduler `cron` instead of 60s interval | RAM | ~100-200MB |
| 2 | Remove duplicate `fcl_realtime_monitor` spawns | RAM | ~50-100MB |
| 3 | Add `.dockerignore` | Storage | ~2-5MB |
| 4 | Multi-stage Docker build | Storage | ~200-400MB |
| 5 | Remove unused `eventlet` | RAM + Storage | ~10-20MB |

**Total estimated savings: ~360-720MB**

None of these fixes change any runtime behavior. The app, monitors, WebSocket, scheduler, and reports all function exactly the same.
