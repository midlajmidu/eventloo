from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse, HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView
from accounts.views import CustomTokenObtainPairView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import connection

User = get_user_model()

def health_check(request):
    """Readiness check: the process and its database must both be usable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:
        return JsonResponse(
            {"status": "unhealthy", "service": "eventloo-backend", "database": "unavailable"},
            status=503,
        )
    return JsonResponse(
        {"status": "healthy", "service": "eventloo-backend", "database": "available"}
    )

urlpatterns = [
    path('', health_check, name='health_check'),
    path('api/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('api/', include('accounts.urls')),
    path('api/', include('events.urls')),
]

if settings.ENABLE_DJANGO_ADMIN:
    urlpatterns.append(path('admin/', admin.site.urls))

# Serve static files in production
if not settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # Development static files
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 
