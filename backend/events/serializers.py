from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Event, Team, IndividualParticipation, EventAnnouncement, PointsRecord, TeamProfile, Program, ProgramAssignment, ProgramResult, ChestNumber

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user serializer for nested representations"""
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'student_id']
        read_only_fields = ['id']

class EventListSerializer(serializers.ModelSerializer):
    """Serializer for event list view"""
    current_participants = serializers.ReadOnlyField()
    current_teams = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    created_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'venue', 'max_participants', 'is_team_based',
            'current_participants', 'current_teams',
            'is_registration_open', 'created_by', 'created_at',
            'image', 'registration_deadline'
        ]

class EventDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for event detail view"""
    current_participants = serializers.ReadOnlyField()
    current_teams = serializers.ReadOnlyField()
    is_registration_open = serializers.ReadOnlyField()
    created_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'registration_deadline', 'venue', 'max_participants',
            'max_teams', 'is_team_based', 'team_size_min', 'team_size_max',
            'winner_points', 'runner_up_points', 'participation_points',
            'current_participants', 'current_teams', 'is_registration_open',
            'created_by', 'created_at', 'updated_at', 'image'
        ]

class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating events"""
    
    class Meta:
        model = Event
        fields = [
            'title', 'description', 'event_type', 'status',
            'start_date', 'end_date', 'start_time', 'end_time',
            'registration_deadline', 'venue', 'max_participants',
            'max_teams', 'is_team_based', 'team_size_min', 'team_size_max',
            'winner_points', 'runner_up_points', 'participation_points',
            'image'
        ]
    
    def validate(self, data):
        """Custom validation for event data"""
        # Validate dates
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError("Start date cannot be after end date")
        
        # Validate times for same day events
        if (data.get('start_date') == data.get('end_date') and 
            data.get('start_time') and data.get('end_time')):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("Start time must be before end time for same day events")
        
        # Set default values for team-based events
        if data.get('is_team_based'):
            # Set default values if not provided
            if not data.get('max_teams'):
                data['max_teams'] = 100  # Default high value
            if not data.get('team_size_min'):
                data['team_size_min'] = 1
            if not data.get('team_size_max'):
                data['team_size_max'] = 50  # Default high value
        
        return data

class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.ReadOnlyField()
    members_details = serializers.SerializerMethodField()
    team_credentials = serializers.SerializerMethodField()
    
    class Meta:
        model = Team
        fields = [
            'id', 'name', 'description', 
            'members', 'member_count', 'points_earned', 'position', 'team_number',
            'created_at', 'updated_at', 'members_details', 'team_credentials'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'member_count', 'team_number']
    
    def get_members_details(self, obj):
        """Get detailed information about team members"""
        members_list = []
        member_ids = set()
        
        # Add all members
        for member in obj.members.all():
            members_list.append({
                'id': member.id,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'name': member.get_full_name(),
                'email': member.email,
                'student_id': getattr(member, 'student_id', ''),
                'category': getattr(member, 'category', ''),
                'grade': getattr(member, 'grade', ''),
                'section': getattr(member, 'section', ''),
            })
        
        return members_list
    
    def get_team_credentials(self, obj):
        """Get team login credentials (only for admin users)"""
        request = self.context.get('request')
        if request and request.user and request.user.role == 'admin':
            # Generate credentials if not exist
            if not obj.team_username or not obj.team_password:
                obj.generate_team_credentials()
                obj.save()
            
            return {
                'username': obj.team_username,
                'password': obj.team_password
            }
        return None

class TeamCreateSerializer(serializers.ModelSerializer):
    """Simple serializer for creating teams without automatic member addition"""
    
    class Meta:
        model = Team
        fields = [
            'name', 'description'
        ]

class TeamCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating teams"""
    member_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
        help_text="List of member email addresses"
    )
    
    class Meta:
        model = Team
        fields = [
            'name', 'description', 'member_emails'
        ]
    
    def create(self, validated_data):
        member_emails = validated_data.pop('member_emails', [])
        team = super().create(validated_data)
        
        # Add members by email
        if member_emails:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            members = User.objects.filter(email__in=member_emails, role='student')
            team.members.set(members)
        
        return team
    
    def update(self, instance, validated_data):
        member_emails = validated_data.pop('member_emails', None)
        team = super().update(instance, validated_data)
        
        # Update members if provided
        if member_emails is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            members = User.objects.filter(email__in=member_emails, role='student')
            team.members.set(members)
        
        return team

class IndividualParticipationSerializer(serializers.ModelSerializer):
    """Serializer for individual participation"""
    participant = UserBasicSerializer(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = IndividualParticipation
        fields = [
            'id', 'participant', 'event_title', 'points_earned',
            'position', 'registered_at'
        ]

class EventAnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for event announcements"""
    created_by = UserBasicSerializer(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = EventAnnouncement
        fields = [
            'id', 'title', 'message', 'is_important',
            'created_by', 'event_title', 'created_at'
        ]

class EventAnnouncementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating announcements"""
    
    class Meta:
        model = EventAnnouncement
        fields = ['title', 'message', 'is_important']

class PointsRecordSerializer(serializers.ModelSerializer):
    """Serializer for Points records"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    student_name = serializers.CharField(source='student.display_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.display_name', read_only=True)
    point_type_display = serializers.CharField(source='get_point_type_display', read_only=True)
    
    class Meta:
        model = PointsRecord
        fields = [
            'id', 'team', 'team_name', 'student', 'student_name', 'student_id',
            'event', 'event_title', 'points', 'point_type', 'point_type_display',
            'reason', 'description', 'awarded_by', 'awarded_by_name', 'awarded_at'
        ]
        read_only_fields = ['id', 'awarded_by', 'awarded_at']

class PointsRecordCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating points records"""
    
    class Meta:
        model = PointsRecord
        fields = [
            'team', 'student', 'event', 'points', 'point_type', 'reason', 'description'
        ]
    
    def validate(self, data):
        # Ensure either team or student is provided, but not both
        if not data.get('team') and not data.get('student'):
            raise serializers.ValidationError("Either team or student must be provided")
        if data.get('team') and data.get('student'):
            raise serializers.ValidationError("Cannot assign points to both team and student")
        return data

class TeamProfileSerializer(serializers.ModelSerializer):
    """Serializer for Team Profile"""
    team_name = serializers.CharField(source='team.name', read_only=True)
    team_points = serializers.IntegerField(source='team.points_earned', read_only=True)
    
    class Meta:
        model = TeamProfile
        fields = [
            'id', 'team', 'team_name', 'team_points', 'motto', 'color_code',
            'logo_url', 'events_participated', 'events_won', 'current_rank',
            'win_rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'win_rate', 'created_at', 'updated_at']

class ProgramSerializer(serializers.ModelSerializer):
    participants_count = serializers.SerializerMethodField()
    assigned_students = serializers.SerializerMethodField()
    assignments_per_team = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    event = serializers.SerializerMethodField()
    program_type = serializers.CharField(required=True)
    
    class Meta:
        model = Program
        fields = [
            'id', 'event', 'name', 'description', 'category', 'category_display',
            'is_team_based', 'max_participants', 'max_participants_per_team', 'team_size',
            'venue', 'start_time', 'end_time', 'is_active', 'is_finished', 'status',
            'participants_count', 'assigned_students', 'assignments_per_team', 'created_at', 'updated_at',
            'program_type'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'status']
    
    def get_event(self, obj):
        """Get event details"""
        return {
            'id': obj.event.id,
            'title': obj.event.title,
            'event_type': obj.event.event_type,
            'status': obj.event.status
        }
    
    def get_participants_count(self, obj):
        """Get total number of participants in this program"""
        return obj.assignments.count()
    
    def get_assigned_students(self, obj):
        """Get list of assigned students with their details"""
        assignments = obj.assignments.select_related('student', 'team')
        return [
            {
                'id': assignment.student.id,
                'name': assignment.student.get_full_name(),
                'student_id': assignment.student.student_id,
                'team_name': assignment.team.name if assignment.team else None,
                'chest_number': assignment.chest_number
            }
            for assignment in assignments
        ]
    
    def get_assignments_per_team(self, obj):
        """Get assignments grouped by team"""
        from django.db.models import Count
        team_assignments = obj.assignments.values('team__name').annotate(
            count=Count('id')
        ).order_by('team__name')
        
        return [
            {
                'team_name': assignment['team__name'] or 'No Team',
                'count': assignment['count']
            }
            for assignment in team_assignments
        ]
    
    def validate(self, data):
        """Validate program data"""
        category = data.get('category')
        is_team_based = data.get('is_team_based', False)
        max_participants = data.get('max_participants')
        max_participants_per_team = data.get('max_participants_per_team')
        
        # HS and HSS programs must be individual (not team-based)
        if category in ['hs', 'hss'] and is_team_based:
            raise serializers.ValidationError(
                f"High School and HSS programs must be individual. "
                f"Team-based programs are only allowed for General category."
            )
        
        # If category is HS or HSS, force is_team_based to False
        if category in ['hs', 'hss']:
            data['is_team_based'] = False
            # Clear team size fields for individual programs
            data['team_size'] = None
            data['max_participants_per_team'] = None
        
        # Validate team-based program settings
        if is_team_based:
            # For team-based programs, require team_size and max_participants_per_team
            team_size = data.get('team_size')
            if team_size is None or team_size <= 0:
                raise serializers.ValidationError(
                    "Team-based programs must have a positive team_size value"
                )
            if max_participants_per_team is None or max_participants_per_team <= 0:
                raise serializers.ValidationError(
                    "Team-based programs must have a positive max_participants_per_team value"
                )
            # Clear max_participants for team-based programs
            data['max_participants'] = None
        else:
            # For individual programs, max_participants is now REQUIRED
            if max_participants is None or max_participants <= 0:
                raise serializers.ValidationError(
                    "Individual programs must have a positive max_participants value (Total Participants in Each Team)"
                )
            # Clear team-related fields for individual programs
            data['max_participants_per_team'] = None
            data['team_size'] = None
        
        # Validate program_type
        program_type = data.get('program_type')
        if not program_type or program_type not in ['stage', 'off_stage']:
            raise serializers.ValidationError('Program type is required and must be either "stage" or "off_stage".')
        
        return data

class ChestNumberSerializer(serializers.ModelSerializer):
    """Serializer for chest numbers"""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    
    class Meta:
        model = ChestNumber
        fields = [
            'id', 'event', 'event_title', 'student', 'student_name', 'student_id',
            'team', 'team_name', 'chest_number', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at']

class ProgramAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    
    class Meta:
        model = ProgramAssignment
        fields = [
            'id', 'program', 'program_name', 'student', 'student_name', 'student_id_number',
            'team', 'team_name', 'chest_number', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'chest_number']

class ProgramResultSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    participant_id = serializers.IntegerField(source='participant.id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    team_id = serializers.IntegerField(source='team.id', read_only=True)
    chest_number = serializers.SerializerMethodField()
    program_name = serializers.CharField(source='program.name', read_only=True)
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'program', 'participant', 'participant_name', 'participant_id',
            'team', 'team_name', 'team_id', 'chest_number', 'program_name',
            'result_number', 'judge1_marks', 'judge2_marks', 'judge3_marks', 'total_marks', 'average_marks',
            'position', 'points_earned', 'comments', 'entered_at', 'updated_at'
        ]
        read_only_fields = ['total_marks', 'average_marks', 'position', 'points_earned', 'result_number']
    
    def get_chest_number(self, obj):
        """Get chest number for the participant in this event"""
        try:
            chest_num = ChestNumber.objects.get(
                event=obj.program.event,
                student=obj.participant
            )
            return chest_num.chest_number
        except ChestNumber.DoesNotExist:
            return None

class MarkEntrySerializer(serializers.ModelSerializer):
    """Serializer for mark entry - includes participant details"""
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source='participant.student_id', read_only=True)
    student_chest_code = serializers.CharField(source='participant.chest_code', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    chest_number = serializers.SerializerMethodField()
    is_team_based = serializers.SerializerMethodField()
    team_member_count = serializers.SerializerMethodField()
    
    def get_student_name(self, obj):
        """Get student name with team-based formatting"""
        try:
            if obj.participant:
                base_name = obj.participant.get_full_name()
                
                # Check if this is a team-based program result
                if hasattr(obj, 'is_team_based') and obj.is_team_based:
                    return f"{base_name} and team"
                elif obj.team and obj.program.is_team_based:
                    return f"{base_name} and team"
                else:
                    return base_name
            else:
                return "Unknown Student (No Participant)"
        except Exception as e:
            return f"Unknown Student (Error: {str(e)})"
    
    def get_is_team_based(self, obj):
        """Check if this is a team-based program"""
        return obj.program.is_team_based if hasattr(obj, 'program') else False
    
    def get_team_member_count(self, obj):
        """Get the number of team members for team-based programs"""
        if hasattr(obj, 'team_member_count'):
            return obj.team_member_count
        elif obj.team and obj.program.is_team_based:
            # Count team members assigned to this program
            from events.models import ProgramAssignment
            return ProgramAssignment.objects.filter(
                program=obj.program,
                team=obj.team
            ).count()
        return 1
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'participant', 'student_name', 'student_code', 'student_chest_code', 'team_name', 
            'chest_number', 'result_number', 'judge1_marks', 'judge2_marks', 'judge3_marks', 'total_marks', 
            'average_marks', 'position', 'points_earned', 'comments', 'entered_at', 'updated_at',
            'is_team_based', 'team_member_count'
        ]
        read_only_fields = ['total_marks', 'average_marks', 'position', 'points_earned', 'entered_at', 'updated_at']
    
    def get_chest_number(self, obj):
        """Get chest number for the participant in this event"""
        # For general category programs, don't show chest numbers
        if hasattr(obj, 'program') and obj.program.category == 'open':
            return None
            
        try:
            # First try to get from ProgramAssignment
            assignment = ProgramAssignment.objects.filter(
                program=obj.program,
                student=obj.participant
            ).first()
            
            if assignment and assignment.chest_number:
                return assignment.chest_number
            
            # Fallback to ChestNumber model
            chest_number = ChestNumber.objects.filter(
                event=obj.program.event,
                student=obj.participant
            ).first()
            
            return chest_number.chest_number if chest_number else None
        except:
            return None

class ProgramResultSummarySerializer(serializers.ModelSerializer):
    """Serializer for displaying program results summary"""
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    participant_code = serializers.CharField(source='participant.student_id', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    chest_number = serializers.SerializerMethodField()
    position_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ProgramResult
        fields = [
            'id', 'result_number', 'participant_name', 'participant_code', 'team_name', 'chest_number',
            'judge1_marks', 'judge2_marks', 'judge3_marks', 'total_marks', 'average_marks',
            'position', 'position_display', 'points_earned'
        ]
    
    def get_chest_number(self, obj):
        try:
            # First try to get from ProgramAssignment
            assignment = ProgramAssignment.objects.get(
                program=obj.program,
                student=obj.participant
            )
            if assignment.chest_number:
                return assignment.chest_number
        except ProgramAssignment.DoesNotExist:
            pass
        
        # Fallback to ChestNumber model
        try:
            chest_num = ChestNumber.objects.get(
                event=obj.program.event,
                student=obj.participant
            )
            return chest_num.chest_number
        except ChestNumber.DoesNotExist:
            return None
    
    def get_position_display(self, obj):
        if obj.position == 1:
            return "1st"
        elif obj.position == 2:
            return "2nd"
        elif obj.position == 3:
            return "3rd"
        elif obj.position:
            return f"{obj.position}th"
        return "Unranked"

# Enhanced Event Serializer with programs
class EventWithProgramsSerializer(EventDetailSerializer):
    programs = ProgramSerializer(many=True, read_only=True)
    programs_count = serializers.SerializerMethodField()
    
    class Meta(EventDetailSerializer.Meta):
        fields = EventDetailSerializer.Meta.fields + ['programs', 'programs_count']
        
    def get_programs_count(self, obj):
        return obj.programs.count() 