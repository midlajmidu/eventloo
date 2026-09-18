from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .throttles import LoginRateThrottle
from django.conf import settings
from rest_framework.response import Response
from .views import CustomTokenObtainPairView, user_profile, admin_dashboard_summary, team_manager_dashboard, school_settings, StudentViewSet, PointsViewSet, team_manager_login, team_manager_profile, team_manager_students, team_manager_available_programs, team_manager_event_programs, team_manager_assign_student, team_manager_set_subteam_leader, team_manager_remove_assignment, team_manager_remove_student_from_program, SchoolSettingsViewSet, StudentCategoryViewSet, StudentClassViewSet, SuperAdminSchoolViewSet, SchoolUserViewSet, school_staff_mfa_setup, school_staff_mfa_confirm, super_admin_login, super_admin_mfa_setup, super_admin_mfa_confirm, super_admin_dashboard, logout_view
from .serializers import HardenedTokenRefreshSerializer

router = DefaultRouter()


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [LoginRateThrottle]
    serializer_class = HardenedTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        if settings.REQUIRE_AJAX_AUTH_HEADER and request.headers.get('X-Requested-With') != 'XMLHttpRequest':
            return Response({'error': 'Invalid authentication request.'}, status=400)
        data = request.data.copy()
        if not data.get('refresh'):
            data['refresh'] = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        response = Response(serializer.validated_data, status=200)
        refresh = response.data.pop('refresh', None)
        access = response.data.pop('access', None)
        if refresh and access:
            from .views import set_auth_cookies
            set_auth_cookies(response, refresh, access)
        return response
router.register(r'super-admin/schools', SuperAdminSchoolViewSet, basename='super-admin-schools')
router.register(r'users', SchoolUserViewSet, basename='school-users')
router.register(r'students', StudentViewSet, basename='students')
router.register(r'points', PointsViewSet, basename='points')
router.register(r'schoolsettings', SchoolSettingsViewSet, basename='schoolsettings')
router.register(r'categories', StudentCategoryViewSet, basename='categories')
router.register(r'classes', StudentClassViewSet, basename='classes')

urlpatterns = [
    path('super-admin/login/', super_admin_login, name='super_admin_login'),
    path('super-admin/mfa/setup/', super_admin_mfa_setup, name='super_admin_mfa_setup'),
    path('super-admin/mfa/confirm/', super_admin_mfa_confirm, name='super_admin_mfa_confirm'),
    path('mfa/setup/', school_staff_mfa_setup, name='school_staff_mfa_setup'),
    path('mfa/confirm/', school_staff_mfa_confirm, name='school_staff_mfa_confirm'),
    path('super-admin/dashboard/', super_admin_dashboard, name='super_admin_dashboard'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', logout_view, name='logout'),
    path('profile/', user_profile, name='profile'),
    path('school-settings/', school_settings, name='school_settings'),
    path('admin/dashboard/summary/', admin_dashboard_summary, name='admin_dashboard_summary'),
    path('team-manager/dashboard/', team_manager_dashboard, name='team_manager_dashboard'),
    path('team-manager/login/', team_manager_login, name='team_manager_login'),
    path('team-manager/available_programs/', team_manager_available_programs, name='team_manager_available_programs'),
    path('team-manager/profile/<int:team_id>/', team_manager_profile, name='team_manager_profile'),
    path('team-manager/<int:team_id>/students/', team_manager_students, name='team_manager_students'),
    # Removed conflicting endpoint - now handled by events/views.py
    path('team-manager/<int:team_id>/events/<int:event_id>/programs/', team_manager_event_programs, name='team_manager_event_programs'),
    path('team-manager/<int:team_id>/events/<int:event_id>/programs/<int:program_id>/assign/', team_manager_assign_student, name='team_manager_assign_student'),
    path('team-manager/<int:team_id>/events/<int:event_id>/programs/<int:program_id>/set-leader/', team_manager_set_subteam_leader, name='team_manager_set_subteam_leader'),
    path('team-manager/<int:team_id>/events/<int:event_id>/programs/<int:program_id>/students/<int:student_id>/remove/', team_manager_remove_student_from_program, name='team_manager_remove_student_from_program'),
    path('team-manager/<int:team_id>/assignments/<int:assignment_id>/remove/', team_manager_remove_assignment, name='team_manager_remove_assignment'),
]
urlpatterns += router.urls 
