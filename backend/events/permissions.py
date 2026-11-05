from rest_framework import permissions
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser
import hashlib
from secrets import compare_digest


class TeamScopedPrincipal:
    """Authenticated, non-database principal carried by a team access token."""

    is_authenticated = True
    is_anonymous = False
    is_superuser = False
    role = 'team_manager'

    def __init__(self, team):
        self.team_id = team.id
        self.school_id = team.school_id
        self.school = team.school
        self.team = team
        self.id = None
        self.pk = None
        self.username = team.team_username
        self.name = team.name

    @property
    def display_name(self):
        return self.name

class IsAdminOrEventManager(permissions.BasePermission):
    """
    Custom permission to only allow admins and event managers to perform certain actions.
    """
    
    def has_permission(self, request, view):
        allowed = (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'event_manager']
            and getattr(request.user, 'school_id', None) is not None
            and request.user.school.status == 'active'
        )
        if not allowed:
            return False
        school_id = request.user.school_id
        from .models import Event, Program, Team
        event_id = view.kwargs.get('event_id') or view.kwargs.get('event_pk')
        program_id = view.kwargs.get('program_id') or view.kwargs.get('program_pk')
        team_id = view.kwargs.get('team_id')
        if event_id and not Event.objects.filter(id=event_id, school_id=school_id).exists():
            return False
        if program_id and not Program.objects.filter(id=program_id, event__school_id=school_id).exists():
            return False
        if team_id and not Team.objects.filter(id=team_id, school_id=school_id).exists():
            return False
        return True


class IsSchoolAdmin(permissions.BasePermission):
    """Allow only an active tenant's school administrator."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'admin'
            and getattr(request.user, 'school_id', None) is not None
            and request.user.school.status == 'active'
        )

    def has_object_permission(self, request, view, obj):
        return object_school_id(obj) == request.user.school_id


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'super_admin'
            and getattr(request.user, 'school_id', None) is None
            and request.user.is_active
        )


class IsApplicationStaff(permissions.BasePermission):
    """Allow active platform administrators and active school staff principals."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not getattr(user, 'is_active', True):
            return False
        if getattr(user, 'role', None) == 'super_admin':
            return getattr(user, 'school_id', None) is None
        return bool(
            getattr(user, 'role', None) in ('admin', 'event_manager')
            and getattr(user, 'school_id', None) is not None
            and user.school.status == 'active'
        )


def object_school_id(obj):
    if hasattr(obj, 'school_id'):
        return obj.school_id
    for attr in ('event', 'program', 'team', 'student', 'participant'):
        related = getattr(obj, attr, None)
        if related is not None:
            school_id = object_school_id(related)
            if school_id is not None:
                return school_id
    return None


class IsSameSchool(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'school_id', None)
            and request.user.school.status == 'active'
        )

    def has_object_permission(self, request, view, obj):
        return object_school_id(obj) == request.user.school_id

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object or admins to edit it.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the owner or admin
        if request.user.role == 'admin':
            return True
            
        # Check if user is the owner based on object type
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        elif hasattr(obj, 'participant'):
            return obj.participant == request.user
            
        return False




class IsTeamManagerOrAdmin(permissions.BasePermission):
    """
    Custom permission for team managers to manage their assigned teams.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if getattr(request.user, 'role', None) in ['admin', 'event_manager']:
            school_id = getattr(request.user, 'school_id', None)
            route_team_id = view.kwargs.get('team_id')
            from .models import Event, Program, Team
            event_id = view.kwargs.get('event_id') or view.kwargs.get('event_pk')
            if event_id and not str(event_id).isdigit():
                event_id = None
            program_id = view.kwargs.get('program_id') or view.kwargs.get('program_pk')
            if program_id and not str(program_id).isdigit():
                program_id = None
            return bool(
                school_id is not None
                and (not route_team_id or Team.objects.filter(id=route_team_id, school_id=school_id).exists())
                and (not event_id or Event.objects.filter(id=event_id, school_id=school_id).exists())
                and (not program_id or Program.objects.filter(id=program_id, event__school_id=school_id).exists())
            )
        is_team_view = getattr(view, 'basename', None) in ('team', 'teams', 'team-manager') or (
            ('/teams/' in getattr(request, 'path', '') or '/team-manager/' in getattr(request, 'path', ''))
            and '/events/' not in getattr(request, 'path', '')
        )
        route_team_id = view.kwargs.get('team_id') or (view.kwargs.get('pk') if is_team_view else None)
        token_team_id = getattr(request.user, 'team_id', None)

        if route_team_id is not None:
            if token_team_id is not None and str(token_team_id) != str(route_team_id):
                return False
            elif getattr(request.user, 'role', None) == 'team_manager' and token_team_id is None:
                managed_ids = [str(t.id) for t in getattr(request.user, 'managed_teams', []).all()] if hasattr(request.user, 'managed_teams') else []
                if str(route_team_id) not in managed_ids:
                    return False

        allowed = (
            getattr(request.user, 'role', None) == 'team_manager'
            and getattr(request.user, 'school_id', None) is not None
        )
        if not allowed:
            return False
        from .models import Event, Program
        event_id = view.kwargs.get('event_id') or view.kwargs.get('event_pk') or (view.kwargs.get('pk') if not is_team_view else None)
        program_id = view.kwargs.get('program_id') or view.kwargs.get('program_pk')
        if event_id and not Event.objects.filter(id=event_id, school_id=request.user.school_id).exists():
            return False
        if program_id and not Program.objects.filter(id=program_id, event__school_id=request.user.school_id).exists():
            return False
        return True
    
    def has_object_permission(self, request, view, obj):
        # Admins and event managers can do everything in their school
        if getattr(request.user, 'role', None) in ['admin', 'event_manager', 'super_admin']:
            return True
            
        # Team managers can only access objects belonging to their school AND their team
        if getattr(request.user, 'role', None) == 'team_manager':
            school_id = getattr(request.user, 'school_id', None)
            token_team_id = getattr(request.user, 'team_id', None)
            from .models import Event, Program, Team, ProgramAssignment
            from django.contrib.auth import get_user_model
            User = get_user_model()

            if isinstance(obj, Event):
                return obj.school_id == school_id
            if isinstance(obj, Program):
                return obj.event.school_id == school_id
            if isinstance(obj, Team):
                if token_team_id is not None:
                    return obj.id == token_team_id and obj.school_id == school_id
                return (obj.team_manager == request.user and obj.school_id == school_id)
            if isinstance(obj, ProgramAssignment):
                if token_team_id is not None:
                    return obj.team_id == token_team_id and obj.program.event.school_id == school_id
                return obj.team and obj.team.team_manager == request.user and obj.program.event.school_id == school_id
            if isinstance(obj, User):
                if obj.school_id != school_id:
                    return False
                if token_team_id is not None:
                    return obj.team_memberships.filter(id=token_team_id).exists()
                return obj.team_memberships.filter(team_manager=request.user).exists()
            if hasattr(obj, 'team'):
                if token_team_id is not None:
                    return getattr(obj, 'team_id', None) == token_team_id
                return getattr(getattr(obj, 'team', None), 'team_manager', None) == request.user
            if hasattr(obj, 'team_manager'):
                return obj.team_manager == request.user
            if hasattr(obj, 'school_id'):
                return obj.school_id == school_id
            if hasattr(obj, 'event'):
                return obj.event.school_id == school_id
            
        return False


class CanManageStudents(permissions.BasePermission):
    """
    Permission for managing students - admins and event managers can manage all in their school,
    team managers can only view/manage their team's students.
    """
    
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'school_id', None) is not None and
            request.user.role in ['admin', 'event_manager', 'team_manager']
        )
    
    def has_object_permission(self, request, view, obj):
        # Admins and event managers can manage all students in their school
        if request.user.role in ['admin', 'event_manager']:
            return obj.school_id == request.user.school_id
            
        # Team managers can only manage their team's students in their school
        if request.user.role == 'team_manager':
            if obj.school_id != request.user.school_id:
                return False
            from .models import Team
            token_team_id = getattr(request.user, 'team_id', None)
            if token_team_id is not None:
                return Team.objects.filter(
                    id=token_team_id,
                    school_id=request.user.school_id,
                    members=obj,
                ).exists()
            return Team.objects.filter(
                team_manager=request.user,
                school_id=request.user.school_id,
                members=obj
            ).exists()
            
        return False


class CanViewEvents(permissions.BasePermission):
    """
    Permission for viewing events - all authenticated users can view, but team managers have restricted access.
    """
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Admins and event managers can view all events
        if request.user.role in ['admin', 'event_manager']:
            return True
            
        # Team managers can only view events their teams are participating in
        if request.user.role == 'team_manager':
            from .models import Team
            return Team.objects.filter(
                team_manager=request.user,
                event=obj
            ).exists()
            
        # Students can view all events
        return True 


class TeamManagerAuthentication(BaseAuthentication):
    """Custom authentication for team manager tokens"""
    
    def authenticate(self, request):
        # Get the authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        else:
            from django.conf import settings
            token = request.COOKIES.get(settings.ACCESS_COOKIE_NAME)
            if not token:
                return None
        
        try:
            # Decode the token
            access_token = AccessToken(token)
            
            # Check if this is a team manager token
            if access_token.get('access_type') == 'team_manager':
                from events.models import Team

                team_id = access_token.get('team_id')
                if not team_id:
                    raise AuthenticationFailed('Team token is missing its team scope.')
                try:
                    team = Team.objects.select_related('school').get(
                        id=team_id, school__status='active'
                    )
                except Team.DoesNotExist as exc:
                    raise AuthenticationFailed('The team for this token no longer exists.') from exc

                expected = hashlib.sha256(team.team_password.encode()).hexdigest()
                presented = str(access_token.get('credential_hash', ''))
                if not presented or not compare_digest(presented, expected):
                    raise AuthenticationFailed('This team session has been revoked.')

                return (TeamScopedPrincipal(team), access_token)
            
            return None
            
        except AuthenticationFailed:
            raise
        except (InvalidToken, TokenError):
            return None
    
    def authenticate_header(self, request):
        return 'Bearer realm="api"' 
