from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.utils import get_md5_hash_password
from secrets import compare_digest


class SchoolJWTAuthentication(JWTAuthentication):
    """Reject stale, suspended, or cross-school JWTs before view permissions run."""

    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)
        from django.conf import settings
        raw_token = request.COOKIES.get(settings.ACCESS_COOKIE_NAME)
        if not raw_token:
            return None
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def get_user(self, validated_token):
        from django.conf import settings

        user = super().get_user(validated_token)
        token_password_hash = validated_token.get('pwd')
        if not token_password_hash or not compare_digest(
            str(token_password_hash), get_md5_hash_password(user.password)
        ):
            raise AuthenticationFailed('This session has been revoked.')
        if validated_token.get('session_version') != user.session_version:
            raise AuthenticationFailed('This session has been revoked.')
        if user.role == 'super_admin' and user.school_id is None:
            if validated_token.get('access_type') != 'super_admin':
                raise AuthenticationFailed('Use a super-admin session for this account.')
            if settings.REQUIRE_SUPER_ADMIN_MFA and not user.mfa_enabled:
                raise AuthenticationFailed('Multi-factor authentication is required.')
            return user
        if not user.school_id or user.school.status != 'active':
            raise AuthenticationFailed('This school is not active.')
        token_school_id = validated_token.get('school_id')
        if token_school_id is None or str(token_school_id) != str(user.school_id):
            raise AuthenticationFailed('The session school scope is invalid.')
        if settings.REQUIRE_SCHOOL_STAFF_MFA and not user.mfa_enabled:
            raise AuthenticationFailed('Multi-factor authentication is required.')
        return user
