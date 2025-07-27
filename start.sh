#!/bin/bash

# Exit on any error
set -e

# Wait for database to be ready (if using Cloud SQL)
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database to be ready..."
    python manage.py wait_for_db --timeout=60
fi

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files (in case they weren't collected during build)
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info 