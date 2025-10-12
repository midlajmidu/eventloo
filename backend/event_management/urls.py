from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve
from django.http import JsonResponse, HttpResponse
from rest_framework_simplejwt.views import TokenObtainPairView
from accounts.views import CustomTokenObtainPairView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction
import os

User = get_user_model()

def health_check(request):
    """Health check endpoint for Cloud Run"""
    return JsonResponse({"status": "healthy", "service": "eventloo-backend"})

def test_api(request):
    """Test API endpoint"""
    return JsonResponse({"message": "API is working", "endpoints": ["accounts", "events"]})

def serve_media_file(request, path):
    """Custom media file serving with proper headers"""
    file_path = os.path.join(settings.MEDIA_ROOT, path)
    if os.path.exists(file_path):
        with open(file_path, 'rb') as f:
            response = HttpResponse(f.read())
            response['Content-Type'] = 'application/octet-stream'
            response['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
            return response
    return HttpResponse('File not found', status=404)

urlpatterns = [
    path('', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/test/', test_api, name='test_api'),
    path('api/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('api/', include('accounts.urls')),
    path('api/', include('events.urls')),
]

# Serve static files in production
if not settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Custom media file serving for production
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve_media_file, name='media'),
    ]
else:
    # Development static files
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 