FROM python:3.9-slim

WORKDIR /app

# Install system build dependencies for Python packages
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
