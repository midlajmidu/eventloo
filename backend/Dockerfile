FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Copy all source files
COPY . .

# Debug: List files to see what was copied
RUN ls -la

# Install dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Explicitly copy start.sh if it doesn't exist
RUN if [ ! -f start.sh ]; then echo "start.sh not found, creating it"; \
    echo '#!/bin/bash' > start.sh; \
    echo 'echo "🚀 Starting Django backend..."' >> start.sh; \
    echo 'export PORT=${PORT:-8080}' >> start.sh; \
    echo 'python manage.py migrate --noinput' >> start.sh; \
    echo 'python manage.py collectstatic --noinput --clear' >> start.sh; \
    echo 'exec gunicorn event_management.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 300 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100' >> start.sh; \
    fi

# Ensure start.sh is executable
RUN chmod +x start.sh

# Expose the default port (Cloud Run uses PORT env)
EXPOSE 8080

# Run the start script
CMD ["./start.sh"]
