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

# Create admin user
echo "Creating admin user..."
python manage.py create_admin_user || {
    echo "Admin user creation failed, continuing..."
}

# Start Gunicorn server
echo "Starting Gunicorn server..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --threads 4 \
    --timeout 300 \
    --preload \
    --access-logfile - \
    --error-logfile - 