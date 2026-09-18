#!/bin/bash

echo "Starting Django backend"

# Change to backend directory
cd backend

# Wait for database to be ready (for Render)
echo "Waiting for database connection..."
sleep 5

# Run database migrations with retry
echo "Running database migrations..."
python manage.py migrate --noinput || {
    echo "Migration failed, retrying in 10 seconds..."
    sleep 10
    python manage.py migrate --noinput
}

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Start Gunicorn server
echo "Starting Gunicorn server..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers "${WEB_CONCURRENCY:-2}" \
    --threads 4 \
    --timeout 60 \
    --preload \
    --access-logfile - \
    --error-logfile - 
