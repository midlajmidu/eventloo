#!/bin/bash

echo "🚀 Starting Eventloo backend..."

# Change to backend directory
cd backend

# Run migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Create admin user
echo "👤 Creating admin user..."
python manage.py create_admin_user

# Start Gunicorn server
echo "🌐 Starting Gunicorn server..."
exec gunicorn event_management.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --threads 2 \
    --timeout 60 \
    --preload \
    --access-logfile - \
    --error-logfile - 