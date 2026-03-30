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

RUN apt-get update \
 && apt-get install --no-install-recommends -y \
    libpq5 \
    libcairo2 \
    libgirepository-1.0-1 \
    gir1.2-cairo-1.0 \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
