#!/bin/bash

echo "Starting Django application..."

# Run migrations
python manage.py migrate --noinput

# Start Gunicorn
exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 event_management.wsgi:application 