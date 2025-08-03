# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create startup script
RUN echo '#!/bin/bash\n\
cd /app/backend\n\
python manage.py migrate\n\
python manage.py create_admin_user\n\
exec gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120\n\
' > /app/startup.sh && chmod +x /app/startup.sh

# Expose port
EXPOSE $PORT

# Run startup script
CMD ["/app/startup.sh"]
