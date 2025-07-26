# Multi-stage build for Django backend
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

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

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt /app/
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

# Copy backend project files
COPY backend/ /app/

# Create directories for static and media files
RUN mkdir -p /app/staticfiles /app/media

# Collect static files
RUN python manage.py collectstatic --noinput --clear

# Create a non-root user for security
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port (Google Cloud Run will set PORT environment variable)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/admin/dashboard/summary/ || exit 1

# Start Gunicorn server
CMD gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 3 --timeout 120 --keep-alive 2 event_management.wsgi:application 