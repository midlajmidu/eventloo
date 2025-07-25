#!/bin/bash

# Render deployment start script
echo "Starting Eventloo application on Render..."

# Navigate to backend directory
cd backend

# Run database migrations
echo "Running database migrations..."
python manage.py migrate

# Start the Django application with Gunicorn
echo "Starting Django application with Gunicorn..."
gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120 