from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import CustomTokenObtainPairSerializer, UserSerializer, SchoolUserSerializer, StudentSerializer, StudentCreateUpdateSerializer, TeamManagerLoginSerializer, TeamManagerResponseSerializer, SchoolSerializer, SchoolCreateSerializer
from rest_framework import viewsets, status, filters, permissions
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q, Sum, Count
from .models import User, School, SchoolSettings, StudentCategory, StudentClass
from events.permissions import CanManageStudents, IsTeamManagerOrAdmin, TeamManagerAuthentication, IsSuperAdmin, IsAdminOrEventManager, IsApplicationStaff, IsSchoolAdmin, IsSameSchool
from .authentication import SchoolJWTAuthentication
from events.pagination import StandardPagination, LargePagination, SmallPagination
import pandas as pd
import re
import random
import string
import secrets
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password
from .throttles import LoginRateThrottle, UploadRateThrottle
import hashlib
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone
from events.models import Team, Event, Program, ProgramAssignment, PointsRecord as EventPointsRecord
from datetime import datetime
from difflib import SequenceMatcher
from .serializers import SchoolSettingsSerializer
from django.conf import settings
from .upload_security import (
    validate_excel_upload,
    validate_excel_shape,
)
from .security_audit import audit_security_event
from .mfa import generate_totp_secret, matching_totp_step, provisioning_uri, verify_totp
from .quotas import lock_and_enforce_quota
import logging

logger = logging.getLogger(__name__)


def set_auth_cookies(response, refresh_token, access_token):
    samesite = getattr(settings, 'REFRESH_COOKIE_SAMESITE', 'Lax') or 'Lax'
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=samesite,
        path='/',
    )
    response.set_cookie(
        settings.ACCESS_COOKIE_NAME,
        access_token,
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=samesite,
        path='/',
    )
    return response

def get_paginated_response(data, request, pagination_class=StandardPagination):
    """Helper function to get paginated response for API views"""
    paginator = pagination_class()
    page = paginator.paginate_queryset(data, request)
    if page is not None:
        return paginator.get_paginated_response(page)
    return Response(data)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
            return Response({'error': 'Invalid authentication request.'}, status=400)
        candidate = _authenticate_school_staff_credentials(request)
        if candidate and (settings.REQUIRE_SCHOOL_STAFF_MFA or candidate.mfa_enabled):
            if not candidate.mfa_enabled:
                audit_security_event(request, 'school_login', 'mfa_setup_required', actor=candidate)
                return Response({
                    'error': 'Multi-factor authentication setup is required.',
                    'code': 'mfa_setup_required',
                }, status=status.HTTP_403_FORBIDDEN)
            matched_step = matching_totp_step(candidate.mfa_secret, request.data.get('otp'))
            if matched_step is None or not _consume_mfa_step(candidate, matched_step):
                audit_security_event(request, 'school_login', 'mfa_denied', actor=candidate)
                return Response({
                    'error': 'A valid unused authenticator code is required.',
                    'code': 'mfa_required',
                }, status=status.HTTP_401_UNAUTHORIZED)
        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            audit_security_event(request, 'school_login', 'denied')
            raise
        refresh = response.data.pop('refresh', None)
        access = response.data.pop('access', None)
        if refresh and access:
            set_auth_cookies(response, refresh, access)
        audit_security_event(request, 'school_login', 'success', actor=response.data.get('user'))
        return response


def _consume_mfa_step(user, matched_step):
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        if locked_user.mfa_last_used_step is not None and matched_step <= locked_user.mfa_last_used_step:
            return False
        locked_user.mfa_last_used_step = matched_step
        locked_user.save(update_fields=['mfa_last_used_step'])
    return True


def _authenticate_school_staff_credentials(request):
    email = str(request.data.get('email', '')).strip().lower()
    school_code = str(request.data.get('school_code', '')).strip().lower()
    user = authenticate(request, email=email, password=request.data.get('password', ''))
    if not user or user.role not in ('admin', 'event_manager') or not user.is_active:
        return None
    if not user.school_id or user.school.status != 'active':
        return None
    if school_code and user.school.code != school_code:
        return None
    return user


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def school_staff_mfa_setup(request):
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    user = _authenticate_school_staff_credentials(request)
    if not user:
        audit_security_event(request, 'school_mfa_setup', 'denied')
        return Response({'error': 'Invalid school code or credentials.'}, status=401)
    if user.mfa_enabled:
        return Response({'error': 'Multi-factor authentication is already enabled.'}, status=400)
    if not user.mfa_secret:
        user.mfa_secret = generate_totp_secret()
        user.save(update_fields=['mfa_secret'])
    audit_security_event(request, 'school_mfa_setup', 'started', actor=user)
    return Response({
        'secret': user.mfa_secret,
        'provisioning_uri': provisioning_uri(user, user.mfa_secret),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def school_staff_mfa_confirm(request):
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    user = _authenticate_school_staff_credentials(request)
    if not user:
        audit_security_event(request, 'school_mfa_confirm', 'denied')
        return Response({'error': 'Invalid school code or credentials.'}, status=401)
    if not user.mfa_secret or not verify_totp(user.mfa_secret, request.data.get('otp')):
        audit_security_event(request, 'school_mfa_confirm', 'denied', actor=user)
        return Response({'error': 'Invalid authenticator code.'}, status=400)
    user.mfa_enabled = True
    user.session_version += 1
    user.save(update_fields=['mfa_enabled', 'session_version'])
    audit_security_event(request, 'school_mfa_confirm', 'success', actor=user)
    return Response({'message': 'Multi-factor authentication enabled.'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """Revoke the supplied refresh token; clients then clear local session state."""
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    refresh_value = request.data.get('refresh') or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
    outcome = 'cleared'
    if refresh_value:
        try:
            RefreshToken(refresh_value).blacklist()
            outcome = 'revoked'
        except Exception:
            # Always clear client cookies and do not disclose token validity.
            outcome = 'stale_token_cleared'
    response = Response(status=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path='/api/')
    response.delete_cookie(settings.ACCESS_COOKIE_NAME, path='/api/')
    audit_security_event(request, 'logout', outcome)
    return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def super_admin_login(request):
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    email = str(request.data.get('email', '')).strip().lower()
    password = request.data.get('password', '')
    user = authenticate(request, email=email, password=password)
    if not user:
        user_candidate = User.objects.filter(role='super_admin', school__isnull=True).filter(
            Q(email__iexact=email) | Q(username__iexact=email)
        ).first()
        if user_candidate and user_candidate.check_password(password):
            user = user_candidate
    if not user or user.role != 'super_admin' or user.school_id is not None:
        audit_security_event(request, 'super_admin_login', 'denied')
        return Response({'error': 'Invalid super-admin credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        audit_security_event(request, 'super_admin_login', 'denied', actor=user)
        return Response({'error': 'This account is inactive.'}, status=status.HTTP_403_FORBIDDEN)
    if (settings.REQUIRE_SUPER_ADMIN_MFA or user.mfa_enabled) and not user.mfa_enabled:
        audit_security_event(request, 'super_admin_login', 'mfa_setup_required', actor=user)
        return Response({
            'error': 'Multi-factor authentication setup is required.',
            'code': 'mfa_setup_required',
        }, status=status.HTTP_403_FORBIDDEN)
    if user.mfa_enabled:
        matched_step = matching_totp_step(user.mfa_secret, request.data.get('otp'))
        if matched_step is None:
            audit_security_event(request, 'super_admin_login', 'mfa_denied', actor=user)
            return Response({
                'error': 'A valid authenticator code is required.',
                'code': 'mfa_required',
            }, status=status.HTTP_401_UNAUTHORIZED)
        if not _consume_mfa_step(user, matched_step):
            audit_security_event(request, 'super_admin_login', 'mfa_replay_denied', actor=user)
            return Response({
                'error': 'That authenticator code has already been used.',
                'code': 'mfa_required',
            }, status=status.HTTP_401_UNAUTHORIZED)
    refresh = RefreshToken.for_user(user)
    refresh['access_type'] = 'super_admin'
    refresh['role'] = 'super_admin'
    refresh['pwd'] = get_md5_hash_password(user.password)
    refresh['session_version'] = user.session_version
    access = refresh.access_token
    access['access_type'] = 'super_admin'
    access['role'] = 'super_admin'
    access['pwd'] = get_md5_hash_password(user.password)
    access['session_version'] = user.session_version
    response = Response({
        'access': str(access),
        'refresh': str(refresh),
        'token': str(access),
        'user': {'id': user.id, 'email': user.email, 'name': user.display_name, 'role': user.role},
    })
    audit_security_event(request, 'super_admin_login', 'success', actor=user)
    return set_auth_cookies(response, str(refresh), str(access))


def _authenticate_super_admin_credentials(request):
    email = str(request.data.get('email', '')).strip().lower()
    password = request.data.get('password', '')
    user = authenticate(request, email=email, password=password)
    if not user:
        user_candidate = User.objects.filter(role='super_admin', school__isnull=True).filter(
            Q(email__iexact=email) | Q(username__iexact=email)
        ).first()
        if user_candidate and user_candidate.check_password(password):
            user = user_candidate
    if not user or user.role != 'super_admin' or user.school_id is not None or not user.is_active:
        return None
    return user


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def super_admin_mfa_setup(request):
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    user = _authenticate_super_admin_credentials(request)
    if not user:
        audit_security_event(request, 'super_admin_mfa_setup', 'denied')
        return Response({'error': 'Invalid super-admin credentials.'}, status=401)
    if user.mfa_enabled:
        return Response({'error': 'Multi-factor authentication is already enabled.'}, status=400)
    if not user.mfa_secret:
        user.mfa_secret = generate_totp_secret()
        user.save(update_fields=['mfa_secret'])
    audit_security_event(request, 'super_admin_mfa_setup', 'started', actor=user)
    return Response({
        'secret': user.mfa_secret,
        'provisioning_uri': provisioning_uri(user, user.mfa_secret),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def super_admin_mfa_confirm(request):
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    user = _authenticate_super_admin_credentials(request)
    if not user:
        audit_security_event(request, 'super_admin_mfa_confirm', 'denied')
        return Response({'error': 'Invalid super-admin credentials.'}, status=401)
    if not user.mfa_secret or not verify_totp(user.mfa_secret, request.data.get('otp')):
        audit_security_event(request, 'super_admin_mfa_confirm', 'denied', actor=user)
        return Response({'error': 'Invalid authenticator code.'}, status=400)
    user.mfa_enabled = True
    user.session_version += 1
    user.save(update_fields=['mfa_enabled', 'session_version'])
    audit_security_event(request, 'super_admin_mfa_confirm', 'success', actor=user)
    return Response({'message': 'Multi-factor authentication enabled.'})


class SuperAdminSchoolViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSuperAdmin]
    pagination_class = SmallPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code', 'email', 'phone']
    queryset = School.objects.all()

    def get_queryset(self):
        return School.objects.annotate(
            admin_count=Count('users', filter=Q(users__role='admin'), distinct=True),
            user_count=Count('users', filter=~Q(users__role='student'), distinct=True),
            student_count=Count('users', filter=Q(users__role='student'), distinct=True),
            event_count=Count('events', distinct=True),
        ).order_by('name')

    def get_serializer_class(self):
        return SchoolCreateSerializer if self.action == 'create' else SchoolSerializer

    def perform_create(self, serializer):
        school = serializer.save()
        audit_security_event(
            self.request, 'school_create', 'success', school_id=school.id, target=school.id
        )

    def perform_update(self, serializer):
        school = serializer.save()
        SchoolSettings.objects.filter(school=school).update(
            school_name=school.name,
            school_email=school.email,
            school_phone=school.phone,
            school_address=school.address,
        )
        audit_security_event(
            self.request, 'school_update', 'success', school_id=school.id, target=school.id
        )

    def destroy(self, request, *args, **kwargs):
        from django.db import transaction

        school = self.get_object()
        deleted_school_id = school.id
        confirmation = str(request.data.get('confirm_name', '')).strip()
        if confirmation != school.name:
            return Response(
                {'confirm_name': ['Type the exact school name to confirm deletion.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # User.school is protected to prevent accidental deletion elsewhere.
            # This explicit super-admin action removes tenant users first; their
            # dependent records and the remaining school data then cascade safely.
            school.users.all().delete()
            school.delete()
        audit_security_event(
            request, 'school_delete', 'success',
            school_id=deleted_school_id, target=deleted_school_id,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post'])
    def admins(self, request, pk=None):
        school = self.get_object()
        if request.method == 'GET':
            return Response(UserSerializer(school.users.filter(role='admin'), many=True).data)
        email = str(request.data.get('email', '')).strip().lower()
        name = str(request.data.get('name', '')).strip()
        password = request.data.get('password', '')
        if not email or not name or not password:
            return Response({'error': 'Name, email and password are required.'}, status=400)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'An account with this email already exists.'}, status=400)
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(password)
        except ValidationError as exc:
            return Response({'error': exc.messages}, status=400)
        with transaction.atomic():
            school = lock_and_enforce_quota(school.id, 'users')
            admin = User.objects.create_user(
                username=email, email=email, password=password, name=name,
                role='admin', school=school, is_staff=False, is_superuser=False,
            )
        audit_security_event(
            request, 'school_admin_create', 'success', school_id=school.id, target=admin.id
        )
        return Response(UserSerializer(admin).data, status=201)

    @action(detail=True, methods=['post'], url_path='reset-admin-password')
    def reset_admin_password(self, request, pk=None):
        school = self.get_object()
        admin = school.users.filter(pk=request.data.get('admin_id'), role='admin').first()
        password = request.data.get('password', '')
        if not admin:
            return Response({'error': 'School administrator not found.'}, status=404)
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(password, admin)
        except ValidationError as exc:
            return Response({'error': exc.messages}, status=400)
        admin.set_password(password)
        admin.session_version += 1
        admin.save(update_fields=['password', 'session_version'])
        audit_security_event(
            request, 'school_admin_password_reset', 'success',
            school_id=school.id, target=admin.id,
        )
        return Response({'message': 'Administrator password reset successfully.'})

    @action(detail=True, methods=['post'], url_path='reset-staff-mfa')
    def reset_staff_mfa(self, request, pk=None):
        """Clear MFA only after an authenticated platform admin confirms identity."""
        school = self.get_object()
        staff_user = school.users.filter(
            pk=request.data.get('staff_id'), role__in=('admin', 'event_manager')
        ).first()
        if not staff_user:
            return Response({'error': 'School staff account not found.'}, status=404)
        confirmation = str(request.data.get('confirm_email', '')).strip().lower()
        if confirmation != str(staff_user.email or '').lower():
            return Response(
                {'confirm_email': ['Type the exact staff email to confirm the MFA reset.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        staff_user.mfa_secret = ''
        staff_user.mfa_enabled = False
        staff_user.mfa_last_used_step = None
        staff_user.session_version += 1
        staff_user.save(update_fields=[
            'mfa_secret', 'mfa_enabled', 'mfa_last_used_step', 'session_version'
        ])
        audit_security_event(
            request, 'school_staff_mfa_reset', 'success',
            school_id=school.id, target=staff_user.id,
        )
        return Response({'message': 'Staff MFA reset. Enrollment is required at next login.'})

    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        school = self.get_object()
        from events.models import Event
        events = Event.objects.filter(school=school).order_by('-created_at')
        data = [{
            'id': e.id,
            'name': e.name,
            'status': e.status,
            'event_type': getattr(e, 'event_type', 'standard'),
            'start_date': str(e.start_date) if e.start_date else None,
            'end_date': str(e.end_date) if e.end_date else None,
            'venue': getattr(e, 'venue', '') or '',
            'teams_count': e.teams.count(),
            'created_at': e.created_at.isoformat() if e.created_at else None,
        } for e in events]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='all-admins')
    def all_admins(self, request):
        admins = User.objects.filter(role='admin', school__isnull=False).select_related('school').order_by('-date_joined')
        data = [{
            'id': u.id,
            'name': u.name or u.email,
            'email': u.email,
            'school_id': u.school_id,
            'school_name': u.school.name if u.school else 'N/A',
            'school_code': u.school.code if u.school else '',
            'is_active': u.is_active,
            'date_joined': u.date_joined.isoformat() if u.date_joined else None,
        } for u in admins]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='all-events')
    def all_events(self, request):
        from events.models import Event
        events = Event.objects.filter(school__isnull=False).select_related('school').order_by('-created_at')[:50]
        data = [{
            'id': e.id,
            'name': e.name,
            'school_id': e.school_id,
            'school_name': e.school.name if e.school else 'N/A',
            'school_code': e.school.code if e.school else '',
            'status': e.status,
            'event_type': getattr(e, 'event_type', 'standard'),
            'start_date': str(e.start_date) if e.start_date else None,
            'end_date': str(e.end_date) if e.end_date else None,
            'venue': getattr(e, 'venue', '') or '',
            'teams_count': e.teams.count(),
            'created_at': e.created_at.isoformat() if e.created_at else None,
        } for e in events]
        return Response(data)


class SchoolUserViewSet(viewsets.ModelViewSet):
    """Let a school administrator manage only staff accounts in their tenant."""

    permission_classes = [IsSchoolAdmin]
    serializer_class = SchoolUserSerializer
    pagination_class = SmallPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'email']

    def get_queryset(self):
        queryset = User.objects.filter(
            school=self.request.user.school,
            role__in=('admin', 'event_manager'),
        ).order_by('-is_active', 'name', 'email')
        status_filter = self.request.query_params.get('status')
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)
        role = self.request.query_params.get('role')
        if role in ('admin', 'event_manager'):
            queryset = queryset.filter(role=role)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        school = lock_and_enforce_quota(self.request.user.school_id, 'users')
        # The serializer derives tenant scope from request.user; retaining the
        # locked school through the transaction makes this check race-safe.
        user = serializer.save()
        audit_security_event(
            self.request, 'school_user_create', 'success',
            school_id=self.request.user.school_id, target=user.id,
        )

    def perform_update(self, serializer):
        target = self.get_object()
        if target.pk == self.request.user.pk:
            requested_role = serializer.validated_data.get('role', target.role)
            requested_active = serializer.validated_data.get('is_active', target.is_active)
            if requested_role != 'admin' or not requested_active:
                from rest_framework.exceptions import ValidationError as DRFValidationError
                raise DRFValidationError('You cannot remove your own administrator access.')
        user = serializer.save()
        audit_security_event(
            self.request, 'school_user_update', 'success',
            school_id=self.request.user.school_id, target=user.id,
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {'error': 'You cannot delete your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_id = user.id
        user.delete()
        audit_security_event(
            request, 'school_user_delete', 'success',
            school_id=request.user.school_id, target=user_id,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        queryset = User.objects.filter(
            school=request.user.school,
            role__in=('admin', 'event_manager'),
        )
        return Response({
            'total': queryset.count(),
            'active': queryset.filter(is_active=True).count(),
            'inactive': queryset.filter(is_active=False).count(),
        })


@api_view(['GET'])
@permission_classes([IsSuperAdmin])
def super_admin_dashboard(request):
    import platform
    import django
    from events.models import Event

    try:
        total_schools = School.objects.count()
        active_schools = School.objects.filter(status='active').count()
        suspended_schools = School.objects.filter(status='suspended').count()
        total_admins = User.objects.filter(role='admin', school__isnull=False).count()
        total_students = User.objects.filter(role='student', school__isnull=False).count()
        total_events = Event.objects.filter(school__isnull=False).count()
        active_events = Event.objects.filter(school__isnull=False, status__in=['published', 'ongoing']).count()

        recent_schools = [{
            'id': s.id,
            'name': s.name,
            'code': s.code,
            'status': s.status,
            'email': s.email,
            'admin_count': s.users.filter(role='admin').count(),
            'event_count': s.events.count(),
            'student_count': s.users.filter(role='student').count(),
            'created_at': s.created_at.isoformat() if s.created_at else None,
        } for s in School.objects.order_by('-created_at')[:8]]

        recent_events = [{
            'id': e.id,
            'name': e.name,
            'school_id': e.school_id,
            'school_name': e.school.name if e.school else 'N/A',
            'status': e.status,
            'event_type': getattr(e, 'event_type', 'standard'),
            'teams_count': e.teams.count(),
            'created_at': e.created_at.isoformat() if e.created_at else None,
        } for e in Event.objects.select_related('school').order_by('-created_at')[:8]]
    except Exception as exc:
        logger.exception("Error loading super_admin_dashboard telemetry: %s", exc)
        total_schools = School.objects.count()
        active_schools = School.objects.filter(status='active').count()
        suspended_schools = School.objects.filter(status='suspended').count()
        total_admins = User.objects.filter(role='admin', school__isnull=False).count()
        total_students = 0
        total_events = 0
        active_events = 0
        recent_schools = []
        recent_events = []

    return Response({
        'schools': total_schools,
        'active_schools': active_schools,
        'suspended_schools': suspended_schools,
        'school_admins': total_admins,
        'students': total_students,
        'events': total_events,
        'active_events': active_events,
        'recent_schools': recent_schools,
        'recent_events': recent_events,
        'system': {
            'platform': f'{platform.system()} {platform.machine()}',
            'python_version': platform.python_version(),
            'django_version': django.get_version(),
            'server_status': 'healthy',
            'ssl_active': True,
        }
    })

@api_view(['GET'])
@permission_classes([IsApplicationStaff])
def user_profile(request):
    """Get current user profile"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsSameSchool])
def school_settings(request):
    """Get school settings including logo"""
    settings = SchoolSettings.get_settings(request.user.school)
    return Response({
        'school_name': settings.school_name,
        'school_logo': settings.school_logo,
        'primary_color': settings.primary_color,
        'secondary_color': settings.secondary_color,
    })

@api_view(['GET'])
@permission_classes([IsSchoolAdmin])
def admin_dashboard_summary(request):
    """Get dashboard summary data for admin, including global points and event breakdowns"""
    # Check if user is admin
    if request.user.role != 'admin':
        return Response({'error': 'Access denied'}, status=403)
    
    # Get actual data from database
    from events.models import Event, Team, PointsRecord

    school = request.user.school
    total_events = Event.objects.filter(school=school).count()
    active_events = Event.objects.filter(
        school=school, status__in=['published', 'ongoing']
    ).count()
    completed_events = Event.objects.filter(school=school, status='completed').count()
    total_teams = Team.objects.filter(school=school).count()
    total_students = User.objects.filter(role='student', school=school).count()
    students_in_teams = User.objects.filter(
        role='student', school=school, team_memberships__school=school
    ).distinct().count()
    total_programs = Program.objects.filter(event__school=school).count()

    # Use the same published-results calculation as the Points page.
    from events.services import calculate_global_points_for_school
    canonical_global_points = calculate_global_points_for_school(school)
    global_by_team = {item['id']: item for item in canonical_global_points['teams']}
    teams_with_points = []
    teams = Team.objects.filter(school=school).prefetch_related('members', 'program_assignments__program__event')
    
    students_by_team = []
    for team in teams:
        students_by_team.append({
            'id': team.id,
            'name': team.name,
            # Team membership is school-wide and includes every registered
            # student, regardless of whether they joined an event program.
            'students': team.member_count,
        })
        score = global_by_team.get(team.id, {})
        
        teams_with_points.append({
            'id': team.id,
            'name': team.name,
            'global_points': score.get('global_points', 0),
            'members': team.member_count,
            'events_participated': score.get('events_participated', 0),
            'event_breakdown': score.get('event_breakdown', []),
        })

    # A participant is a student with at least one program assignment in any
    # event owned by this school. Count each student once in their own category.
    participants_by_category = []
    for category in StudentCategory.objects.filter(school=school, is_active=True).order_by('id'):
        participant_count = User.objects.filter(
            role='student',
            school=school,
            category=category.code,
            program_assignments__program__event__school=school,
        ).distinct().count()
        participants_by_category.append({
            'id': category.id,
            'name': category.name,
            'code': category.code,
            'participants': participant_count,
        })
    
    # Sort by points and take top 4
    teams_with_points.sort(key=lambda x: x['global_points'], reverse=True)
    teams_with_points = teams_with_points[:4]

    points_by_team = []
    for team in teams_with_points:
        points_by_team.append({
            'id': team['id'],
            'name': team['name'],
            'points': team['global_points'],
            'students': team['members'],
            'events_participated': team['events_participated'],
            'event_breakdown': team['event_breakdown'],
        })

    # Get recent activities
    recent_activities = []
    recent_points = EventPointsRecord.objects.filter(school=school).select_related('team', 'student', 'event')[:5]
    for record in recent_points:
        recipient = record.team.name if record.team else record.student.display_name
        recent_activities.append({
            'id': record.id,
            'action': f"{recipient} earned {record.points} points for {record.reason}",
            'time': record.awarded_at.strftime('%H:%M'),
            'type': 'points'
        })
    
    dashboard_data = {
        'totalEvents': total_events,
        'activeEvents': active_events,
        'completedEvents': completed_events,
        'totalTeams': total_teams,
        'totalStudents': total_students,
        'studentsInTeams': students_in_teams,
        'unassignedStudents': max(total_students - students_in_teams, 0),
        'totalPrograms': total_programs,
        'studentsByTeam': students_by_team,
        'participantsByCategory': participants_by_category,
        'pointsByTeam': points_by_team,
        'topTeams': points_by_team,  # Add this for compatibility
        'recentActivities': recent_activities
    }
    
    return Response(dashboard_data)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_dashboard(request):
    """Get dashboard data for team managers"""
    if request.user.role != 'team_manager':
        return Response({'error': 'Access denied'}, status=403)
    
    from events.models import Team, Event, PointsRecord, ProgramResult
    from django.db.models import Sum
    
    # Get teams managed by this team manager
    if getattr(request.user, 'team_id', None):
        managed_teams = Team.objects.filter(id=request.user.team_id)
    else:
        managed_teams = Team.objects.filter(team_manager=request.user)
    
    # Get events these teams are participating in
    events = Event.objects.filter(programs__assignments__team__in=managed_teams).distinct()
    
    # Get students in managed teams
    students = User.objects.filter(
        Q(team_memberships__in=managed_teams)
    ).distinct()
    
    # Get recent points for managed teams
    recent_points = EventPointsRecord.objects.filter(
        team__in=managed_teams
    ).select_related('team', 'event')[:5]
    
    recent_activities = []
    for record in recent_points:
        team_name = record.team.name if record.team else 'Team'
        time_str = record.awarded_at.strftime('%H:%M') if record.awarded_at else ''
        recent_activities.append({
            'id': record.id,
            'action': f"{team_name} earned {record.points} points for {record.reason or 'participation'}",
            'time': time_str,
            'type': 'points'
        })
    
    from events.services import calculate_global_points_for_school
    global_scores = calculate_global_points_for_school(request.user.school)
    global_by_team = {item['id']: item for item in (global_scores.get('teams', []) if isinstance(global_scores, dict) else [])}

    # Calculate global points for each managed team
    teams_with_global_points = []
    for team in managed_teams:
        score = global_by_team.get(team.id, {})
        
        teams_with_global_points.append({
            'id': team.id,
            'name': team.name,
            'points': team.points_earned,  # Keep original points for backward compatibility
            'global_points': score.get('global_points', 0),
            'members': team.member_count,
            'events_participated': score.get('events_participated', 0),
            'event_breakdown': score.get('event_breakdown', []),
        })
    
    dashboard_data = {
        'totalTeams': managed_teams.count(),
        'totalEvents': events.count(),
        'totalStudents': students.count(),
        'recentActivities': recent_activities,
        'teams': teams_with_global_points
    }
    
    return Response(dashboard_data)

@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
@throttle_classes([LoginRateThrottle])
def team_manager_login(request):
    """Team manager login using team credentials"""
    if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return Response({'error': 'Invalid authentication request.'}, status=400)
    serializer = TeamManagerLoginSerializer(data=request.data)
    
    if serializer.is_valid():
        team = serializer.validated_data['team']
        
        # Create a response with team information
        team_data = TeamManagerResponseSerializer(team).data
        
        # Create a JWT token for team authentication
        from rest_framework_simplejwt.tokens import RefreshToken
        # Team tokens are scoped principals; they never impersonate an admin user.
        refresh = RefreshToken()
        refresh['team_id'] = team.id
        refresh['school_id'] = team.school_id
        refresh['team_name'] = team.name
        refresh['access_type'] = 'team_manager'
        refresh['credential_hash'] = hashlib.sha256(team.team_password.encode()).hexdigest()
        refresh.outstand()
        
        # Ensure access token has custom claims
        access = refresh.access_token
        access['team_id'] = team.id
        access['school_id'] = team.school_id
        access['team_name'] = team.name
        access['access_type'] = 'team_manager'
        access['credential_hash'] = refresh['credential_hash']
        
        response_data = {
            'success': True,
            'message': f'Welcome, {team.name}!',
            'team': team_data,
            'access_type': 'team_manager',
            'school': {'id': team.school_id, 'name': team.school.name, 'code': team.school.code},
        }
        response = Response(response_data, status=status.HTTP_200_OK)
        audit_security_event(
            request, 'team_manager_login', 'success', school_id=team.school_id,
            target=team.id,
        )
        return set_auth_cookies(response, str(refresh), str(access))

    audit_security_event(request, 'team_manager_login', 'denied')
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_profile(request, team_id):
    """Get team manager profile and team details"""
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        
        # Get team members
        members = team.members.all()
        member_data = []
        
        for member in members:
            member_data.append({
                'id': member.id,
                'name': member.display_name,
                'student_id': member.student_id,
                'gender': member.gender,
                'category': member.category,
                'grade': member.grade,
                'section': member.section,
                'total_points': member.total_points
            })
        
        # Get team's events
        events = Event.objects.filter(programs__assignments__team=team).distinct()
        event_data = []
        
        for event in events:
            event_data.append({
                'id': event.id,
                'title': event.title,
                'event_type': event.event_type,
                'status': event.status,
                'start_date': event.start_date,
                'end_date': event.end_date
            })
        
        # Get team's program assignments
        from events.models import ProgramAssignment
        assignments = ProgramAssignment.objects.filter(team=team).select_related('program', 'student')
        assignment_data = []
        
        for assignment in assignments:
            assignment_data.append({
                'id': assignment.id,
                'program_name': assignment.program.name,
                'program_category': assignment.program.category,
                'student_name': assignment.student.display_name,
                'chest_number': assignment.chest_number,
                'assigned_at': assignment.assigned_at
            })
        
        profile_data = {
            'team': {
                'id': team.id,
                'name': team.name,
                'description': team.description,
                'points_earned': team.points_earned,
                'position': team.position,
                'team_number': team.team_number,
                'member_count': team.member_count,
                'created_at': team.created_at
            },
            'members': member_data,
            'events': event_data,
            'assignments': assignment_data
        }
        
        return Response(profile_data, status=status.HTTP_200_OK)
        
    except Team.DoesNotExist:
        return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_students(request, team_id):
    """Get team's students with their points"""
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        members = team.members.all()
        
        student_data = []
        for member in members:
            # Get student's points from different sources
            from events.models import PointsRecord
            event_points = PointsRecord.objects.filter(student=member, team=team).aggregate(
                total=Sum('points')
            )['total'] or 0
            
            student_data.append({
                'id': member.id,
                'name': member.display_name,
                'student_id': member.student_id,
                'gender': member.gender,
                'category': member.category,
                'grade': member.grade,
                'section': member.section,
                'total_points': member.total_points,
                'team_points': event_points,
                'chest_code': member.chest_code
            })
        
        return Response({
            'students': student_data,
            'total_students': len(student_data)
        })
        
    except Team.DoesNotExist:
        return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_events(request, team_id):
    """Get all events for a team manager (paginated)"""
    try:
        from events.models import Team, Event, Program, ProgramAssignment

        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        # Get all active events (published, ongoing, or completed)
        events = Event.objects.filter(
            school_id=request.user.school_id,
            status__in=['published', 'ongoing', 'completed']
        ).distinct().order_by('-start_date')

        # Build event data list
        event_data = []
        for event in events:
            # Get programs for this event
            programs = Program.objects.filter(event=event)
            program_data = []
            for program in programs:
                # Get assignments for this team in this program
                team_assignments = ProgramAssignment.objects.filter(team=team, program=program)
                assigned_students = [a.student_id for a in team_assignments]
                program_data.append({
                    'id': program.id,
                    'name': program.name,
                    'category': program.category,
                    'is_team_based': program.is_team_based,
                    'assigned_students': assigned_students,
                })
            event_data.append({
                'id': event.id,
                'title': event.title,
                'event_type': event.event_type,
                'status': event.status,
                'start_date': event.start_date,
                'end_date': event.end_date,
                'registration_deadline': event.registration_deadline,
                'is_registration_open': event.is_registration_open,
                'venue': event.venue,
                'description': event.description,
                'programs': program_data,
                'total_programs': len(program_data)
            })

        return Response({
            'events': event_data,
            'total_events': len(event_data)
        })
        
    except Team.DoesNotExist:
        return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_available_programs(request):
    """Get all available programs for team managers"""
    try:
        from events.models import Program, Event
        from events.pagination import SmallPagination
        from events.serializers import ProgramSerializer
        
        # Get all active programs from published/ongoing events
        programs = Program.objects.filter(
            event__school_id=request.user.school_id,
            event__status__in=['published', 'ongoing'],
            is_active=True
        ).select_related('event').order_by('event__start_date', 'start_time')
        
        # Apply pagination
        paginator = SmallPagination()
        page = paginator.paginate_queryset(programs, request)
        if page is not None:
            serializer = ProgramSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = ProgramSerializer(programs, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.exception('Failed to load available team-manager programs')
        return Response({'error': 'Unable to load programs.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_event_programs(request, team_id, event_id):
    """Get programs for a specific event and current assignments"""
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        from events.models import Event, Program, ProgramAssignment
        
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        programs = Program.objects.filter(event=event, is_active=True)
        
        program_data = []
        for program in programs:
            # Get current assignments for this team in this program
            team_assignments = ProgramAssignment.objects.filter(
                team=team, 
                program=program
            ).select_related('student')
            
            assigned_students = []
            for assignment in team_assignments:
                assigned_students.append({
                    'id': assignment.student.id,
                    'assignment_id': assignment.id,
                    'name': assignment.student.display_name,
                    'student_id': assignment.student.student_id,
                    'gender': assignment.student.gender,
                    'chest_number': assignment.chest_number,
                    'sub_team_number': getattr(assignment, 'sub_team_number', 1) or 1,
                    'is_leader': getattr(assignment, 'is_leader', False) or False,
                    'category': getattr(assignment.student, 'category', ''),
                    'grade': getattr(assignment.student, 'grade', ''),
                    'assigned_at': assignment.assigned_at
                })
            
            # Calculate limits and available slots based on program type
            if program.is_team_based:
                # For team-based programs, use team_size
                per_team_limit = (
                    (program.team_size or 0) * (program.max_teams_per_school or 1)
                )
                assigned_count = len(assigned_students)
                available_slots = max(0, per_team_limit - assigned_count) if per_team_limit > 0 else 0
                participation_type = 'Team'
                limit_description = f'Team size: {per_team_limit} members required'
            else:
                # For individual programs, max_participants represents participants per team
                per_team_limit = program.max_participants if program.max_participants else 1
                assigned_count = len(assigned_students)
                available_slots = per_team_limit - assigned_count if assigned_count < per_team_limit else 0
                participation_type = 'Individual'
                
                # Calculate total capacity (teams × participants per team)
                total_teams = Team.objects.filter(school_id=request.user.school_id).count()
                total_capacity = total_teams * per_team_limit
                total_assigned = ProgramAssignment.objects.filter(program=program).count()
                
                limit_description = f'{per_team_limit} participants per team (Total: {total_assigned}/{total_capacity} - {per_team_limit} × {total_teams} teams)'
            
            program_data.append({
                'id': program.id,
                'name': program.name,
                'category': program.category,
                'program_type': program.program_type,
                'participation_type': participation_type,
                'is_team_based': program.is_team_based,
                'is_active': program.is_active,
                'is_finished': program.is_finished,
                'start_time': program.start_time,
                'max_participants': program.max_participants,  # Overall limit for individual programs
                'max_participants_per_team': getattr(program, 'max_participants_per_team', None),
                'team_size': program.team_size,  # Required team size for team-based programs
                'max_teams_per_school': getattr(program, 'max_teams_per_school', 1) or 1,
                'description': program.description,
                'assigned_students': assigned_students,
                'assigned_count': assigned_count,
                'available_slots': available_slots,
                'per_team_limit': per_team_limit,
                'limit_description': limit_description,
                'total_teams': Team.objects.filter(school_id=request.user.school_id).count()
            })
        
        # Get team members for assignment
        team_members = team.members.all()
        member_data = []
        for member in team_members:
            member_data.append({
                'id': member.id,
                'name': member.display_name,
                'student_id': member.student_id,
                'gender': member.gender,
                'category': member.category,
                'grade': member.grade,
                'section': member.section
            })
        
        return Response({
            'event': {
                'id': event.id,
                'title': event.title,
                'event_type': event.event_type,
                'status': event.status,
                'start_date': event.start_date,
                'end_date': event.end_date,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'venue': event.venue,
                'registration_deadline': event.registration_deadline,
                'registration_open': (
                    event.status in ('published', 'ongoing')
                    and (
                        not event.registration_deadline
                        or timezone.now() <= event.registration_deadline
                    )
                ),
                'is_registration_open': (
                    event.status in ('published', 'ongoing')
                    and (
                        not event.registration_deadline
                        or timezone.now() <= event.registration_deadline
                    )
                ),
            },
            'programs': program_data,
            'team_members': member_data,
            'total_programs': len(program_data)
        })
        
    except (Team.DoesNotExist, Event.DoesNotExist):
        return Response({'error': 'Team or Event not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_assign_student(request, team_id, event_id, program_id):
    """Assign participants through the shared transactional rule engine."""
    from events.models import Program
    from events.services import assign_students

    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        program = Program.objects.select_related('event').get(id=program_id, event_id=event_id)
        raw_ids = request.data.get('student_ids', [])
        student_ids = list(raw_ids) if isinstance(raw_ids, (list, tuple)) else []
        single_id = request.data.get('student_id')
        if single_id is not None and single_id not in student_ids:
            student_ids.append(single_id)
        assignments = assign_students(
            user=request.user,
            team=team,
            program=program,
            student_ids=student_ids,
            sub_team_number=request.data.get('sub_team_number', 1),
            leader_id=request.data.get('leader_id'),
            allow_partial_group=(len(student_ids) == 1),
        )
        return Response({
            'message': f'Successfully assigned {len(assignments)} participant(s).',
            'assignments_count': len(assignments),
            'assignment_ids': [assignment.id for assignment in assignments],
        }, status=status.HTTP_201_CREATED)
    except (Team.DoesNotExist, Program.DoesNotExist):
        return Response({'error': 'Team, event, or program not found.'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as exc:
        message = exc.messages[0] if getattr(exc, 'messages', None) else str(exc)
        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_remove_assignment(request, team_id, assignment_id):
    """Remove a student assignment from a program"""
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        from events.models import ProgramAssignment
        
        assignment = ProgramAssignment.objects.get(id=assignment_id, team=team)
        from events.services import remove_assignment_group
        remove_assignment_group(user=request.user, assignment=assignment)
        return Response({'message': 'Assignment group removed successfully'}, status=status.HTTP_200_OK)
        
    except (Team.DoesNotExist, ProgramAssignment.DoesNotExist):
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as exc:
        return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_set_subteam_leader(request, team_id, event_id, program_id):
    """Set or toggle the sub-team group leader"""
    from events.models import Event, Program, ProgramAssignment, User
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
        program = Program.objects.get(id=program_id, event=event)
    except (Team.DoesNotExist, Event.DoesNotExist, Program.DoesNotExist):
        return Response({'error': 'Resource not found'}, status=status.HTTP_404_NOT_FOUND)

    student_id = request.data.get('student_id')
    sub_team_number = request.data.get('sub_team_number', 1)

    if not student_id:
        return Response({'error': 'Student ID required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from events.services import set_subteam_leader
        set_subteam_leader(
            user=request.user,
            team=team,
            program=program,
            student_id=student_id,
            sub_team_number=sub_team_number,
        )
        return Response({'message': 'Sub-team leader updated successfully'}, status=status.HTTP_200_OK)
    except ValidationError as exc:
        return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@authentication_classes([TeamManagerAuthentication, SchoolJWTAuthentication])
@permission_classes([IsTeamManagerOrAdmin])
def team_manager_remove_student_from_program(request, team_id, event_id, program_id, student_id):
    """Remove a specific student from a specific program"""
    from events.models import Event, Program, ProgramAssignment, User
    
    try:
        team = Team.objects.get(id=team_id, school_id=request.user.school_id)
    except Team.DoesNotExist:
        return Response({'error': f'Team (ID: {team_id}) not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        event = Event.objects.get(id=event_id, school_id=request.user.school_id)
    except Event.DoesNotExist:
        return Response({'error': f'Event (ID: {event_id}) not found'}, status=status.HTTP_404_NOT_FOUND)

    # Check registration deadline for non-admin users
    from django.utils import timezone
    if event.registration_deadline and timezone.now() > event.registration_deadline:
        is_admin = request.user and request.user.is_authenticated and (request.user.is_superuser or getattr(request.user, 'role', '') in ['admin', 'event_manager'])
        if not is_admin:
            deadline_str = timezone.localtime(
                event.registration_deadline
            ).strftime('%d-%m-%Y %I:%M %p')
            return Response({
                'error': f'The registration deadline for entering team details has passed ({deadline_str} IST). You can no longer modify team assignments.'
            }, status=status.HTTP_403_FORBIDDEN)

    try:
        program = Program.objects.get(id=program_id, event=event)
    except Program.DoesNotExist:
        return Response({'error': f'Program (ID: {program_id}) not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        student = User.objects.get(id=student_id, role='student', school_id=request.user.school_id)
    except User.DoesNotExist:
        return Response({'error': f'Student (ID: {student_id}) not found'}, status=status.HTTP_404_NOT_FOUND)
        
    # Validate student belongs to team
    if not team.members.filter(id=student_id).exists():
        return Response({'error': 'Student does not belong to this team'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Find and delete the assignment
    try:
        assignment = ProgramAssignment.objects.get(
            team=team,
            program=program,
            student=student
        )
        from events.services import remove_assignment_group
        remove_assignment_group(user=request.user, assignment=assignment)
        return Response({'message': 'Assignment group removed successfully'}, status=status.HTTP_200_OK)
    except ProgramAssignment.DoesNotExist:
        return Response({'error': 'Student is not assigned to this program'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as exc:
        return Response({'error': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

class StudentViewSet(viewsets.ModelViewSet):
    """ViewSet for Student management"""
    serializer_class = StudentSerializer
    permission_classes = [CanManageStudents]
    pagination_class = StandardPagination
    
    def get_queryset(self):
        user = self.request.user
        
        # Base queryset
        queryset = User.objects.filter(role='student', school_id=user.school_id)
        
        # Filter based on user role
        if user.role == 'admin':
            # Admins can see all students
            pass
        elif user.role == 'team_manager':
            # Team managers can only see their team's students
            from events.models import Team
            token_team_id = getattr(user, 'team_id', None)
            if token_team_id is not None:
                managed_teams = Team.objects.filter(
                    id=token_team_id, school_id=user.school_id
                )
            else:
                managed_teams = Team.objects.filter(
                    team_manager=user, school_id=user.school_id
                )
            queryset = queryset.filter(
                Q(team_memberships__in=managed_teams)
            ).distinct()
        else:
            # Other users can't access students
            queryset = queryset.none()
        
        # Apply search filter
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(student_id__icontains=search) |
                Q(email__icontains=search)
            )
        
        # Apply category filter
        category = self.request.query_params.get('category', '')
        if category:
            queryset = queryset.filter(category=category)
        
        # Apply grade filter
        grade = self.request.query_params.get('grade', '')
        if grade:
            queryset = queryset.filter(grade=grade)
        
        # Apply section filter
        section = self.request.query_params.get('section', '')
        if section:
            queryset = queryset.filter(section=section)

        gender = self.request.query_params.get('gender', '')
        if gender in ('male', 'female', 'other'):
            queryset = queryset.filter(gender=gender)
        
        # Apply team filter
        team = self.request.query_params.get('team', '')
        if team:
            from events.models import Team
            if team == 'unassigned':
                # Show students not assigned to any team
                queryset = queryset.filter(team_memberships__isnull=True)
            else:
                # Show students assigned to specific team
                try:
                    team_obj = Team.objects.get(id=team, school=self.request.user.school)
                    queryset = queryset.filter(team_memberships=team_obj)
                except Team.DoesNotExist:
                    queryset = queryset.none()
        
        return queryset.order_by('first_name', 'last_name')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StudentCreateUpdateSerializer
        return StudentSerializer
    
    def get_permissions(self):
        """Only admins can manage students"""
        if self.action in [
            'create', 'update', 'partial_update', 'destroy', 'assign_to_team',
            'remove_from_team',
            'bulk_upload', 'download_template',
        ]:
            return [IsSchoolAdmin()]
        return [IsSchoolAdmin()]
    
    @transaction.atomic
    def perform_create(self, serializer):
        """Create student with auto-generated password, student_id, and chest_code"""
        from datetime import datetime

        lock_and_enforce_quota(self.request.user.school_id, 'students')
        
        # Auto-generate student_id based on current year and sequence per category
        current_year = datetime.now().year
        category = serializer.validated_data.get('category', 'gen')
        grade = serializer.validated_data.get('grade', '00')
        
        # Try to find class in StudentClass to get the code (dynamic lookup)
        try:
            student_class = StudentClass.objects.get(code=grade, school=self.request.user.school)
            grade_code = student_class.code
        except StudentClass.DoesNotExist:
            # Fallback
            grade_code = grade
        
        # Find the next sequence number for this year/category/grade
        existing_students = User.objects.filter(
            student_id__startswith=f"STU{current_year}{grade_code}",
            category=category,
            school=self.request.user.school,
        ).count()
        sequence = existing_students + 1
        
        student_id = f"STU{current_year}{grade_code}{sequence:03d}"
        
        # Ensure student_id is unique within the category
        while User.objects.filter(
            student_id=student_id, category=category, school=self.request.user.school
        ).exists():
            sequence += 1
            student_id = f"STU{current_year}{grade_code}{sequence:03d}"
        
        # Internal unique token for database compatibility only; never exposed or used
        username = secrets.token_hex(16)
        while User.objects.filter(username=username).exists():
            username = secrets.token_hex(16)
        
        team_id = serializer.validated_data.pop('team_id', None)

        user = serializer.save(
            role='student',
            username=username,
            student_id=student_id,
            school=self.request.user.school,
        )
        # Participants do not authenticate directly; avoid creating dormant,
        # guessable credentials that are never delivered to them.
        user.set_unusable_password()
        
        user.save()

        if team_id:
            try:
                from events.models import Team
                team_obj = Team.objects.get(id=team_id, school=self.request.user.school)
                team_obj.members.add(user)
            except Exception:
                pass
        
    
    @action(detail=True, methods=['post'])
    def assign_to_team(self, request, pk=None):
        """Assign a student to a team"""
        try:
            student = self.get_object()
            team_id = request.data.get('team_id')
            force_reassign = request.data.get('force_reassign', False)
            
            if not team_id:
                return Response({'error': 'Team ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            from events.models import Team
            
            try:
                team = Team.objects.get(id=team_id, school=self.request.user.school)
            except Team.DoesNotExist:
                return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if student is already in a team
            existing_member_teams = Team.objects.filter(members=student)
            
            if existing_member_teams.exists() and not force_reassign:
                # Student is already in a team, return error with options
                current_team = existing_member_teams.first()
                return Response({
                    'error': 'Student is already assigned to a team',
                    'current_team': {
                        'id': current_team.id,
                        'name': current_team.name,
                        'role': 'member'
                    },
                    'can_reassign': True,
                    'message': f'Student is already assigned to team "{current_team.name}". Do you want to remove them from the current team and assign to "{team.name}"?'
                }, status=status.HTTP_409_CONFLICT)
            
            # Remove student from any existing team if force_reassign is True
            if force_reassign:
                for existing_team in existing_member_teams:
                    existing_team.members.remove(student)
            
            # Add student to the new team
            team.members.add(student)
            role = 'member'
            
            return Response({
                'message': f'Student successfully assigned to team {team.name} as {role}',
                'team': {
                    'id': team.id,
                    'name': team.name,
                    'role': role
                }
            })
            
        except Exception as e:
            logger.exception('Failed to assign a student to a team')
            return Response({'error': 'Unable to assign the student.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def remove_from_team(self, request, pk=None):
        """Remove student from their current team"""
        student = self.get_object()
        
        from events.models import Team
        # Find teams where student is a member
        teams = Team.objects.filter(members=student)
        
        if not teams.exists():
            return Response({'error': 'Student is not assigned to any team'}, status=400)
        
        # Remove from all teams
        for team in teams:
            team.members.remove(student)
        
        return Response({'message': 'Student removed from team(s) successfully'})
    
    @action(detail=True, methods=['get'])
    def points_history(self, request, pk=None):
        """Get student's points history"""
        student = self.get_object()
        from events.models import PointsRecord
        
        points = EventPointsRecord.objects.filter(student=student).select_related('event')
        from events.serializers import PointsRecordSerializer
        serializer = PointsRecordSerializer(points, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def program_assignments(self, request, pk=None):
        """Get all program assignments for a student with event and program details"""
        student = self.get_object()
        
        # Import here to avoid circular import
        from events.models import ProgramAssignment
        
        assignments = ProgramAssignment.objects.filter(
            student=student
        ).select_related('program', 'program__event', 'team').order_by('-assigned_at')
        
        assignments_data = []
        for assignment in assignments:
            assignments_data.append({
                'id': assignment.id,
                'program': {
                    'id': assignment.program.id,
                    'name': assignment.program.name,
                    'category': assignment.program.category,
                    'start_time': assignment.program.start_time,
                    'end_time': assignment.program.end_time,
                    'venue': assignment.program.venue,
                    'status': assignment.program.status,
                },
                'event': {
                    'id': assignment.program.event.id,
                    'title': assignment.program.event.title,
                    'start_date': assignment.program.event.start_date,
                    'end_date': assignment.program.event.end_date,
                    'status': assignment.program.event.status,
                },
                'team': {
                    'id': assignment.team.id if assignment.team else None,
                    'name': assignment.team.name if assignment.team else None,
                } if assignment.team else None,
                'chest_number': assignment.chest_number,
                'assigned_at': assignment.assigned_at,
            })
        
        return Response(assignments_data)
    
    @action(detail=True, methods=['get'])
    def program_results(self, request, pk=None):
        """Get all program results for a student"""
        student = self.get_object()
        
        # Import here to avoid circular import
        from events.models import ProgramResult
        from events.services import program_points_count_for_student
        
        results = ProgramResult.objects.filter(
            participant=student,
            program__is_published=True,
            entry_status='submitted',
        ).select_related('program', 'program__event', 'team').order_by('-entered_at')
        
        results_data = []
        for result in results:
            results_data.append({
                'id': result.id,
                'program': {
                    'id': result.program.id,
                    'name': result.program.name,
                    'description': result.program.description,
                    'category': result.program.category,
                    'category_display': str(result.program.category or 'general').upper(),
                    'start_time': result.program.start_time,
                    'end_time': result.program.end_time,
                    'venue': result.program.venue,
                    'event': {
                        'id': result.program.event.id if result.program.event else None,
                        'title': result.program.event.title if result.program.event else None,
                        'start_date': result.program.event.start_date if result.program.event else None,
                        'end_date': result.program.event.end_date if result.program.event else None,
                        'venue': result.program.event.venue if result.program.event else None,
                    } if result.program.event else None,
                },
                'team': {
                    'id': result.team.id,
                    'name': result.team.name,
                } if result.team else None,
                'position': result.position,
                'points_earned': (
                    result.points_earned
                    if program_points_count_for_student(result.program)
                    else 0
                ),
                'marks': result.marks,
                'comments': result.comments,
                'entered_at': result.entered_at,
                'entered_by': result.entered_by.get_full_name() if result.entered_by else None,
            })
        
        return Response(results_data)

    @action(detail=True, methods=['get'])
    def participation_history(self, request, pk=None):
        """Get comprehensive participation history for a student"""
        student = self.get_object()
        
        # Import here to avoid circular import
        from events.models import ProgramAssignment, ProgramResult, Event, Team
        from events.services import program_points_count_for_student
        
        # Get all events the student has participated in
        events = Event.objects.filter(
            Q(programs__assignments__student=student) |
            Q(programs__results__participant=student)
        ).distinct().order_by('-start_date')
        
        participation_data = []
        for event in events:
            # Get programs for this event where student participated
            programs = []
            
            # Get assignments for this event
            assignments = ProgramAssignment.objects.filter(
                student=student,
                program__event=event
            ).select_related('program', 'team')
            
            # Get results for this event
            results = ProgramResult.objects.filter(
                participant=student,
                program__event=event,
                program__is_published=True,
                entry_status='submitted',
            ).select_related('program', 'team')
            
            # Combine assignments and results
            program_ids = set()
            for assignment in assignments:
                program_ids.add(assignment.program.id)
                programs.append({
                    'id': assignment.program.id,
                    'name': assignment.program.name,
                    'description': assignment.program.description,
                    'category': assignment.program.category,
                    'start_time': assignment.program.start_time,
                    'end_time': assignment.program.end_time,
                    'venue': assignment.program.venue,
                    'assigned_at': assignment.assigned_at,
                    'team': {
                        'id': assignment.team.id,
                        'name': assignment.team.name,
                    } if assignment.team else None,
                    'chest_number': assignment.chest_number,
                    'result': None  # Will be filled if result exists
                })
            
            for result in results:
                if result.program.id not in program_ids:
                    # This program has a result but no assignment (shouldn't happen but just in case)
                    programs.append({
                        'id': result.program.id,
                        'name': result.program.name,
                        'description': result.program.description,
                        'category': result.program.category,
                        'start_time': result.program.start_time,
                        'end_time': result.program.end_time,
                        'venue': result.program.venue,
                        'assigned_at': None,
                        'team': {
                            'id': result.team.id,
                            'name': result.team.name,
                        } if result.team else None,
                        'chest_number': None,
                        'result': {
                            'id': result.id,
                            'position': result.position,
                            'points_earned': (
                                result.points_earned
                                if program_points_count_for_student(result.program)
                                else 0
                            ),
                            'total_marks': result.total_marks,
                            'average_marks': result.average_marks,
                            'judge1_marks': result.judge1_marks,
                            'judge2_marks': result.judge2_marks,
                            'judge3_marks': result.judge3_marks,
                            'comments': result.comments,
                            'entered_at': result.entered_at,
                        }
                    })
                else:
                    # Find the existing program entry and add the result
                    for program in programs:
                        if program['id'] == result.program.id:
                            program['result'] = {
                                'id': result.id,
                                'position': result.position,
                                'points_earned': (
                                    result.points_earned
                                    if program_points_count_for_student(result.program)
                                    else 0
                                ),
                                'total_marks': result.total_marks,
                                'average_marks': result.average_marks,
                                'judge1_marks': result.judge1_marks,
                                'judge2_marks': result.judge2_marks,
                                'judge3_marks': result.judge3_marks,
                                'comments': result.comments,
                                'entered_at': result.entered_at,
                            }
                            break
            
            # Sort programs by start time
            programs.sort(key=lambda x: x['start_time'] or timezone.now())
            
            participation_data.append({
                'event': {
                    'id': event.id,
                    'title': event.title,
                    'event_type': event.event_type,
                    'start_date': event.start_date,
                    'end_date': event.end_date,
                    'venue': event.venue,
                    'status': event.status,
                },
                'programs': programs
            })
        
        return Response(participation_data)

    @action(detail=False, methods=['post'], throttle_classes=[UploadRateThrottle])
    def bulk_upload(self, request):
        """AI-powered bulk upload students via Excel file with team assignments"""
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        try:
            validate_excel_upload(file)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check openpyxl version for .xlsx files
        if file.name.endswith('.xlsx'):
            try:
                import openpyxl
                openpyxl_version = openpyxl.__version__
                # More flexible version check - allow newer versions
                if openpyxl_version < '3.0.0':
                    return Response({
                        'error': 'Server is currently updating. Please wait a few minutes and try again.',
                        'details': [
                            f'Current openpyxl version: {openpyxl_version}',
                            'Required version: 3.0.0 or newer',
                            'Server is being updated with the correct version'
                        ],
                        'suggestions': [
                            'Please wait 5-10 minutes for the update to complete',
                            'Try uploading your file again in a few minutes',
                            'If the issue persists, contact support'
                        ]
                    }, status=status.HTTP_400_BAD_REQUEST)
            except ImportError:
                return Response({
                    'error': 'Server is currently updating. Please wait a few minutes and try again.',
                    'details': ['openpyxl package is being installed'],
                    'suggestions': ['Please wait 5-10 minutes for the update to complete']
                }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read file with proper format handling (.xlsx, .xls, .csv)
            try:
                fname = file.name.lower()
                if fname.endswith('.xlsx'):
                    # For .xlsx files, try openpyxl with fallback
                    try:
                        df = pd.read_excel(file, engine='openpyxl')
                    except Exception as openpyxl_error:
                        error_msg = str(openpyxl_error).lower()
                        if 'openpyxl' in error_msg and ('version' in error_msg or '3.1.0' in error_msg):
                            try:
                                import io
                                file.seek(0)
                                file_content = file.read()
                                file.seek(0)
                                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
                            except Exception as fallback_error:
                                return Response({
                                    'error': 'Excel file reading failed due to openpyxl version issue.',
                                    'details': [
                                        f'Current openpyxl version is too old (requires 3.0.0+)',
                                        f'Technical error: {str(openpyxl_error)}',
                                        f'Fallback error: {str(fallback_error)}'
                                    ],
                                    'suggestions': [
                                        'Please wait for the server to update (usually 5-10 minutes)',
                                        'Try uploading the file again in a few minutes',
                                        'If the issue persists, contact support'
                                    ]
                                }, status=status.HTTP_400_BAD_REQUEST)
                        else:
                            raise openpyxl_error
                elif fname.endswith('.xls'):
                    try:
                        df = pd.read_excel(file, engine='openpyxl')
                    except Exception:
                        file.seek(0)
                        df = pd.read_excel(file, engine='xlrd')
                elif fname.endswith('.csv'):
                    try:
                        df = pd.read_csv(file, encoding='utf-8')
                    except UnicodeDecodeError:
                        file.seek(0)
                        try:
                            df = pd.read_csv(file, encoding='utf-8-sig')
                        except UnicodeDecodeError:
                            file.seek(0)
                            df = pd.read_csv(file, encoding='latin-1')
                else:
                    return Response({'error': 'Please upload a spreadsheet file (.xlsx, .xls, or .csv)'}, status=status.HTTP_400_BAD_REQUEST)
                
            except Exception as e:
                logger.info('Rejected unreadable spreadsheet upload: %s', type(e).__name__)
                return Response({'error': 'The spreadsheet could not be read. Check that it is valid and not corrupted.'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                validate_excel_shape(df)
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            # AI-powered column detection and data validation
            results = self._process_student_excel_with_ai(df)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not results['valid_students']:
                return Response({
                    'error': 'No student rows were found in the workbook.',
                    'suggestions': ['Add at least one student to the Students sheet and upload it again.'],
                }, status=status.HTTP_400_BAD_REQUEST)

            # All rows are validated before this transaction starts, so a failed
            # create cannot leave a partially imported class or team roster.
            created_students = []
            team_assignment_results = []

            with transaction.atomic():
                lock_and_enforce_quota(
                    self.request.user.school_id,
                    'students',
                    additional=len(results['valid_students']),
                )
                for student_data in results['valid_students']:
                    current_year = datetime.now().year
                    category = student_data['category']
                    grade = student_data['class_code']

                    existing_students = User.objects.filter(
                        student_id__startswith=f"STU{current_year}{grade}",
                        school=self.request.user.school,
                    ).count()
                    sequence = existing_students + 1
                    student_id = f"STU{current_year}{grade}{sequence:03d}"
                    while User.objects.filter(
                        student_id=student_id, school=self.request.user.school
                    ).exists():
                        sequence += 1
                        student_id = f"STU{current_year}{grade}{sequence:03d}"

                    # Internal unique token for database compatibility only; never exposed or used
                    username = secrets.token_hex(16)
                    while User.objects.filter(username=username).exists():
                        username = secrets.token_hex(16)

                    # Do not generate fake/dummy emails (e.g. @students.local).
                    # Only save an email if an actual email was explicitly provided in the file.
                    raw_email = student_data.get('email')
                    email = None
                    if raw_email and str(raw_email).strip() and str(raw_email).strip().lower() not in ('nan', 'none', 'null'):
                        clean_email = str(raw_email).strip().lower()
                        if not User.objects.filter(email=clean_email).exists():
                            email = clean_email

                    student = User.objects.create(
                        student_id=student_id,
                        name=student_data['name'],
                        email=email,
                        role='student',
                        username=username,
                        password=make_password(None),
                        school=self.request.user.school,
                        category=category,
                        gender=student_data['gender'],
                        grade=grade,
                        section=student_data.get('section', ''),
                        address=student_data.get('address', ''),
                        phone_number=student_data.get('phone_number', ''),
                        date_of_birth=student_data.get('date_of_birth'),
                        guardian_name=student_data.get('guardian_name', ''),
                        guardian_phone=student_data.get('guardian_phone', ''),
                        is_active=True
                    )
                    student.set_unusable_password()
                    student.save(update_fields=['password'])

                    # Chest numbers are event-specific and are generated only
                    # when the student is assigned to a program.
                    created_students.append(student)
                    if student_data.get('team_id'):
                        team = Team.objects.get(
                            pk=student_data['team_id'], school=self.request.user.school
                        )
                        team.members.add(student)
                        team_assignment_results.append({
                            'student': student.display_name,
                            'team': team.name,
                            'team_name': team.name,
                            'action': 'Added as team member',
                            'success': True,
                        })

            # Only return a summary and first 10 skipped/error entries to avoid large responses
            summary = {
                'total_processed': len(results['valid_students']),
                'successful_creations': len(created_students),
                'skipped_creations': 0,
                'team_assignments_processed': len(team_assignment_results)
            }
            
            response_data = {
                'success': True,
                'message': f'Successfully processed {len(created_students)} students',
                'summary': summary,
                'skipped': [],
                'team_assignments': team_assignment_results[:10],
                'corrections': results['corrections'][:20],
            }
            return Response(response_data)
            
        except DRFValidationError:
            raise
        except Exception as e:
            logger.exception('Student bulk upload failed')
            return Response({
                'error': 'An unexpected error occurred while processing the file',
                'suggestions': ['Please try again with a different file', 'Ensure the file format is correct', 'Contact support if the issue persists']
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_student_excel_with_ai(self, df):
        """Processing of Excel data for student creation with auto-category resolution and team assignment."""
        results = {
            'valid_students': [],
            'errors': [],
            'suggestions': [],
            'corrections': [],
        }
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Column mapping
        column_mapping = self._detect_student_columns(df.columns.tolist())
        
        # Only 'name' and 'class' are strictly required.
        # Category is derived from class, gender defaults to 'other', team and section are optional.
        required_fields = ['name', 'class']
        missing_fields = [field for field in required_fields if not column_mapping.get(field)]
        
        if missing_fields:
            results['errors'].append(f'Missing required columns: {", ".join(missing_fields)}')
            results['suggestions'].append('Please ensure your Excel file has at least columns for: name and class. Optional columns: section, gender, team_name.')
            return results
        
        # Pre-fetch school classes and teams for matching
        school_classes = list(
            StudentClass.objects.filter(is_active=True, school=self.request.user.school).select_related('category')
        )
        if not school_classes:
            results['errors'].append('No active classes found for your school. Please configure classes in School Settings first.')
            return results

        school_categories = list(
            StudentCategory.objects.filter(is_active=True, is_mixing=False, school=self.request.user.school)
        )
        school_teams = list(
            Team.objects.filter(school=self.request.user.school)
        )

        def class_aliases_getter(cls_item):
            c_name = cls_item.name
            c_code = cls_item.code
            aliases = [c_code, c_name]
            digits = re.findall(r'\d+', f"{c_name} {c_code}")
            if digits:
                d = digits[0]
                aliases.extend([
                    d, f"class {d}", f"grade {d}", f"std {d}", f"standard {d}",
                    f"{d}th", f"{d}st", f"{d}nd", f"{d}rd",
                    f"{d}th std", f"{d} std", f"{d} standard",
                    f"class{d}", f"grade{d}", f"std{d}", f"{d}th class", f"{d}th grade"
                ])
            return tuple(set(aliases))

        def team_aliases_getter(team_item):
            t_name = team_item.name
            aliases = [t_name, f"team {t_name}", f"{t_name} team", f"{t_name} house", f"house {t_name}"]
            core = re.sub(r'\s*(team|house|group)\s*', '', t_name, flags=re.IGNORECASE).strip()
            if core and core.lower() != t_name.lower():
                aliases.extend([core, f"team {core}", f"{core} team", f"{core} house", f"house {core}"])
            return tuple(set(aliases))

        gender_aliases = {
            'male': 'male', 'm': 'male', 'boy': 'male',
            'female': 'female', 'f': 'female', 'girl': 'female',
            'other': 'other', 'o': 'other',
        }

        seen_in_workbook = set()

        # Process each row
        for index, row in df.iterrows():
            try:
                # Extract required name field
                full_name = str(row[column_mapping['name']]).strip()
                if pd.isna(row[column_mapping['name']]) or not full_name or full_name.lower() in ('nan', 'none', 'null'):
                    continue

                # Extract class
                raw_class = str(row[column_mapping['class']]).strip()
                if pd.isna(row[column_mapping['class']]) or not raw_class or raw_class.lower() in ('nan', 'none', 'null'):
                    results['errors'].append(f'Row {index + 2}: Class is required.')
                    continue

                # Optional category provided?
                category_obj = None
                if column_mapping.get('category'):
                    raw_cat = str(row[column_mapping['category']]).strip()
                    if raw_cat and raw_cat.lower() not in ('nan', 'none', 'null'):
                        cat_match, corrected_cat = self._match_import_option(
                            raw_cat,
                            school_categories,
                            lambda item: (item.code, item.name),
                        )
                        if not cat_match:
                            results['errors'].append(f'Row {index + 2}: Invalid or inactive category "{raw_cat}".')
                            continue
                        if corrected_cat:
                            results['corrections'].append(
                                f'Row {index + 2}: category "{raw_cat}" matched to "{cat_match.name}".'
                            )
                        category_obj = cat_match

                # Determine candidate classes
                if category_obj:
                    candidate_classes = [c for c in school_classes if c.category_id == category_obj.id]
                else:
                    candidate_classes = school_classes

                student_class, corrected_class = self._match_import_option(
                    raw_class,
                    candidate_classes,
                    class_aliases_getter,
                )

                if not student_class:
                    valid_names = [c.name for c in candidate_classes]
                    cat_hint = f' for category "{category_obj.name}"' if category_obj else ''
                    results['errors'].append(
                        f'Row {index + 2}: Invalid class "{raw_class}"{cat_hint}. Available classes: {", ".join(valid_names)}.'
                    )
                    continue

                if corrected_class:
                    results['corrections'].append(
                        f'Row {index + 2}: class "{raw_class}" matched to "{student_class.name}".'
                    )

                # If category was not provided, infer directly from the class
                if not category_obj:
                    category_obj = student_class.category

                if not category_obj:
                    results['errors'].append(
                        f'Row {index + 2}: Class "{student_class.name}" has no category assigned. Please assign a category in School Settings.'
                    )
                    continue

                # Handle gender (defaults to 'other' if omitted or blank)
                gender = 'other'
                if column_mapping.get('gender'):
                    raw_gender = str(row[column_mapping['gender']]).strip().casefold()
                    if raw_gender and raw_gender not in ('nan', 'none', 'null'):
                        matched_gender = gender_aliases.get(raw_gender)
                        if not matched_gender:
                            results['errors'].append(
                                f'Row {index + 2}: Invalid gender "{raw_gender}". Choose Male, Female, or Other.'
                            )
                            continue
                        gender = matched_gender

                # Build student data
                student_data = {
                    'name': full_name,
                    'gender': gender,
                    'category': category_obj.code,
                    'class': student_class.name,
                    'class_code': student_class.code,
                }

                # Handle optional team assignment
                if column_mapping.get('team_name'):
                    raw_team = str(row[column_mapping['team_name']]).strip()
                    if raw_team and raw_team.lower() not in ('nan', 'none', 'null'):
                        team_obj, corrected_team = self._match_import_option(
                            raw_team,
                            school_teams,
                            team_aliases_getter,
                        )
                        if not team_obj:
                            valid_team_names = [t.name for t in school_teams]
                            results['errors'].append(
                                f'Row {index + 2}: Team "{raw_team}" does not exist for this school. Available teams: {", ".join(valid_team_names) if valid_team_names else "None configured"}. (Leave blank if unassigned).'
                            )
                            continue
                        if corrected_team:
                            results['corrections'].append(
                                f'Row {index + 2}: team "{raw_team}" matched to "{team_obj.name}".'
                            )
                        student_data['team_id'] = team_obj.id
                        student_data['team_name'] = team_obj.name

                # Handle optional section
                if column_mapping.get('section'):
                    raw_sec = str(row[column_mapping['section']]).strip()
                    if raw_sec and raw_sec.lower() not in ('nan', 'none', 'null'):
                        student_data['section'] = raw_sec

                # Handle other optional fields if present
                for optional_field in ('address', 'guardian_name', 'email'):
                    col = column_mapping.get(optional_field)
                    if col:
                        val = str(row[col]).strip()
                        if val and val.lower() not in ('nan', 'none', 'null'):
                            student_data[optional_field] = val

                invalid_optional = False
                for phone_field in ('phone_number', 'guardian_phone'):
                    col = column_mapping.get(phone_field)
                    if not col or pd.isna(row[col]):
                        continue
                    val = str(row[col]).strip()
                    if val.endswith('.0') and val[:-2].isdigit():
                        val = val[:-2]
                    if len(val) > 15:
                        results['errors'].append(
                            f'Row {index + 2}: {phone_field} cannot exceed 15 characters.'
                        )
                        invalid_optional = True
                    elif val and val.lower() not in ('nan', 'none', 'null'):
                        student_data[phone_field] = val

                date_col = column_mapping.get('date_of_birth')
                if date_col and not pd.isna(row[date_col]):
                    parsed_date = pd.to_datetime(row[date_col], errors='coerce')
                    if pd.isna(parsed_date):
                        results['errors'].append(
                            f'Row {index + 2}: Invalid date_of_birth. Use YYYY-MM-DD.'
                        )
                        invalid_optional = True
                    else:
                        student_data['date_of_birth'] = parsed_date.date()

                if invalid_optional:
                    continue

                # Check for duplicate within the same workbook
                sec_val = (student_data.get('section') or '').strip().casefold()
                wb_key = (full_name.casefold().strip(), student_class.code.casefold().strip(), sec_val)
                if wb_key in seen_in_workbook:
                    results['errors'].append(
                        f"Row {index + 2}: Duplicate student '{full_name}' in class '{student_class.name}' found within this spreadsheet."
                    )
                    continue
                seen_in_workbook.add(wb_key)

                # Check for duplicate against existing enrolled students in database
                existing_dup = User.objects.filter(
                    role='student',
                    school=self.request.user.school,
                    name__iexact=full_name.strip(),
                    grade=student_class.code,
                )
                if sec_val:
                    existing_dup = existing_dup.filter(section__iexact=student_data.get('section', '').strip())
                if existing_dup.exists():
                    dup_student = existing_dup.first()
                    sec_display = f" (Section '{dup_student.section}')" if dup_student.section else ""
                    results['errors'].append(
                        f"Row {index + 2}: Student '{dup_student.name}' already exists in class '{student_class.name}'{sec_display} (ID: {dup_student.student_id}). Duplicate enrollment is not allowed."
                    )
                    continue

                results['valid_students'].append(student_data)

            except Exception:
                logger.exception('Student spreadsheet row processing failed', extra={'row': index + 2})
                results['errors'].append(f'Row {index + 2}: This row could not be processed.')

        return results

    @staticmethod
    def _match_import_option(raw_value, options, aliases_getter):
        """Return an exact or safely unambiguous fuzzy match for a workbook value."""
        def normalize(value):
            return re.sub(r'[^a-z0-9]+', '', str(value).casefold())

        target = normalize(raw_value)
        if not target:
            return None, False

        scored = []
        for option in options:
            aliases = [normalize(alias) for alias in aliases_getter(option) if alias]
            if target in aliases:
                return option, False
            score = max((SequenceMatcher(None, target, alias).ratio() for alias in aliases), default=0)
            scored.append((score, option))

        scored.sort(key=lambda item: item[0], reverse=True)
        if not scored:
            return None, False
        best_score, best_option = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else 0
        # Conservative matching prevents a typo from silently selecting the wrong class/team
        threshold = 0.72 if len(target) >= 3 else 0.85
        if best_score < threshold or best_score - second_score < 0.06:
            return None, False
        return best_option, True
    
    def _detect_student_columns(self, columns):
        """Column detection for student data matching essential fields."""
        column_mapping = {}
        
        patterns = {
            'name': [r'^name$', r'full.*name', r'student.*name', r'^student$'],
            'class': [r'^class$', r'^grade$', r'^standard$', r'^std$', r'class.*name', r'grade.*name'],
            'section': [r'^section$', r'^sec$', r'class.*section', r'^division$', r'^div$'],
            'gender': [r'^gender$', r'^sex$'],
            'team_name': [r'team.*name', r'^team$', r'house.*name', r'^house$', r'group.*name', r'^group$'],
            'email': [r'^email$', r'^e_mail$', r'student.*email'],
            'category': [r'^category$', r'category.*code', r'category.*name', r'^cat$'],
            'address': [r'^address$', r'home.*address'],
            'phone_number': [r'^phone_number$', r'^phone$', r'student.*phone', r'mobile'],
            'date_of_birth': [r'^date_of_birth$', r'^dob$', r'birth.*date'],
            'guardian_name': [r'^guardian_name$', r'parent.*name', r'father.*name'],
            'guardian_phone': [r'^guardian_phone$', r'parent.*phone'],
        }
        
        for field, field_patterns in patterns.items():
            for column in columns:
                for pattern in field_patterns:
                    if re.search(pattern, column, re.IGNORECASE):
                        column_mapping[field] = column
                        break
                if field in column_mapping:
                    break
        
        return column_mapping

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Build a tenant-specific student workbook with only essential fields: name, class, section, gender, team_name."""
        try:
            import io
            from django.http import HttpResponse
            from openpyxl import Workbook
            from openpyxl.styles import Alignment, Font, PatternFill
            from openpyxl.worksheet.datavalidation import DataValidation

            existing_teams = list(Team.objects.filter(
                school=self.request.user.school
            ).order_by('team_number', 'name'))
            active_classes = list(StudentClass.objects.filter(
                is_active=True, category__isnull=False,
                category__is_active=True, category__is_mixing=False,
                school=self.request.user.school,
            ).select_related('category').order_by('category__name', 'name'))

            workbook = Workbook()
            students_sheet = workbook.active
            students_sheet.title = 'Students'
            headers = ['name', 'class', 'section', 'gender', 'team_name']
            students_sheet.append(headers)
            students_sheet.freeze_panes = 'A2'
            students_sheet.auto_filter.ref = 'A1:E1000'
            students_sheet.sheet_view.showGridLines = True

            header_fill = PatternFill('solid', fgColor='4F46E5')
            for cell in students_sheet[1]:
                cell.fill = header_fill
                cell.font = Font(color='FFFFFF', bold=True)
                cell.alignment = Alignment(horizontal='center')
            for column, width in {'A': 28, 'B': 20, 'C': 14, 'D': 16, 'E': 24}.items():
                students_sheet.column_dimensions[column].width = width

            setup_sheet = workbook.create_sheet('Setup')
            setup_sheet.append([
                'Class Name', 'Team Name', 'Category'
            ])
            max_options = max(len(active_classes), len(existing_teams), 1)
            for index in range(max_options):
                student_class = active_classes[index] if index < len(active_classes) else None
                team = existing_teams[index] if index < len(existing_teams) else None
                setup_sheet.append([
                    student_class.name if student_class else '',
                    team.name if team else '',
                    student_class.category.name if (student_class and student_class.category) else '',
                ])
            setup_sheet.freeze_panes = 'A2'
            setup_sheet.sheet_view.showGridLines = True
            for cell in setup_sheet[1]:
                cell.fill = header_fill
                cell.font = Font(color='FFFFFF', bold=True)
            for column, width in {'A': 24, 'B': 24, 'C': 24}.items():
                setup_sheet.column_dimensions[column].width = width

            def add_dropdown(cell_range, formula, prompt):
                validation = DataValidation(
                    type='list', formula1=formula, allow_blank=True,
                    error='Choose a value from the dropdown list.',
                    errorTitle='Invalid value', showErrorMessage=True,
                    prompt=prompt, promptTitle='Choose an option', showInputMessage=True,
                )
                students_sheet.add_data_validation(validation)
                validation.add(cell_range)

            if active_classes:
                add_dropdown('B2:B1001', f"'Setup'!$A$2:$A${len(active_classes) + 1}", 'Select student class.')
            
            gender_validation = DataValidation(
                type='list', formula1='"Male,Female,Other"', allow_blank=True,
                error='Choose Male, Female, or Other.', errorTitle='Invalid gender',
                showErrorMessage=True,
                prompt='Select gender (Male, Female, or Other).', promptTitle='Gender', showInputMessage=True,
            )
            students_sheet.add_data_validation(gender_validation)
            gender_validation.add('D2:D1001')

            if existing_teams:
                team_validation = DataValidation(
                    type='list', formula1=f"'Setup'!$B$2:$B${len(existing_teams) + 1}",
                    allow_blank=True, error='Choose an existing school team.',
                    errorTitle='Invalid team', showErrorMessage=True,
                    prompt='Optional: select an existing team.',
                    promptTitle='Choose a team', showInputMessage=True,
                )
                students_sheet.add_data_validation(team_validation)
                team_validation.add('E2:E1001')

            instructions_sheet = workbook.create_sheet('Instructions')
            instruction_rows = [
                ('Field', 'Required', 'How to complete it'),
                ('name', 'Yes', 'Enter student full name (e.g. Rahul Sharma).'),
                ('class', 'Yes', 'Select class/grade from dropdown. Category is automatically linked to class.'),
                ('section', 'No', 'Enter section if applicable (e.g. A, B).'),
                ('gender', 'No', 'Select Male, Female, or Other (defaults to Other if empty).'),
                ('team_name', 'No', 'Select existing team from dropdown. If chosen, student is auto-assigned to team.'),
                ('Generated automatically', '—', 'Student ID is generated automatically. No email or username is created or required.'),
            ]
            for row in instruction_rows:
                instructions_sheet.append(row)
            for cell in instructions_sheet[1]:
                cell.fill = header_fill
                cell.font = Font(color='FFFFFF', bold=True)
            instructions_sheet.column_dimensions['A'].width = 24
            instructions_sheet.column_dimensions['B'].width = 14
            instructions_sheet.column_dimensions['C'].width = 75
            instructions_sheet.freeze_panes = 'A2'
            instructions_sheet.sheet_view.showGridLines = True

            example_sheet = workbook.create_sheet('Example', 1)
            example_sheet.append(headers)

            sample_students = [
                ('Rahul Sharma', 'Male'),
                ('Ananya Patel', 'Female'),
                ('Mohammed Zayan', 'Male'),
                ('Diya Nair', 'Female'),
                ('Aarav Gupta', 'Male'),
                ('Fatima Zahra', 'Female'),
                ('Vihaan Reddy', 'Male'),
                ('Meera Krishnan', 'Female'),
                ('Arjun Das', 'Male'),
                ('Kavya Pillai', 'Female'),
                ('Aditya Verma', 'Male'),
                ('Zoya Ali', 'Female'),
                ('Dev Menon', 'Male'),
                ('Riya Sen', 'Female'),
                ('Ishan Joshi', 'Male'),
                ('Sana Sheikh', 'Female'),
                ('Rohan Iyer', 'Male'),
                ('Pooja Hegde', 'Female'),
                ('Karan Malhotra', 'Male'),
                ('Tanvi Chawla', 'Female'),
            ]

            team_idx = 0
            name_idx = 0
            classes_to_demo = active_classes if active_classes else [None]

            for cls in classes_to_demo:
                cls_name = cls.name if cls else 'Grade 10'
                for sec in ['A', 'B']:
                    s_name, s_gender = sample_students[name_idx % len(sample_students)]
                    name_idx += 1

                    team_name = ''
                    if existing_teams:
                        team_name = existing_teams[team_idx % len(existing_teams)].name
                        team_idx += 1

                    example_sheet.append([
                        s_name,
                        cls_name,
                        sec,
                        s_gender,
                        team_name,
                    ])

            for cell in example_sheet[1]:
                cell.fill = header_fill
                cell.font = Font(color='FFFFFF', bold=True)
            for column, width in {'A': 28, 'B': 20, 'C': 14, 'D': 16, 'E': 24}.items():
                example_sheet.column_dimensions[column].width = width
            example_sheet.sheet_view.showGridLines = True
            example_sheet.freeze_panes = 'A2'

            # Tab colors for clear sheet identification
            students_sheet.sheet_properties.tabColor = '10B981'
            example_sheet.sheet_properties.tabColor = '4F46E5'
            setup_sheet.sheet_properties.tabColor = '6366F1'
            instructions_sheet.sheet_properties.tabColor = 'F59E0B'

            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            
            response = HttpResponse(
                output.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="student_bulk_upload_template.xlsx"'
            return response
            
        except Exception as e:
            logger.exception('Student template generation failed')
            return Response({'error': 'Unable to generate the template.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PointsViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to points generated from published program results."""
    permission_classes = [IsAdminOrEventManager]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['point_type', 'team', 'student', 'event']
    ordering = ['-awarded_at']
    pagination_class = LargePagination
    
    def get_queryset(self):
        from events.models import PointsRecord
        return EventPointsRecord.objects.filter(
            school_id=self.request.user.school_id
        ).select_related('team', 'student', 'event', 'awarded_by')
    
    def get_serializer_class(self):
        from events.serializers import PointsRecordSerializer
        return PointsRecordSerializer
    
    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get global points leaderboard with percentage-based calculation"""
        # Calculate global points based on percentage of event totals
        global_points = self.calculate_global_points()
        
        # Team leaderboard with global points
        team_data = []
        for i, team_info in enumerate(sorted(global_points['teams'], key=lambda x: x['global_points'], reverse=True), 1):
            team_data.append({
                'rank': i,
                'id': team_info['id'],
                'name': team_info['name'],
                'points': team_info['global_points'],
                'members': team_info['members'],
                'events_participated': team_info['events_participated'],
                'event_breakdown': team_info['event_breakdown']
            })
        
        # Student leaderboard with global points
        student_data = []
        for i, student_info in enumerate(sorted(global_points['students'], key=lambda x: x['global_points'], reverse=True), 1):
            student_data.append({
                'rank': i,
                'id': student_info['id'],  # Database ID for API calls
                'name': student_info['name'],
                'student_id': student_info['student_id'],
                'points': student_info['global_points'],
                'category': student_info['category'],
                'event_breakdown': student_info['event_breakdown']
            })
        
        return Response({
            'teams': team_data,
            'students': student_data
        })

    @action(detail=True, methods=['get'])
    def student_details(self, request, pk=None):
        """Get detailed student performance breakdown across all events"""
        try:
            from django.db.models import Sum
            from events.models import ProgramResult, ProgramAssignment
            student = User.objects.get(
                id=pk, role='student', school_id=request.user.school_id
            )
            
            # Only official individual results contribute to the student score.
            from events.services import program_points_count_for_student
            eligible_program_ids = [
                program.id for program in Program.objects.filter(
                    event__school_id=request.user.school_id,
                    is_team_based=False,
                    is_published=True,
                ).select_related('event') if program_points_count_for_student(program)
            ]
            results = ProgramResult.objects.filter(
                participant=student,
                program_id__in=eligible_program_ids,
                entry_status='submitted',
                points_earned__gt=0,
            ).select_related('program', 'program__event', 'team')
            
            raw_points = sum(result.points_earned for result in results)
            events_participated = results.values('program__event').distinct().count()
            programs_participated = results.values('program').distinct().count()
            programs_won = results.filter(position=1).count()
            
            # Get event breakdown (grouped by events, showing total points per event)
            event_breakdown = []
            event_totals = {}
            
            # First, calculate totals per event
            for result in results:
                event_id = result.program.event.id
                if event_id not in event_totals:
                    event_totals[event_id] = {
                        'event': result.program.event,
                        'earned_points': 0,
                        'programs_participated': 0,
                        'programs_won': 0,
                        'programs': []
                    }
                
                event_totals[event_id]['earned_points'] += result.points_earned
                event_totals[event_id]['programs_participated'] += 1
                if result.position == 1:
                    event_totals[event_id]['programs_won'] += 1
                
                event_totals[event_id]['programs'].append({
                    'program_id': result.program.id,
                    'program_name': result.program.name,
                    'category': result.program.category,
                    'position': result.position,
                    'points_earned': result.points_earned,
                    'total_marks': float(result.total_marks) if result.total_marks else None,
                    'average_marks': float(result.average_marks) if result.average_marks else None,
                    'chest_number': ProgramAssignment.objects.filter(
                        program=result.program,
                        student=student
                    ).first().chest_number if ProgramAssignment.objects.filter(
                        program=result.program,
                        student=student
                    ).exists() else None
                })
            
            global_percentage = 0
            for event_id, event_data in event_totals.items():
                total_event_points = ProgramResult.objects.filter(
                    program__event_id=event_id,
                    program__event__school_id=request.user.school_id,
                    program__is_published=True,
                    entry_status='submitted',
                    points_earned__gt=0,
                ).aggregate(total=Sum('points_earned'))['total'] or 0
                percentage = (
                    event_data['earned_points'] / total_event_points * 100
                    if total_event_points else 0
                )
                global_percentage += percentage
                event_breakdown.append({
                    'event_id': event_data['event'].id,
                    'event_name': event_data['event'].title,
                    'event_type': event_data['event'].event_type,
                    'event_points': event_data['earned_points'],
                    'total_event_points': total_event_points,
                    'percentage': round(percentage, 2),
                    'programs_participated': event_data['programs_participated'],
                    'programs_won': event_data['programs_won'],
                    'programs': event_data['programs']
                })
            
            event_breakdown.sort(key=lambda x: x['percentage'], reverse=True)
            
            # Get team memberships
            team_memberships = []
            for team in student.team_memberships.all():
                team_memberships.append({
                    'team_id': team.id,
                    'team_name': team.name,
                    'member_since': 'Current'  # You can add a timestamp field to track when they joined
                })
            
            return Response({
                'student_id': student.id,
                'student_name': student.get_full_name(),
                'student_code': student.student_id,
                'category': str(student.category).upper() if student.category else 'N/A',
                'grade': student.grade,
                'section': student.section,
                'total_points': round(global_percentage, 2),
                'global_percentage': round(global_percentage, 2),
                'raw_points': raw_points,
                'events_participated': events_participated,
                'programs_participated': programs_participated,
                'programs_won': programs_won,
                'win_rate': (programs_won / programs_participated * 100) if programs_participated > 0 else 0,
                'event_breakdown': event_breakdown,
                'team_memberships': team_memberships,
                'total_teams': len(team_memberships)
            })
            
        except User.DoesNotExist:
            return Response({'error': 'Student not found'}, status=404)
    
    @action(detail=False, methods=['post'])
    def calculate_global_points(self, request=None):
        """Sum each recipient's percentage share across published events."""
        from events.services import calculate_global_points_for_school

        result = calculate_global_points_for_school(self.request.user.school)
        return Response(result) if request else result

        # Historical inline implementation retained below temporarily for
        # migration review; execution always uses the shared service above.
        from events.models import Event, Team, ProgramResult
        from django.db.models import Sum
        
        # Get all events that have results
        events_with_results = Event.objects.filter(
            school=self.request.user.school,
            programs__results__isnull=False
        ).distinct()
        
        team_global_points = {}
        student_global_points = {}
        
        for event in events_with_results:
            # Get all results for this event
            event_results = ProgramResult.objects.filter(
                program__event=event,
                program__is_published=True,
                entry_status='submitted',
                points_earned__gt=0
            ).select_related('participant', 'team', 'program')
            
            if not event_results.exists():
                continue
            
            # Calculate total points for this event
            total_event_points = event_results.aggregate(total=Sum('points_earned'))['total'] or 0
            
            if total_event_points == 0:
                continue
            
            # Calculate team points for this event
            team_event_points = {}
            for result in event_results.filter(team__isnull=False):
                team_id = result.team.id
                if team_id not in team_event_points:
                    team_event_points[team_id] = {
                        'team': result.team,
                        'points': 0
                    }
                team_event_points[team_id]['points'] += result.points_earned
            
            # Calculate percentage for each team and add to global points
            for team_id, team_data in team_event_points.items():
                if team_id not in team_global_points:
                    team_global_points[team_id] = {
                        'team': team_data['team'],
                        'global_points': 0,
                        'events_participated': 0,
                        'event_breakdown': []
                    }
                
                # Calculate percentage for this event
                event_percentage = (team_data['points'] / total_event_points) * 100
                
                team_global_points[team_id]['global_points'] += event_percentage
                team_global_points[team_id]['events_participated'] += 1
                team_global_points[team_id]['event_breakdown'].append({
                    'event_id': event.id,
                    'event_name': event.title,
                    'event_points': team_data['points'],
                    'total_event_points': total_event_points,
                    'percentage': round(event_percentage, 2)
                })
            
            # Calculate student points for this event (only individual programs)
            student_event_points = {}
            from events.services import program_points_count_for_student
            for result in event_results.filter(program__is_team_based=False):
                if not program_points_count_for_student(result.program):
                    continue
                student_id = result.participant.id
                if student_id not in student_event_points:
                    student_event_points[student_id] = {
                        'student': result.participant,
                        'points': 0
                    }
                student_event_points[student_id]['points'] += result.points_earned
            
            # Calculate percentage for each student and add to global points
            for student_id, student_data in student_event_points.items():
                if student_id not in student_global_points:
                    student_global_points[student_id] = {
                        'student': student_data['student'],
                        'global_points': 0,
                        'events_participated': 0,
                        'event_breakdown': []
                    }
                
                # Calculate percentage for this event
                event_percentage = (student_data['points'] / total_event_points) * 100
                
                student_global_points[student_id]['global_points'] += event_percentage
                student_global_points[student_id]['events_participated'] += 1
                student_global_points[student_id]['event_breakdown'].append({
                    'event_id': event.id,
                    'event_name': event.title,
                    'event_points': student_data['points'],
                    'total_event_points': total_event_points,
                    'percentage': round(event_percentage, 2)
                })
        
        # Convert to list format
        teams_list = []
        for team_id, team_data in team_global_points.items():
            teams_list.append({
                'id': team_data['team'].id,
                'name': team_data['team'].name,
                'global_points': round(team_data['global_points'], 2),
                'members': team_data['team'].member_count,
                'events_participated': team_data['events_participated'],
                'event_breakdown': team_data['event_breakdown']
            })
        
        students_list = []
        for student_id, student_data in student_global_points.items():
            # Use proper name resolution instead of display_name
            student = student_data['student']
            student_name = student.get_full_name() if hasattr(student, 'get_full_name') else f"{student.first_name} {student.last_name}".strip()
            if not student_name or student_name.strip() == '':
                student_name = student.name or f"Student {student.student_id}" if student.student_id else "Unknown Student"
            
            students_list.append({
                'id': student.id,
                'name': student_name,
                'student_id': student.student_id,
                'global_points': round(student_data['global_points'], 2),
                'category': str(student.category).upper() if student.category else 'N/A',
                'events_participated': student_data['events_participated'],
                'event_breakdown': student_data['event_breakdown']
            })
        
        result = {
            'teams': teams_list,
            'students': students_list
        }
        
        if request:
            return Response(result)
        else:
            return result
    
class SchoolSettingsViewSet(viewsets.ModelViewSet):
    queryset = SchoolSettings.objects.all()
    serializer_class = SchoolSettingsSerializer
    permission_classes = [IsSchoolAdmin]

    def get_object(self):
        return SchoolSettings.get_settings(self.request.user.school)

    def list(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs) 

class StudentCategoryViewSet(viewsets.ModelViewSet):
    queryset = StudentCategory.objects.all()
    authentication_classes = [TeamManagerAuthentication, SchoolJWTAuthentication]
    
    def get_serializer_class(self):
        from .serializers import StudentCategorySerializer
        return StudentCategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSchoolAdmin()]
        return [IsTeamManagerOrAdmin()]

    def get_queryset(self):
        return StudentCategory.objects.filter(school_id=self.request.user.school_id)

    from django.db import transaction

    @transaction.atomic
    def perform_create(self, serializer):
        category = serializer.save(school=self.request.user.school)
        classes = self.request.data.get('classes', [])
        mixed_cats = self.request.data.get('mixed_categories', [])
        from .models import StudentClass
        StudentClass.objects.filter(id__in=classes, school=self.request.user.school).update(category=category)
        if mixed_cats:
            category.mixed_categories.set(
                StudentCategory.objects.filter(id__in=mixed_cats, school=self.request.user.school)
            )

    @transaction.atomic
    def perform_update(self, serializer):
        category = serializer.save()
        classes = self.request.data.get('classes', [])
        mixed_cats = self.request.data.get('mixed_categories', [])
        from .models import StudentClass
        # Remove previously assigned classes not in the new selection
        StudentClass.objects.filter(category=category, school=self.request.user.school).exclude(id__in=classes).update(category=None)
        # Assign new selection
        StudentClass.objects.filter(id__in=classes, school=self.request.user.school).update(category=category)
        category.mixed_categories.set(
            StudentCategory.objects.filter(id__in=mixed_cats, school=self.request.user.school)
        )


class StudentClassViewSet(viewsets.ModelViewSet):
    authentication_classes = [TeamManagerAuthentication, SchoolJWTAuthentication]
    def get_serializer_class(self):
        from .serializers import StudentClassSerializer
        return StudentClassSerializer

    def get_queryset(self):
        queryset = StudentClass.objects.filter(school_id=self.request.user.school_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__code=category)
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSchoolAdmin()]
        return [IsTeamManagerOrAdmin()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)




 
