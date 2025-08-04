#!/bin/bash

echo "Starting Django backend"

# Change to backend directory
cd backend

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create admin user
echo "Creating admin user..."
python manage.py create_admin_user

# Start Gunicorn server
echo "Starting Gunicorn server..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --threads 4 \
    --timeout 300 