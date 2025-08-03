# Multi-stage build for Django backend
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libjpeg-dev \
        libpng-dev \
        libfreetype6-dev \
        liblcms2-dev \
        libwebp-dev \
        libopenjp2-7-dev \
        libtiff5-dev \
        libxcb1-dev \
        pkg-config \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements-production.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

# Copy project files
COPY . /app/

# Create directories for static and media files
RUN mkdir -p /app/backend/staticfiles /app/backend/media

# Create startup script
RUN echo '#!/bin/bash' > /app/startup.sh && \
    echo 'echo "🚀 Starting Django backend..."' >> /app/startup.sh && \
    echo 'export PORT=${PORT:-8080}' >> /app/startup.sh && \
    echo 'cd /app/backend' >> /app/startup.sh && \
    echo 'python manage.py migrate --noinput' >> /app/startup.sh && \
    echo 'python manage.py collectstatic --noinput --clear' >> /app/startup.sh && \
    echo 'exec gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 --keep-alive 5 --max-requests 500 --max-requests-jitter 50' >> /app/startup.sh && \
    chmod +x /app/startup.sh

# Collect static files
RUN cd /app/backend && python manage.py collectstatic --noinput --clear

# Create a non-root user for security
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port (Google Cloud Run will set PORT environment variable)
EXPOSE 8080

# Start using the startup script
CMD ["/app/startup.sh"] 