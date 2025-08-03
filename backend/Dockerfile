FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set work directory
WORKDIR /app

# Install system dependencies in a single layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        pkg-config \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-production.txt requirements.txt

# Install Python dependencies with memory optimization
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --compile -r requirements.txt

# Copy application code
COPY . .

# Create start script
RUN echo '#!/bin/bash' > start.sh && \
    echo 'echo "🚀 Starting Django backend..."' >> start.sh && \
    echo 'export PORT=${PORT:-8080}' >> start.sh && \
    echo 'python manage.py migrate --noinput' >> start.sh && \
    echo 'python manage.py collectstatic --noinput --clear' >> start.sh && \
    echo 'exec gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 --keep-alive 5 --max-requests 500 --max-requests-jitter 50' >> start.sh && \
    chmod +x start.sh

# Expose the default port
EXPOSE 8080

# Run the start script
CMD ["./start.sh"]
