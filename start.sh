#!/bin/bash

# Set default port if not provided
export PORT=${PORT:-8080}

echo "Starting Django application on port $PORT"

# Run database migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

# Start Gunicorn
exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 --keep-alive 2 event_management.wsgi:application 