#!/bin/bash
set -e

echo "[entrypoint] Running database migrations..."
python migrate_db.py

echo "[entrypoint] Starting application..."
exec gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 app:app
