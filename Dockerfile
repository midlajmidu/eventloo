# ==============================================================================
# Stage 1: Build Frontend (Node.js Alpine)
# ==============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Install dependencies first (layer caching)
COPY frontend/package*.json ./
RUN npm ci --silent || npm install --silent

# Copy frontend source code and compile production SPA bundle
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Unified Container Runtime (Python Slim + Nginx + Gunicorn)
# ==============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies (Nginx reverse proxy, Supervisor, PostgreSQL client libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

# Install Python backend dependencies
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /build/build /app/frontend_build

# Copy backend source code
COPY backend/ /app/backend/

# Copy Docker service configurations
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create persistent storage directories
RUN mkdir -p /app/data /app/media /app/backend/staticfiles

EXPOSE 80

VOLUME ["/app/data", "/app/media"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
