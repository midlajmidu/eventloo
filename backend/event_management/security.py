from django.conf import settings
from django.http import JsonResponse


class SecurityHeadersMiddleware:
    """Add defense-in-depth browser policies to every response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method not in {'GET', 'HEAD', 'OPTIONS', 'TRACE'}
            and request.path.startswith('/api/')
            and (
                request.COOKIES.get(settings.ACCESS_COOKIE_NAME)
                or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
            )
            and request.headers.get('X-Requested-With') != 'XMLHttpRequest'
        ):
            return JsonResponse({'error': 'Invalid request origin.'}, status=403)
        response = self.get_response(request)
        response.setdefault(
            'Content-Security-Policy',
            "default-src 'self'; base-uri 'self'; object-src 'none'; "
            "frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; "
            "font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
        )
        response.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
        response.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        return response
