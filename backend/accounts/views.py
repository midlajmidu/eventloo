from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import CustomTokenObtainPairSerializer, UserSerializer, StudentSerializer, StudentCreateUpdateSerializer, TeamManagerLoginSerializer, TeamManagerResponseSerializer
from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum, Count, Max
from .models import User, SchoolSettings
from events.permissions import CanManageStudents
from events.pagination import StandardPagination, LargePagination, SmallPagination
import pandas as pd
import re
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone
from events.models import Team, Event, Program, ProgramAssignment, PointsRecord as EventPointsRecord
import pandas as pd
import re
import random
import string
from datetime import datetime
from .models import SchoolSettings
from .serializers import SchoolSettingsSerializer

def get_paginated_response(data, request, pagination_class=StandardPagination):
    """Helper function to get paginated response for API views"""
    paginator = pagination_class()
    page = paginator.paginate_queryset(data, request)
    if page is not None:
        return paginator.get_paginated_response(page)
    return Response(data)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """Get current user profile"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def school_settings(request):
    """Get school settings including logo"""
    settings = SchoolSettings.get_settings()
    return Response({
        'school_name': settings.school_name,
        'school_logo': settings.school_logo,
        'primary_color': settings.primary_color,
        'secondary_color': settings.secondary_color,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout user (frontend will handle token removal)"""
    return Response({'message': 'Logged out successfully'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard_summary(request):
    """Get dashboard summary data for admin, including global points and event breakdowns"""
    # Check if user is admin
    if request.user.role != 'admin':
        return Response({'error': 'Access denied'}, status=403)
    
    # Get actual data from database
    from events.models import Event, Team, PointsRecord

    total_events = Event.objects.count()
    total_teams = Team.objects.count()
    total_students = User.objects.filter(role='student').count()
    total_programs = Event.objects.filter(status='completed').count()

    # Calculate global points using percentage-based calculation
    teams_with_points = []
    teams = Team.objects.prefetch_related('members', 'program_assignments__program__event').all()
    
    for team in teams:
        # Calculate percentage-based global points (same as global points calculation)
        from events.models import ProgramResult
        from django.db.models import Sum
        
        # Get all events this team participated in
        team_results = ProgramResult.objects.filter(
            team=team,
            points_earned__gt=0
        ).select_related('program__event')
        
        total_global_percentage = 0
        events_participated = 0
        
        if team_results.exists():
            # Group by event
            event_breakdown = {}
            for result in team_results:
                event_name = result.program.event.title
                if event_name not in event_breakdown:
                    event_breakdown[event_name] = {
                        'team_points': 0,
                        'total_event_points': 0
                    }
                event_breakdown[event_name]['team_points'] += result.points_earned
            
            # Calculate total event points for each event
            for event_name in event_breakdown:
                total_event_points = ProgramResult.objects.filter(
                    program__event__title=event_name,
                    points_earned__gt=0
                ).aggregate(total=Sum('points_earned'))['total'] or 0
                
                # Calculate percentage for this event
                if total_event_points > 0:
                    event_percentage = (event_breakdown[event_name]['team_points'] / total_event_points) * 100
                    total_global_percentage += event_percentage
                    events_participated += 1
        
        teams_with_points.append({
            'id': team.id,
            'name': team.name,
            'global_points': round(total_global_percentage, 2),
            'members': team.member_count,
            'events_participated': events_participated,
            'event_breakdown': {}
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
    recent_points = EventPointsRecord.objects.select_related('team', 'student', 'event')[:5]
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
        'totalTeams': total_teams,
        'totalStudents': total_students,
        'totalPrograms': total_programs,
        'pointsByTeam': points_by_team,
        'topTeams': points_by_team,  # Add this for compatibility
        'recentActivities': recent_activities
    }
    
    return Response(dashboard_data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_manager_dashboard(request):
    """Get dashboard data for team managers"""
    if request.user.role != 'team_manager':
        return Response({'error': 'Access denied'}, status=403)
    
    from events.models import Team, Event, PointsRecord, ProgramResult
    from django.db.models import Sum
    
    # Get teams managed by this team manager
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
        recent_activities.append({
            'id': record.id,
            'action': f"{record.team.name} earned {record.points} points for {record.reason}",
            'time': record.awarded_at.strftime('%H:%M'),
            'type': 'points'
        })
    
    # Calculate global points for each team
    teams_with_global_points = []
    for team in managed_teams:
        # Calculate percentage-based global points
        team_results = ProgramResult.objects.filter(
            team=team,
            points_earned__gt=0
        ).select_related('program__event')
        
        total_global_percentage = 0
        events_participated = 0
        
        if team_results.exists():
            # Group by event
            event_breakdown = {}
            for result in team_results:
                event_name = result.program.event.title
                if event_name not in event_breakdown:
                    event_breakdown[event_name] = {
                        'team_points': 0,
                        'total_event_points': 0
                    }
                event_breakdown[event_name]['team_points'] += result.points_earned
            
            # Calculate total event points for each event
            for event_name in event_breakdown:
                total_event_points = ProgramResult.objects.filter(
                    program__event__title=event_name,
                    points_earned__gt=0
                ).aggregate(total=Sum('points_earned'))['total'] or 0
                
                # Calculate percentage for this event
                if total_event_points > 0:
                    event_percentage = (event_breakdown[event_name]['team_points'] / total_event_points) * 100
                    total_global_percentage += event_percentage
                    events_participated += 1
        
        teams_with_global_points.append({
            'id': team.id,
            'name': team.name,
            'points': team.points_earned,  # Keep original points for backward compatibility
            'global_points': round(total_global_percentage, 2),  # Add global points
            'members': team.member_count,
            'events_participated': events_participated
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
@permission_classes([])
def team_manager_login(request):
    """Team manager login using team credentials"""
    serializer = TeamManagerLoginSerializer(data=request.data)
    
    if serializer.is_valid():
        team = serializer.validated_data['team']
        
        # Create a response with team information
        team_data = TeamManagerResponseSerializer(team).data
        
        # Create a JWT token for team authentication
        from rest_framework_simplejwt.tokens import RefreshToken
        
        # Create a special token payload for team authentication
        token_payload = {
            'team_id': team.id,
            'team_name': team.name,
            'access_type': 'team_manager'
        }
        
        # Create refresh token with custom payload
        refresh = RefreshToken()
        refresh['team_id'] = team.id
        refresh['team_name'] = team.name
        refresh['access_type'] = 'team_manager'
        
        response_data = {
            'success': True,
            'message': f'Welcome, {team.name}!',
            'team': team_data,
            'access_type': 'team_manager',
            'access': str(refresh.access_token),
            'refresh': str(refresh)
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def team_manager_profile(request, team_id):
    """Get team manager profile and team details"""
    try:
        team = Team.objects.get(id=team_id)
        
        # Get team members
        members = team.members.all()
        member_data = []
        
        for member in members:
            member_data.append({
                'id': member.id,
                'name': member.display_name,
                'student_id': member.student_id,
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
@permission_classes([])
def team_manager_students(request, team_id):
    """Get team's students with their points"""
    try:
        team = Team.objects.get(id=team_id)
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
@permission_classes([])
def team_manager_events(request, team_id):
    """Get all events for a team manager (paginated)"""
    try:
        from events.models import Team, Event, Program, ProgramAssignment

        team = Team.objects.get(id=team_id)
        # Get all events this team is participating in
        events = Event.objects.filter(programs__assignments__team=team).distinct().order_by('-start_date')

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
                'venue': event.venue,
                'description': event.description,
                'programs': program_data,
                'total_programs': len(program_data)
            })

        return get_paginated_response({
            'events': event_data,
            'total_events': len(event_data)
        }, request, StandardPagination)
        
    except Team.DoesNotExist:
        return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([])
def team_manager_available_programs(request):
    """Get all available programs for team managers"""
    try:
        from events.models import Program, Event
        from events.pagination import SmallPagination
        from events.serializers import ProgramSerializer
        
        # Get all active programs from published/ongoing events
        programs = Program.objects.filter(
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
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([])
def team_manager_event_programs(request, team_id, event_id):
    """Get programs for a specific event and current assignments"""
    try:
        team = Team.objects.get(id=team_id)
        from events.models import Event, Program, ProgramAssignment
        
        event = Event.objects.get(id=event_id)
        programs = Program.objects.filter(event=event)
        
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
                    'name': assignment.student.display_name,
                    'student_id': assignment.student.student_id,
                    'chest_number': assignment.chest_number,
                    'assigned_at': assignment.assigned_at
                })
            
            # Calculate limits and available slots based on program type
            if program.is_team_based:
                # For team-based programs, use max_participants_per_team
                per_team_limit = program.max_participants_per_team if program.max_participants_per_team else 0
                assigned_count = len(assigned_students)
                available_slots = per_team_limit - assigned_count if per_team_limit > 0 else 0
                program_type = 'Team'
                limit_description = f'Max {per_team_limit} participants per team'
            else:
                # For individual programs, max_participants represents participants per team
                per_team_limit = program.max_participants if program.max_participants else 1
                assigned_count = len(assigned_students)
                available_slots = per_team_limit - assigned_count if assigned_count < per_team_limit else 0
                program_type = 'Individual'
                
                # Calculate total capacity (teams × participants per team)
                total_teams = Team.objects.count()
                total_capacity = total_teams * per_team_limit
                total_assigned = ProgramAssignment.objects.filter(program=program).count()
                
                limit_description = f'{per_team_limit} participants per team (Total: {total_assigned}/{total_capacity} - {per_team_limit} × {total_teams} teams)'
            
            program_data.append({
                'id': program.id,
                'name': program.name,
                'category': program.category,
                'program_type': program_type,
                'is_team_based': program.is_team_based,
                'max_participants': program.max_participants,  # Overall limit
                'max_participants_per_team': program.max_participants_per_team,  # Per-team limit
                'description': program.description,
                'assigned_students': assigned_students,
                'assigned_count': assigned_count,
                'available_slots': available_slots,
                'per_team_limit': per_team_limit,
                'limit_description': limit_description,
                'total_teams': Team.objects.count()
            })
        
        # Get team members for assignment
        team_members = team.members.all()
        member_data = []
        for member in team_members:
            member_data.append({
                'id': member.id,
                'name': member.display_name,
                'student_id': member.student_id,
                'category': member.category,
                'grade': member.grade,
                'section': member.section
            })
        
        return Response({
            'event': {
                'id': event.id,
                'title': event.title,
                'event_type': event.event_type,
                'status': event.status
            },
            'programs': program_data,
            'team_members': member_data,
            'total_programs': len(program_data)
        })
        
    except (Team.DoesNotExist, Event.DoesNotExist):
        return Response({'error': 'Team or Event not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([])
def team_manager_assign_student(request, team_id, event_id, program_id):
    """Assign a student to a program"""
    try:
        team = Team.objects.get(id=team_id)
        from events.models import Event, Program, ProgramAssignment, User
        
        event = Event.objects.get(id=event_id)
        program = Program.objects.get(id=program_id, event=event)
        student_id = request.data.get('student_id')
        
        # Validate student belongs to team
        student = User.objects.get(id=student_id, role='student')
        if not team.members.filter(id=student_id).exists():
            return Response({'error': 'Student does not belong to this team'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if student is already assigned to this program
        existing_assignment = ProgramAssignment.objects.filter(
            team=team,
            program=program,
            student=student
        ).first()
        
        if existing_assignment:
            return Response({'error': 'Student is already assigned to this program'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle team-based programs
        if program.is_team_based:
            # For team-based programs, check max_participants_per_team limit
            if program.max_participants_per_team is None:
                return Response({'error': 'Program max participants per team is not set. Please contact admin.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Count assignments for this specific team in this program
            team_assignments = ProgramAssignment.objects.filter(
                team=team,
                program=program
            ).count()
            
            if team_assignments >= program.max_participants_per_team:
                return Response({
                    'error': f'Your team has already reached the maximum limit of {program.max_participants_per_team} participants for this team-based program'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle general programs (non-team-based)
        else:
            # For general programs, each team can assign up to max_participants students
            team_assignments = ProgramAssignment.objects.filter(
                team=team,
                program=program
            ).count()
            
            # Use max_participants as the limit per team for general programs
            max_per_team = program.max_participants if program.max_participants else 1
            
            if team_assignments >= max_per_team:
                return Response({
                    'error': f'Your team has already reached the maximum limit of {max_per_team} participants for this program. Each team can assign up to {max_per_team} students.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # For individual programs, max_participants represents participants per team
            # No need to check total assignments across all teams
        
        # Create assignment
        assignment = ProgramAssignment.objects.create(
            team=team,
            program=program,
            student=student
        )
        
        return Response({
            'message': 'Student assigned successfully',
            'assignment': {
                'id': assignment.id,
                'student_name': student.display_name,
                'program_name': program.name,
                'assigned_at': assignment.assigned_at
            }
        }, status=status.HTTP_201_CREATED)
        
    except (Team.DoesNotExist, Event.DoesNotExist, Program.DoesNotExist, User.DoesNotExist):
        return Response({'error': 'Invalid team, event, program, or student'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([])
def team_manager_remove_assignment(request, team_id, assignment_id):
    """Remove a student assignment from a program"""
    try:
        team = Team.objects.get(id=team_id)
        from events.models import ProgramAssignment
        
        assignment = ProgramAssignment.objects.get(id=assignment_id, team=team)
        assignment.delete()
        
        return Response({'message': 'Assignment removed successfully'}, status=status.HTTP_200_OK)
        
    except (Team.DoesNotExist, ProgramAssignment.DoesNotExist):
        return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([])
def team_manager_remove_student_from_program(request, team_id, event_id, program_id, student_id):
    """Remove a specific student from a specific program"""
    try:
        team = Team.objects.get(id=team_id)
        from events.models import Event, Program, ProgramAssignment, User
        
        event = Event.objects.get(id=event_id)
        program = Program.objects.get(id=program_id, event=event)
        student = User.objects.get(id=student_id, role='student')
        
        # Validate student belongs to team
        if not team.members.filter(id=student_id).exists():
            return Response({'error': 'Student does not belong to this team'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find and delete the assignment
        assignment = ProgramAssignment.objects.get(
            team=team,
            program=program,
            student=student
        )
        assignment.delete()
        
        return Response({'message': 'Student removed from program successfully'}, status=status.HTTP_200_OK)
        
    except (Team.DoesNotExist, Event.DoesNotExist, Program.DoesNotExist, User.DoesNotExist):
        return Response({'error': 'Invalid team, event, program, or student'}, status=status.HTTP_404_NOT_FOUND)
    except ProgramAssignment.DoesNotExist:
        return Response({'error': 'Student is not assigned to this program'}, status=status.HTTP_404_NOT_FOUND)

class StudentViewSet(viewsets.ModelViewSet):
    """ViewSet for Student management"""
    serializer_class = StudentSerializer
    permission_classes = [CanManageStudents]
    pagination_class = StandardPagination
    
    def get_queryset(self):
        user = self.request.user
        
        # Base queryset
        queryset = User.objects.filter(role='student')
        
        # Filter based on user role
        if user.role == 'admin':
            # Admins can see all students
            pass
        elif user.role == 'team_manager':
            # Team managers can only see their team's students
            from events.models import Team
            managed_teams = Team.objects.filter(team_manager=user)
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
                    team_obj = Team.objects.get(id=team)
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
        if self.request.user.role != 'admin':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Create student with auto-generated password, student_id, and chest_code"""
        import random
        import string
        from datetime import datetime
        
        # Generate random password
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Auto-generate student_id based on current year and sequence per category
        current_year = datetime.now().year
        category = serializer.validated_data.get('category', 'gen')
        grade = serializer.validated_data.get('grade', '00')
        
        # Map HSS grades to shorter codes for student ID generation
        grade_mapping = {
            'plus_one_science': '11S',
            'plus_one_commerce': '11C',
            'plus_two_science': '12S',
            'plus_two_commerce': '12C'
        }
        
        # Use mapped grade for student ID generation
        grade_code = grade_mapping.get(grade, grade)
        
        # Find the next sequence number for this year/category/grade
        existing_students = User.objects.filter(
            student_id__startswith=f"STU{current_year}{grade_code}",
            category=category
        ).count()
        sequence = existing_students + 1
        
        student_id = f"STU{current_year}{grade_code}{sequence:03d}"
        
        # Ensure student_id is unique within the category
        while User.objects.filter(student_id=student_id, category=category).exists():
            sequence += 1
            student_id = f"STU{current_year}{grade_code}{sequence:03d}"
        
        # Create username from student_id
        username = student_id.lower()
        
        # Ensure username is unique
        counter = 1
        original_username = username
        while User.objects.filter(username=username).exists():
            username = f"{original_username}_{counter}"
            counter += 1
        
        user = serializer.save(
            role='student',
            username=username,
            student_id=student_id
        )
        user.set_password(password)
        
        # Generate chest code
        user.generate_chest_code()
        
        user.save()
        
        # In a real app, you'd send this password via email or SMS
        # For now, we'll just log it
        print(f"Created student {user.student_id} with password: {password}")
        print(f"Generated chest code: {user.chest_code}")
    
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
                team = Team.objects.get(id=team_id)
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
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
        
        results = ProgramResult.objects.filter(
            participant=student
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
                    'category_display': result.program.get_category_display(),
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
                'points_earned': result.points_earned,
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
                program__event=event
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
                            'points_earned': result.points_earned,
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
                                'points_earned': result.points_earned,
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

    @action(detail=False, methods=['post'])
    def bulk_upload(self, request):
        """AI-powered bulk upload students via Excel file with team assignments"""
        if 'file' not in request.FILES:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        if not file.name.endswith(('.xlsx', '.xls')):
            return Response({'error': 'Please upload an Excel file (.xlsx or .xls)'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Read Excel file
            try:
                df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
            except Exception as e:
                return Response({'error': f'Error reading Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # AI-powered column detection and data validation
            results = self._process_student_excel_with_ai(df)
            
            if results['errors']:
                return Response({
                    'error': 'Data validation failed',
                    'details': results['errors'],
                    'suggestions': results['suggestions']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Process successful student creations
            created_students = []
            skipped = []
            team_assignments = []
            
            for student_data in results['valid_students']:
                try:
                    # Auto-generate student_id
                    from datetime import datetime
                    current_year = datetime.now().year
                    category = student_data.get('category', 'hs')
                    class_name = student_data.get('class', '9')
                    
                    # Generate student_id based on category and class
                    if category == 'hs':
                        grade = class_name
                    else:  # hss
                        if 'Plus One' in class_name:
                            grade = '11'
                        else:  # Plus Two
                            grade = '12'
                    
                    # Find the next sequence number
                    existing_students = User.objects.filter(
                        student_id__startswith=f"STU{current_year}{grade}"
                    ).count()
                    sequence = existing_students + 1
                    
                    student_id = f"STU{current_year}{grade}{sequence:03d}"
                    
                    # Ensure student_id is unique
                    while User.objects.filter(student_id=student_id).exists():
                        sequence += 1
                        student_id = f"STU{current_year}{grade}{sequence:03d}"
                    
                    # Auto-generate email
                    name = student_data['name'].lower().replace(' ', '.')
                    email = f"{name}@school.edu"
                    
                    # Ensure email is unique
                    counter = 1
                    original_email = email
                    while User.objects.filter(email=email).exists():
                        email = f"{name}{counter}@school.edu"
                        counter += 1
                    
                    # Check if student already exists
                    existing_student = User.objects.filter(
                        Q(student_id=student_id) |
                        Q(email=email)
                    ).first()
                    
                    if existing_student:
                        skipped.append({
                            'student_id': student_id,
                            'name': student_data['name'],
                            'email': email,
                            'reason': 'Student already exists with this ID or email'
                        })
                        continue
                    
                    # Create new student
                    student = User.objects.create(
                        student_id=student_id,
                        name=student_data['name'],
                        email=email,
                        role='student',
                        username=student_id.lower(),
                        password=make_password(student_id),  # Default password is student_id
                        category=category,
                        grade=grade,
                        section=class_name,  # Store the full class name in section
                        is_active=True
                    )
                    
                    # Generate chest code
                    student.generate_chest_code()
                    student.save()
                    
                    created_students.append(student)
                    
                    # Handle team assignment
                    team_name = student_data.get('team_name', '').strip()
                    if team_name:
                        team_assignments.append({
                            'student': student,
                            'team_name': team_name
                        })
                    
                except Exception as e:
                    skipped.append({
                        'student_id': student_data.get('student_id', 'Unknown'),
                        'name': student_data.get('name', ''),
                        'email': student_data.get('email', ''),
                        'reason': f'Error creating student: {str(e)}'
                    })
            
            # Process team assignments
            team_assignment_results = []
            if team_assignments:
                team_assignment_results = self._process_team_assignments(team_assignments)
            
            # Only return a summary and first 10 skipped/error entries to avoid large responses
            summary = {
                'total_processed': len(results['valid_students']),
                'successful_creations': len(created_students),
                'skipped_creations': len(skipped),
                'team_assignments_processed': len(team_assignment_results)
            }
            response_data = {
                'success': True,
                'message': f'Successfully processed {len(created_students)} students',
                'summary': summary,
                'skipped': skipped[:10],  # Only first 10 skipped
                'team_assignments': team_assignment_results[:10]  # Only first 10
            }
            return Response(response_data)
            
        except Exception as e:
            return Response({'error': f'Unexpected error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _process_team_assignments(self, team_assignments):
        """Process team assignments for bulk uploaded students"""
        from events.models import Team
        
        assignment_results = []
        
        for assignment in team_assignments:
            student = assignment['student']
            team_name = assignment['team_name']
            
            try:
                # Try to find existing team
                team = Team.objects.filter(name__iexact=team_name).first()
                
                if not team:
                    # Create new team if it doesn't exist
                    # Get the next team number
                    max_team_number = Team.objects.aggregate(max_num=Max('team_number'))['max_num'] or 0
                    new_team_number = max_team_number + 1
                    
                    team = Team.objects.create(
                        name=team_name,
                        team_number=new_team_number
                    )
                    
                    # Generate team credentials
                    team.generate_team_credentials()
                    team.save()
                    
                    assignment_results.append({
                        'student': student.display_name,
                        'team_name': team_name,
                        'action': 'Team created and student assigned as member',
                        'success': True
                    })
                else:
                    # Add student to existing team
                    team.members.add(student)
                    assignment_results.append({
                        'student': student.display_name,
                        'team_name': team_name,
                        'action': 'Added as team member',
                        'success': True
                    })
                        
            except Exception as e:
                assignment_results.append({
                    'student': student.display_name,
                    'team_name': team_name,
                    'action': f'Error: {str(e)}',
                    'success': False
                })
        
        return assignment_results

    def _process_student_excel_with_ai(self, df):
        """AI-powered processing of Excel data for student creation (name only, no first/last required)"""
        results = {
            'valid_students': [],
            'errors': [],
            'suggestions': []
        }
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # AI-powered column mapping
        column_mapping = self._detect_student_columns(df.columns.tolist())
        
        # Validate required columns (simplified)
        required_fields = ['name', 'category', 'class']
        missing_fields = [field for field in required_fields if not column_mapping.get(field)]
        
        if missing_fields:
            results['errors'].append(f'Missing required columns: {", ".join(missing_fields)}')
            results['suggestions'].append('Please ensure your Excel file has columns for: name, category, class')
            return results
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Extract required fields
                full_name = str(row[column_mapping['name']]).strip()
                category = str(row[column_mapping['category']]).strip()
                class_name = str(row[column_mapping['class']]).strip()
                
                # Skip empty rows
                if pd.isna(full_name) or full_name == '' or full_name.lower() == 'nan':
                    continue
                
                # Validate category
                if category not in ['hs', 'hss']:
                    results['errors'].append(f'Row {index + 2}: Invalid category "{category}". Must be "hs" or "hss"')
                    continue
                
                # Validate class based on category
                valid_classes = {
                    'hs': ['8', '9', '10'],
                    'hss': ['Plus One Science', 'Plus One Commerce', 'Plus Two Science', 'Plus Two Commerce']
                }
                
                if class_name not in valid_classes[category]:
                    results['errors'].append(f'Row {index + 2}: Invalid class "{class_name}" for category "{category}". Valid classes for {category}: {", ".join(valid_classes[category])}')
                    continue
                
                # Build student data
                student_data = {
                    'name': full_name,  # Only use full name
                    'category': category,
                    'class': class_name,
                }
                
                # Add optional team field
                if column_mapping.get('team_name'):
                    team_value = str(row[column_mapping['team_name']]).strip()
                    if team_value and team_value.lower() != 'nan':
                        student_data['team_name'] = team_value
                
                results['valid_students'].append(student_data)
                
            except Exception as e:
                results['errors'].append(f'Row {index + 2}: Error processing data: {str(e)}')
        
        return results
    
    def _detect_student_columns(self, columns):
        """AI-powered column detection for student data"""
        column_mapping = {}
        
        # Define patterns for different fields (simplified)
        patterns = {
            'name': [r'name', r'full.*name', r'student.*name', r'student'],
            'category': [r'category', r'type', r'level'],
            'class': [r'class', r'grade', r'standard', r'level'],
            'team_name': [r'team.*name', r'team', r'group.*name', r'group']
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
        """Download Excel template for student bulk upload with team assignments"""
        try:
            import io
            from django.http import HttpResponse
            
            # Get existing teams for the template
            from events.models import Team
            existing_teams = Team.objects.all()[:3]  # Get first 3 teams as examples
            
            # Create simplified sample data with proper HSS classes
            sample_data = {
                'name': ['Arjun Sharma', 'Priya Nair', 'Rahul Patel', 'Ananya Reddy', 'Kiran Kumar', 'Divya Singh', 'Ravi Menon', 'Sneha Pillai'],
                'category': ['hs', 'hss', 'hs', 'hss', 'hs', 'hss', 'hss', 'hss'],
                'class': ['9', 'Plus One Science', '10', 'Plus Two Commerce', '9', 'Plus One Commerce', 'Plus Two Science', 'Plus One Science'],
                'team_name': []
            }
            
            # Assign teams to students
            if existing_teams:
                team_names = [team.name for team in existing_teams]
                # Cycle through teams for assignment
                for i in range(len(sample_data['name'])):
                    sample_data['team_name'].append(team_names[i % len(team_names)])
            else:
                # Use default team names if no teams exist
                default_teams = ['Phoenix Risers', 'Thunder Bolts', 'Ocean Waves']
                for i in range(len(sample_data['name'])):
                    sample_data['team_name'].append(default_teams[i % len(default_teams)])
            
            df = pd.DataFrame(sample_data)
            
            # Create Excel file in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                # Main data sheet
                df.to_excel(writer, sheet_name='Students', index=False)
                
                # Instructions sheet
                instructions = pd.DataFrame({
                    'Field': ['name', 'category', 'class', 'team_name'],
                    'Description': [
                        'Student full name (Required)',
                        'Student category: hs (High School), hss (Higher Secondary)',
                        'Student class: For HS: 8, 9, 10 | For HSS: Plus One Science, Plus One Commerce, Plus Two Science, Plus Two Commerce',
                        'Team name for assignment (Optional, will create/assign to team)'
                    ],
                    'Required': ['Yes', 'Yes', 'Yes', 'No'],
                    'Example': ['Arjun Sharma', 'hs', '9', 'Phoenix Risers']
                })
                instructions.to_excel(writer, sheet_name='Instructions', index=False)
                
                # Available teams sheet
                if existing_teams:
                    teams_data = pd.DataFrame({
                        'Team Name': [team.name for team in existing_teams],
                        'Current Members': [team.member_count for team in existing_teams],
                        'Team Number': [team.team_number for team in existing_teams]
                    })
                else:
                    teams_data = pd.DataFrame({
                        'Team Name': ['Phoenix Risers', 'Thunder Bolts', 'Ocean Waves'],
                        'Current Members': [0, 0, 0],
                        'Team Number': [1, 2, 3]
                    })
                teams_data.to_excel(writer, sheet_name='Available Teams', index=False)
                
                # Class structure sheet
                class_structure = pd.DataFrame({
                    'Category': ['hs', 'hs', 'hs', 'hss', 'hss', 'hss', 'hss'],
                    'Class': ['8', '9', '10', 'Plus One Science', 'Plus One Commerce', 'Plus Two Science', 'Plus Two Commerce'],
                    'Description': [
                        'High School Grade 8',
                        'High School Grade 9',
                        'High School Grade 10',
                        'Higher Secondary First Year - Science Stream',
                        'Higher Secondary First Year - Commerce Stream',
                        'Higher Secondary Second Year - Science Stream',
                        'Higher Secondary Second Year - Commerce Stream'
                    ]
                })
                class_structure.to_excel(writer, sheet_name='Class Structure', index=False)
                
                # Format the worksheets
                workbook = writer.book
                
                # Format Students sheet
                students_sheet = workbook['Students']
                students_sheet.column_dimensions['A'].width = 20  # name
                students_sheet.column_dimensions['B'].width = 10  # category
                students_sheet.column_dimensions['C'].width = 20  # class
                students_sheet.column_dimensions['D'].width = 18  # team_name
                
                # Format Instructions sheet
                instructions_sheet = workbook['Instructions']
                instructions_sheet.column_dimensions['A'].width = 15
                instructions_sheet.column_dimensions['B'].width = 60
                instructions_sheet.column_dimensions['C'].width = 10
                instructions_sheet.column_dimensions['D'].width = 25
                
                # Format Available Teams sheet
                teams_sheet = workbook['Available Teams']
                teams_sheet.column_dimensions['A'].width = 18
                teams_sheet.column_dimensions['B'].width = 20
                teams_sheet.column_dimensions['C'].width = 15
                teams_sheet.column_dimensions['D'].width = 20
                
                # Format Class Structure sheet
                class_sheet = workbook['Class Structure']
                class_sheet.column_dimensions['A'].width = 15
                class_sheet.column_dimensions['B'].width = 25
                class_sheet.column_dimensions['C'].width = 50
            
            output.seek(0)
            
            response = HttpResponse(
                output.read(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="student_bulk_upload_template.xlsx"'
            return response
            
        except Exception as e:
            return Response({'error': f'Error generating template: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PointsViewSet(viewsets.ModelViewSet):
    """ViewSet for Points management"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['point_type', 'team', 'student', 'event']
    ordering = ['-awarded_at']
    pagination_class = LargePagination
    
    def get_queryset(self):
        from events.models import PointsRecord
        return EventPointsRecord.objects.all().select_related('team', 'student', 'event', 'awarded_by')
    
    def get_serializer_class(self):
        from events.serializers import PointsRecordSerializer, PointsRecordCreateSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return PointsRecordCreateSerializer
        return PointsRecordSerializer
    
    def get_permissions(self):
        """Only admins can manage points"""
        if self.request.user.role != 'admin':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Award points and track who awarded them"""
        serializer.save(awarded_by=self.request.user)
    
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
            from events.models import Event, ProgramResult, ProgramAssignment
            student = User.objects.get(id=pk, role='student')
            
            # Get all individual program results for this student across all events
            results = ProgramResult.objects.filter(
                participant=student,
                program__is_team_based=False
            ).select_related('program', 'program__event', 'team')
            
            # Calculate totals (only individual programs)
            total_points = sum(result.points_earned for result in results)
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
                        'total_points': 0,
                        'programs_participated': 0,
                        'programs_won': 0,
                        'programs': []
                    }
                
                event_totals[event_id]['total_points'] += result.points_earned
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
            
            # Convert to list format
            for event_id, event_data in event_totals.items():
                event_breakdown.append({
                    'event_id': event_data['event'].id,
                    'event_name': event_data['event'].title,
                    'event_type': event_data['event'].event_type,
                    'total_points': event_data['total_points'],
                    'programs_participated': event_data['programs_participated'],
                    'programs_won': event_data['programs_won'],
                    'programs': event_data['programs']
                })
            
            # Sort event breakdown by total points
            event_breakdown.sort(key=lambda x: x['total_points'], reverse=True)
            
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
                'category': student.get_category_display() if student.category else 'N/A',
                'grade': student.grade,
                'section': student.section,
                'total_points': total_points,
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
        """Calculate global points based on percentage performance across all events"""
        from events.models import Event, Team, ProgramResult
        from django.db.models import Sum
        
        # Get all events that have results
        events_with_results = Event.objects.filter(
            programs__results__isnull=False
        ).distinct()
        
        team_global_points = {}
        student_global_points = {}
        
        for event in events_with_results:
            # Get all results for this event
            event_results = ProgramResult.objects.filter(
                program__event=event,
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
                
                # Add percentage to global points (this is the key change)
                team_global_points[team_id]['global_points'] += event_percentage
                team_global_points[team_id]['events_participated'] += 1
                team_global_points[team_id]['event_breakdown'].append({
                    'event_name': event.title,
                    'event_points': team_data['points'],
                    'total_event_points': total_event_points,
                    'percentage': round(event_percentage, 2)
                })
            
            # Calculate student points for this event (only individual programs)
            student_event_points = {}
            for result in event_results.filter(program__is_team_based=False):
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
                
                # Add percentage to global points (this is the key change)
                student_global_points[student_id]['global_points'] += event_percentage
                student_global_points[student_id]['events_participated'] += 1
                student_global_points[student_id]['event_breakdown'].append({
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
                'category': student.get_category_display() if student.category else 'N/A',
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
    
    @action(detail=False, methods=['post'])
    def recalculate_global_points(self, request):
        """Recalculate and update global points for all teams and students"""
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can recalculate global points'}, status=403)
        
        # Calculate global points
        global_points = self.calculate_global_points()
        
        # Update team global points (store in points_earned field)
        from events.models import Team
        for team_info in global_points['teams']:
            try:
                team = Team.objects.get(id=team_info['id'])
                team.points_earned = int(team_info['global_points'])
                team.save()
            except Team.DoesNotExist:
                continue
        
        # Update student global points (store in total_points field)
        for student_info in global_points['students']:
            try:
                student = User.objects.get(id=student_info['id'])
                student.total_points = int(student_info['global_points'])
                student.save()
            except User.DoesNotExist:
                continue
        
        return Response({
            'message': 'Global points recalculated successfully',
            'teams_updated': len(global_points['teams']),
            'students_updated': len(global_points['students'])
        })
    
    @action(detail=False, methods=['post'])
    def award_manual_points(self, request):
        """Award manual points to a team or student"""
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can award manual points'}, status=403)
        
        from events.serializers import PointsRecordCreateSerializer
        
        # Add point_type to the data before validation
        data = request.data.copy()
        points = int(data.get('points', 0))
        data['point_type'] = 'manual_bonus' if points > 0 else 'manual_penalty'
        
        serializer = PointsRecordCreateSerializer(data=data)
        if serializer.is_valid():
            serializer.save(awarded_by=request.user)
            return Response({
                'message': 'Points awarded successfully',
                'record': serializer.data
            })
        else:
            return Response(serializer.errors, status=400) 

class SchoolSettingsViewSet(viewsets.ModelViewSet):
    queryset = SchoolSettings.objects.all()
    serializer_class = SchoolSettingsSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_object(self):
        # Always return the singleton settings object (pk=1)
        obj, created = SchoolSettings.objects.get_or_create(pk=1)
        return obj

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

@api_view(['POST'])
@permission_classes([])
def create_admin_user(request):
    """Create an admin user for testing"""
    from django.contrib.auth import get_user_model
    from django.db import transaction
    
    User = get_user_model()
    
    try:
        with transaction.atomic():
            email = 'admin@eventloo.com'
            password = 'admin123'
            name = 'Admin User'
            
            # Check if user already exists and activate if needed
            existing_user = User.objects.filter(email=email).first()
            if existing_user:
                # Update existing user to ensure it's active
                existing_user.is_active = True
                existing_user.is_staff = True
                existing_user.is_superuser = True
                existing_user.role = 'admin'
                existing_user.save()
                return Response({
                    'message': 'Admin user activated successfully',
                    'email': email,
                    'password': password
                }, status=200)
            
            # Create admin user
            user = User.objects.create_user(
                email=email,
                username=email,
                password=password,
                name=name,
                role='admin',
                is_staff=True,
                is_superuser=True,
                is_active=True
            )
            
            return Response({
                'message': 'Admin user created successfully',
                'email': email,
                'password': password,
                'name': name,
                'role': user.role
            }, status=201)
            
    except Exception as e:
        return Response({
            'error': f'Error creating user: {str(e)}'
        }, status=500)



 