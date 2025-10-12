from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from . import views

# Create a router and register our viewsets with it
router = DefaultRouter()
router.register(r'events', views.EventViewSet)
router.register(r'teams', views.TeamViewSet, basename='team')
router.register(r'announcements', views.EventAnnouncementViewSet, basename='eventannouncement')
router.register(r'programs', views.ProgramViewSet, basename='program')  # Direct route for program creation workaround
router.register(r'team-manager', views.TeamManagerViewSet, basename='team-manager')  # Team manager endpoints

# Create nested routers for programs
events_router = routers.NestedDefaultRouter(router, r'events', lookup='event')
events_router.register(r'programs', views.ProgramViewSet, basename='event-programs')

# Create nested routers for program assignments and results
programs_router = routers.NestedDefaultRouter(events_router, r'programs', lookup='program')
programs_router.register(r'assignments', views.ProgramAssignmentViewSet, basename='program-assignments')
programs_router.register(r'results', views.ProgramResultViewSet, basename='program-results')

# Additional URL patterns for utility views
urlpatterns = [
    path('', include(router.urls)),
    path('', include(events_router.urls)),
    path('', include(programs_router.urls)),
    
    # Event-specific endpoints that aren't being picked up by the router
    path('events/<int:pk>/points/teams/', views.EventViewSet.as_view({'get': 'points_teams'}), name='event-points-teams'),
    path('events/<int:pk>/points/students/', views.EventViewSet.as_view({'get': 'points_students'}), name='event-points-students'),
    
    # Program utility endpoints
    path('programs/<int:program_id>/calling-sheet/', views.generate_calling_sheet, name='generate_calling_sheet'),
    path('programs/<int:program_id>/formatted-calling-sheet/', views.generate_formatted_calling_sheet, name='generate_formatted_calling_sheet'),
    path('programs/<int:program_id>/formatted-evaluation-sheet/', views.generate_formatted_evaluation_sheet, name='generate_formatted_evaluation_sheet'),
    path('programs/<int:program_id>/participants/', views.get_program_participants, name='get_program_participants'),
    
    # Team utility endpoints
    path('events/<int:event_id>/teams/<int:team_id>/program-list-pdf/', views.generate_team_list_pdf, name='generate_team_list_pdf'),
    # Team event details is now handled by the @action decorator with custom URL path
    
    # Custom template demo endpoint
    path('custom-template-demo/', views.generate_custom_template_demo, name='generate_custom_template_demo'),

    # Report generation endpoints
    path('events/test-list/', views.test_events_list, name='test_events_list'),
    path('events/<int:event_id>/reports/test/', views.test_report_generation, name='test_report_generation'),
    path('events/<int:event_id>/reports/test-pdf/', views.test_pdf_generation, name='test_pdf_generation'),
    path('events/<int:event_id>/reports/program-details/', views.generate_program_details_report, name='generate_program_details_report'),
    path('events/<int:event_id>/reports/complete-results/', views.generate_complete_results_report, name='generate_complete_results_report'),
    path('events/<int:event_id>/reports/first-place/', views.generate_first_place_report, name='generate_first_place_report'),
    path('events/<int:event_id>/reports/second-place/', views.generate_second_place_report, name='generate_second_place_report'),
    path('events/<int:event_id>/reports/third-place/', views.generate_third_place_report, name='generate_third_place_report'),
    path('events/<int:event_id>/reports/all-results/', views.generate_all_results_report, name='generate_all_results_report'),
    path('events/<int:event_id>/reports/participants-team/', views.generate_participants_team_report, name='generate_participants_team_report'),
    path('events/<int:event_id>/reports/backup/', views.generate_event_backup, name='generate_event_backup'),
    path('events/reports/all-events/', views.generate_all_events_report, name='generate_all_events_report'),
    
    # Executable report endpoints
    path('events/<int:event_id>/reports/program-details-executable/', views.generate_program_details_executable, name='generate_program_details_executable'),
    path('events/<int:event_id>/reports/complete-results-executable/', views.generate_complete_results_executable, name='generate_complete_results_executable'),
    path('events/<int:event_id>/reports/participants-team-executable/', views.generate_participants_team_executable, name='generate_participants_team_executable'),
] 