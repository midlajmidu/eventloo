import os
import sys
from pathlib import Path
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Security-sensitive settings must be supplied by the deployment environment.
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
_is_test_run = 'test' in sys.argv
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG or _is_test_run:
        SECRET_KEY = 'test-only-key-not-valid-for-production-please-set-secret-key'
    else:
        raise ImproperlyConfigured('SECRET_KEY must be set in the production environment.')

JWT_SIGNING_KEY = os.environ.get('JWT_SIGNING_KEY')
if not JWT_SIGNING_KEY:
    if DEBUG or _is_test_run:
        JWT_SIGNING_KEY = SECRET_KEY
    else:
        raise ImproperlyConfigured(
            'JWT_SIGNING_KEY must be set independently in the production environment.'
        )
if not DEBUG and not _is_test_run and JWT_SIGNING_KEY == SECRET_KEY:
    raise ImproperlyConfigured('JWT_SIGNING_KEY must be different from SECRET_KEY in production.')

_allowed_hosts_value = os.environ.get('ALLOWED_HOSTS')
if not _allowed_hosts_value and not DEBUG and not _is_test_run:
    raise ImproperlyConfigured('ALLOWED_HOSTS must be explicitly set in production.')
ALLOWED_HOSTS = [
    host.strip() for host in (
        _allowed_hosts_value or '127.0.0.1,localhost,testserver'
    ).split(',') if host.strip()
]
if DEBUG and 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'accounts',
    'events',
]

USE_S3_MEDIA = bool(os.environ.get('AWS_STORAGE_BUCKET_NAME'))
ALLOW_LOCAL_MEDIA = os.environ.get('ALLOW_LOCAL_MEDIA', 'false').lower() == 'true'
if not USE_S3_MEDIA and not ALLOW_LOCAL_MEDIA and not DEBUG and not _is_test_run:
    raise ImproperlyConfigured(
        'AWS_STORAGE_BUCKET_NAME must be set in production for private uploaded media.'
    )
if USE_S3_MEDIA:
    INSTALLED_APPS.append('storages')

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'event_management.security.SecurityHeadersMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Security settings for development
if DEBUG:
    SECURE_BROWSER_XSS_FILTER = False
    SECURE_CONTENT_TYPE_NOSNIFF = False
    X_FRAME_OPTIONS = 'SAMEORIGIN'
else:
    # Production security settings
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

ROOT_URLCONF = 'event_management.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'event_management.wsgi.application'

# Database
import os
import dj_database_url

# Get database connection string from environment variable
DATABASE_URL = os.environ.get("DATABASE_URL")
ALLOW_SQLITE = os.environ.get('ALLOW_SQLITE', 'false').lower() == 'true'

if DATABASE_URL:
    database_ssl_required = os.environ.get(
        'DATABASE_SSL_REQUIRE', 'False' if DEBUG or _is_test_run else 'True'
    ).lower() == 'true'
    # Parse the database connection
    db_config = dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,      # keep connections open for reuse
        ssl_require=database_ssl_required,
    )
    DATABASES = {
        'default': db_config
    }
else:
    if not DEBUG and not _is_test_run and not ALLOW_SQLITE:
        raise ImproperlyConfigured('DATABASE_URL must be set in the production environment.')
    # SQLite fallback (for local development or single-container standalone mode)
    sqlite_db_path = os.environ.get('SQLITE_DB_PATH')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': Path(sqlite_db_path) if sqlite_db_path else (BASE_DIR / 'db.sqlite3'),
        }
    }

REDIS_URL = os.environ.get('REDIS_URL')
ALLOW_LOCAL_CACHE = os.environ.get('ALLOW_LOCAL_CACHE', 'false').lower() == 'true'
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 300,
        }
    }
elif DEBUG or _is_test_run or ALLOW_LOCAL_CACHE:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'eventloo-cache-store',
        }
    }
else:
    raise ImproperlyConfigured(
        'REDIS_URL must be set in production so authentication throttles are shared across workers.'
    )

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.environ.get('TIME_ZONE', 'Asia/Kolkata')
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STORAGES = {
    'default': {
        'BACKEND': (
            'storages.backends.s3.S3Storage'
            if USE_S3_MEDIA else 'django.core.files.storage.FileSystemStorage'
        )
    },
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
if USE_S3_MEDIA:
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = int(os.environ.get('AWS_QUERYSTRING_EXPIRE', '300'))
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'private, max-age=300'}
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME') or None
    AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL') or None

# Static files configuration for local development

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.SchoolJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.environ.get('DRF_ANON_RATE', '60/minute'),
        'user': os.environ.get('DRF_USER_RATE', '600/minute'),
        'login': os.environ.get('DRF_LOGIN_RATE', '10/minute'),
        'exports': os.environ.get('DRF_EXPORT_RATE', '20/hour'),
        'uploads': os.environ.get('DRF_UPLOAD_RATE', '10/hour'),
    },
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=10),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': JWT_SIGNING_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JWK_URL': None,
    'LEEWAY': 0,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# CORS settings for local development
_default_frontend_origins = (
    'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,'
    'http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:3003,'
    'https://eventloo.vercel.app,https://app.eventloo.in,http://app.eventloo.in,https://app.eventloo.com,http://app.eventloo.com'
)
_cors_origins_value = os.environ.get('CORS_ALLOWED_ORIGINS')
if not _cors_origins_value and not DEBUG and not _is_test_run:
    raise ImproperlyConfigured('CORS_ALLOWED_ORIGINS must be explicitly set in production.')
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in (
        _cors_origins_value or _default_frontend_origins
    ).split(',') if origin.strip()
]

CORS_ALLOW_CREDENTIALS = True

# CSRF settings for local development
_csrf_origins_value = os.environ.get('CSRF_TRUSTED_ORIGINS')
if not _csrf_origins_value and not DEBUG and not _is_test_run:
    raise ImproperlyConfigured('CSRF_TRUSTED_ORIGINS must be explicitly set in production.')
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in (
        _csrf_origins_value or _cors_origins_value or _default_frontend_origins
    ).split(',') if origin.strip()
]

# Additional CORS settings for Chrome compatibility
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Security settings for development
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True 

# Production transport and browser hardening. TLS termination proxies must set
# X-Forwarded-Proto correctly.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() == 'true'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

REFRESH_COOKIE_NAME = 'eventloo_refresh'
ACCESS_COOKIE_NAME = 'eventloo_access'
REFRESH_COOKIE_SECURE = not DEBUG
REFRESH_COOKIE_SAMESITE = os.environ.get(
    'REFRESH_COOKIE_SAMESITE', 'Lax'
)
REQUIRE_AJAX_AUTH_HEADER = not DEBUG and not _is_test_run
ENABLE_DJANGO_ADMIN = os.environ.get('ENABLE_DJANGO_ADMIN', 'False').lower() == 'true'
REQUIRE_SUPER_ADMIN_MFA = os.environ.get(
    'REQUIRE_SUPER_ADMIN_MFA', 'False'
).lower() == 'true'
REQUIRE_SCHOOL_STAFF_MFA = os.environ.get(
    'REQUIRE_SCHOOL_STAFF_MFA', 'False' if DEBUG or _is_test_run else 'True'
).lower() == 'true'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media')) 

# File upload settings
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {
        'security.audit': {
            'handlers': ['console'],
            'level': os.environ.get('SECURITY_AUDIT_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
    },
}

# Additional file upload settings for production
if not DEBUG:
    # Ensure media directory exists
    os.makedirs(MEDIA_ROOT, exist_ok=True)
    
    # Configure file upload handlers for production
    FILE_UPLOAD_HANDLERS = [
        'django.core.files.uploadhandler.MemoryFileUploadHandler',
        'django.core.files.uploadhandler.TemporaryFileUploadHandler',
    ]
    
    # Set maximum file size for temporary uploads
    FILE_UPLOAD_TEMP_DIR = os.path.join(BASE_DIR, 'temp_uploads')
    os.makedirs(FILE_UPLOAD_TEMP_DIR, exist_ok=True) 

# Email Configuration
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'accounts.email_backend.SSLContextEmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.zoho.in')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'

# Default noreply credentials (Security OTPs, Password Resets)
NOREPLY_EMAIL_HOST = os.environ.get('NOREPLY_EMAIL_HOST', 'smtp.zoho.in')
NOREPLY_EMAIL_PORT = int(os.environ.get('NOREPLY_EMAIL_PORT', 587))
NOREPLY_EMAIL_USER = os.environ.get('NOREPLY_EMAIL_USER', 'noreply@eventloo.in')
NOREPLY_EMAIL_PASSWORD = os.environ.get('NOREPLY_EMAIL_PASSWORD', 'EyqVrVAGVEYP')
NOREPLY_FROM_EMAIL = os.environ.get('NOREPLY_FROM_EMAIL', 'Eventloo Security <noreply@eventloo.in>')

# Default contact credentials (Welcome emails, Staff invitations)
CONTACT_EMAIL_HOST = os.environ.get('CONTACT_EMAIL_HOST', 'smtp.zoho.in')
CONTACT_EMAIL_PORT = int(os.environ.get('CONTACT_EMAIL_PORT', 587))
CONTACT_EMAIL_USER = os.environ.get('CONTACT_EMAIL_USER', 'contact@eventloo.in')
CONTACT_EMAIL_PASSWORD = os.environ.get('CONTACT_EMAIL_PASSWORD', '9HfUJjAK07t5')
CONTACT_FROM_EMAIL = os.environ.get('CONTACT_FROM_EMAIL', 'Eventloo Team <contact@eventloo.in>')

