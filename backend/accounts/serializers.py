from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import User, SchoolSettings
from events.models import Team

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add custom user data to the response
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'role': self.user.role,
            'username': self.user.username,
        }
        
        return data

class TeamManagerLoginSerializer(serializers.Serializer):
    """Serializer for team manager login using team credentials"""
    team_username = serializers.CharField(max_length=100)
    team_password = serializers.CharField(max_length=50)
    
    def validate(self, attrs):
        team_username = attrs.get('team_username')
        team_password = attrs.get('team_password')
        
        if not team_username or not team_password:
            raise serializers.ValidationError("Both team username and password are required")
        
        # Find team by credentials
        try:
            team = Team.objects.get(
                team_username=team_username,
                team_password=team_password
            )
        except Team.DoesNotExist:
            raise serializers.ValidationError("Invalid team credentials")
        
        # Store team in validated data for use in view
        attrs['team'] = team
        return attrs

class TeamManagerResponseSerializer(serializers.ModelSerializer):
    """Serializer for team manager response data"""
    team_name = serializers.CharField(source='name', read_only=True)
    team_id = serializers.IntegerField(source='team_number', read_only=True)
    id = serializers.IntegerField(read_only=True)  # Add the actual database ID
    member_count = serializers.IntegerField(read_only=True)
    points_earned = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Team
        fields = ['id', 'team_id', 'team_name', 'member_count', 'points_earned']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'category', 'grade', 'section', 'address', 'date_of_birth', 'student_id', 'display_name', 'total_points', 'chest_code']
        read_only_fields = ['id', 'username', 'student_id', 'display_name', 'total_points', 'chest_code']

class StudentSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    team = serializers.SerializerMethodField()
    team_id = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'category', 'grade', 'section', 'address', 'date_of_birth', 'student_id', 'display_name', 'total_points', 'chest_code', 'team', 'team_id']
        read_only_fields = ['id', 'username', 'student_id', 'display_name', 'total_points', 'chest_code', 'team', 'team_id']

    def get_team(self, obj):
        """Get the team information for this student"""
        try:
            # Check if student is a team member
            member_team = Team.objects.filter(members=obj).first()
            if member_team:
                return {
                    'id': member_team.id,
                    'name': member_team.name,
                    'is_captain': False
                }
            
            return None
        except Exception as e:
            print(f"Error getting team for student {obj.id}: {e}")
            return None
    
    def get_team_id(self, obj):
        """Get the team ID for this student"""
        try:
            # Check if student is a team member
            member_team = Team.objects.filter(members=obj).first()
            if member_team:
                return member_team.id
            
            return None
        except Exception as e:
            print(f"Error getting team_id for student {obj.id}: {e}")
            return None

class StudentCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating students"""
    student_id = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = [
            'name', 'category', 'grade', 'section',
            'address', 'guardian_name', 'guardian_phone', 'student_id'
        ]
    
    def validate(self, data):
        # Ensure name is provided
        if not data.get('name'):
            raise serializers.ValidationError("Name is required")
        
        # Validate student_id uniqueness per category if provided
        student_id = data.get('student_id')
        category = data.get('category')
        
        if student_id and category:
            # Check if this student_id already exists in the same category
            existing_student = User.objects.filter(
                student_id=student_id, 
                category=category,
                role='student'
            ).exclude(id=self.instance.id if self.instance else None)
            
            if existing_student.exists():
                raise serializers.ValidationError({
                    'student_id': f'Student ID "{student_id}" already exists in category "{category.upper()}". Student IDs must be unique within each category.'
                })
        
        return data

class SchoolSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolSettings
        fields = '__all__'

# Note: PointsRecord and TeamProfile serializers are in events/serializers.py
# to avoid circular imports 