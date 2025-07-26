from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/', include('events.urls')),
]

# Serve React build files in production
if not settings.DEBUG:
    # Serve static files
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    
    # Serve React app for all non-API routes
    urlpatterns += [
        re_path(r'^(?!api/|admin/|static/|media/).*$', 
                TemplateView.as_view(template_name='index.html')),
    ]
else:
    # Development static files
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 