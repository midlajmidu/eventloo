from rest_framework import permissions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser

class IsAdminOrEventManager(permissions.BasePermission):
    """
    Custom permission to only allow admins and event managers to perform certain actions.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'event_manager']
        )

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
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'team_manager']
        )
    
    def has_object_permission(self, request, view, obj):
        # Admins can do everything
        if request.user.role == 'admin':
            return True
            
        # Team managers can manage their assigned teams
        if request.user.role == 'team_manager':
            if hasattr(obj, 'team_manager'):
                return obj.team_manager == request.user
            elif hasattr(obj, 'managed_teams'):
                return obj.managed_teams.filter(team_manager=request.user).exists()
            
        return False


class CanManageStudents(permissions.BasePermission):
    """
    Permission for managing students - admins can manage all, team managers can manage their team's students.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'team_manager']
        )
    
    def has_object_permission(self, request, view, obj):
        # Admins can manage all students
        if request.user.role == 'admin':
            return True
            
        # Team managers can only manage their team's students
        if request.user.role == 'team_manager':
            from .models import Team
            # Check if student is in any of the manager's teams
            return Team.objects.filter(
                team_manager=request.user,
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
        
        if not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            # Decode the token
            access_token = AccessToken(token)
            
            # Check if this is a team manager token
            if access_token.get('access_type') == 'team_manager':
                # Create a mock user for team manager
                from accounts.models import User
                
                # Create or get a special team manager user
                team_id = access_token.get('team_id')
                team_name = access_token.get('team_name', 'Team Manager')
                
                # Create a mock user for team authentication
                mock_user = User(
                    id=team_id,
                    username=f'team_{team_id}',
                    email=f'team_{team_id}@example.com',
                    name=team_name,
                    role='team_manager'
                )
                mock_user.is_authenticated = True
                mock_user._state = User._meta._state  # Set the model state
                
                return (mock_user, access_token)
            
            return None
            
        except (InvalidToken, TokenError, Exception) as e:
            print(f"Authentication error: {e}")
            return None  # Return None instead of raising exception to allow other auth classes to try
    
    def authenticate_header(self, request):
        return 'Bearer realm="api"' 