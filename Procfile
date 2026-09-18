release: cd backend && python manage.py migrate --noinput
web: cd backend && python manage.py collectstatic --noinput && gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 60 --access-logfile - --error-logfile -
