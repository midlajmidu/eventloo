#!/bin/bash

# Start script for Django backend
echo "🚀 Starting Django backend..."

# Set default port if not provided
export PORT=${PORT:-8080}

# Debug: Log the PORT
echo "PORT is set to: $PORT"

# Apply database migrations
echo "📊 Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput --clear

# Start Gunicorn
echo "🔥 Starting Gunicorn on port $PORT..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 2 \
    --threads 4 \
    --timeout 300 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100
