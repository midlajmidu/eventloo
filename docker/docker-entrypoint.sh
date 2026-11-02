#!/bin/bash
set -e

echo "========================================================"
echo "    Starting Eventloo Unified Production Container      "
echo "========================================================"

# 1. Dynamic Port Binding (Supports Render, Cloud Run, Heroku, standard Docker)
CONTAINER_PORT="${PORT:-80}"
echo "[1/6] Configuring Nginx to listen on port ${CONTAINER_PORT}..."
sed -i "s/listen 80;/listen ${CONTAINER_PORT};/g" /etc/nginx/conf.d/default.conf

# 2. Establish Default Configurations
export WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-app.eventloo.in,app.eventloo.com,localhost,127.0.0.1,*}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://app.eventloo.in,http://app.eventloo.in,https://app.eventloo.com,http://localhost:8000,http://localhost:3000}"
export CSRF_TRUSTED_ORIGINS="${CSRF_TRUSTED_ORIGINS:-https://app.eventloo.in,http://app.eventloo.in,https://app.eventloo.com,http://localhost:8000,http://localhost:3000}"
export ALLOW_SQLITE="${ALLOW_SQLITE:-true}"
export ALLOW_LOCAL_MEDIA="${ALLOW_LOCAL_MEDIA:-true}"
export ALLOW_LOCAL_CACHE="${ALLOW_LOCAL_CACHE:-true}"
export SQLITE_DB_PATH="${SQLITE_DB_PATH:-/app/data/db.sqlite3}"
export MEDIA_ROOT="${MEDIA_ROOT:-/app/media}"

# Ensure persistent mount directories exist
mkdir -p /app/data /app/media /app/backend/staticfiles

# Auto-generate and persist cryptographic keys if not supplied in environment
if [ -z "$SECRET_KEY" ]; then
    SECRET_FILE="/app/data/.secret_key"
    if [ -f "$SECRET_FILE" ]; then
        export SECRET_KEY=$(cat "$SECRET_FILE")
    else
        export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
        echo "$SECRET_KEY" > "$SECRET_FILE" 2>/dev/null || true
    fi
fi

if [ -z "$JWT_SIGNING_KEY" ]; then
    JWT_FILE="/app/data/.jwt_key"
    if [ -f "$JWT_FILE" ]; then
        export JWT_SIGNING_KEY=$(cat "$JWT_FILE")
    else
        export JWT_SIGNING_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
        echo "$JWT_SIGNING_KEY" > "$JWT_FILE" 2>/dev/null || true
    fi
fi

cd /app/backend

# 3. Database Readiness Check (if PostgreSQL DATABASE_URL is supplied)
if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" =~ ^postgres ]]; then
    echo "[2/6] Waiting for PostgreSQL database to accept connections..."
    python3 -c "
import os, sys, time, dj_database_url, psycopg2
db_config = dj_database_url.parse(os.environ['DATABASE_URL'])
for attempt in range(30):
    try:
        conn = psycopg2.connect(
            dbname=db_config['NAME'],
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            host=db_config['HOST'],
            port=db_config.get('PORT', 5432),
            connect_timeout=3
        )
        conn.close()
        print('PostgreSQL database connected successfully!')
        sys.exit(0)
    except Exception as exc:
        print(f'Waiting for database (attempt {attempt + 1}/30)...')
        time.sleep(2)
print('ERROR: Timed out waiting for database connection.', file=sys.stderr)
sys.exit(1)
"
else
    echo "[2/6] Using persistent local SQLite database at ${SQLITE_DB_PATH}..."
fi

# 4. Run Database Migrations
echo "[3/6] Running database migrations..."
python3 manage.py migrate --noinput

# 5. Collect Static Files for Nginx Direct Delivery
echo "[4/6] Collecting backend static assets..."
python3 manage.py collectstatic --noinput --clear

# 6. Automatic Super Admin Seeding (if requested)
if [ -n "$SUPER_ADMIN_PASSWORD" ]; then
    echo "[5/6] Seeding Super Admin account..."
    export SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-superadmin@eventloo.com}"
    export SUPER_ADMIN_NAME="${SUPER_ADMIN_NAME:-Platform Super Admin}"
    python3 manage.py seed_super_admin --email="$SUPER_ADMIN_EMAIL" --name="$SUPER_ADMIN_NAME" || true
else
    echo "[5/6] No SUPER_ADMIN_PASSWORD supplied; skipping auto-seeding."
fi

# 7. Hand over execution to Supervisor (runs Nginx + Gunicorn)
echo "[6/6] Launching Nginx and Gunicorn via Supervisor..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
