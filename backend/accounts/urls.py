from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, user_profile, admin_dashboard_summary, team_manager_dashboard, school_settings, StudentViewSet, PointsViewSet, team_manager_login, team_manager_profile, team_manager_students, team_manager_available_programs, team_manager_event_programs, team_manager_assign_student, team_manager_remove_assignment, team_manager_remove_student_from_program, SchoolSettingsViewSet, create_admin_user

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='students')
router.register(r'points', PointsViewSet, basename='points')
router.register(r'schoolsettings', SchoolSettingsViewSet, basename='schoolsettings')

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
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
    path('team-manager/<int:team_id>/events/<int:event_id>/programs/<int:program_id>/students/<int:student_id>/remove/', team_manager_remove_student_from_program, name='team_manager_remove_student_from_program'),
    path('team-manager/<int:team_id>/assignments/<int:assignment_id>/remove/', team_manager_remove_assignment, name='team_manager_remove_assignment'),
    path('create-admin-user/', create_admin_user, name='create_admin_user'),
]
urlpatterns += router.urls 