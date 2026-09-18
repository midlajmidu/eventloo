from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    scope = 'login'


class UploadRateThrottle(ScopedRateThrottle):
    scope = 'uploads'


class ExportRateThrottle(ScopedRateThrottle):
    scope = 'exports'
